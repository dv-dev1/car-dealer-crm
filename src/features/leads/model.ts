import { UUID, withStore, type Db, type MemberContext } from "@/shared/db/client";
import { STORE_TIME_ZONE, todayIso } from "@/shared/today";

import { PAYMENT_LABEL, type EstagioFunil, type Lead, type Payment } from "./types";

export type DbStage = "new" | "visit_scheduled" | "negotiating" | "call_back" | "won" | "lost";
export type ActiveStage = Exclude<DbStage, "won" | "lost">;
export const ACTIVE_STAGES: readonly ActiveStage[] = ["new", "visit_scheduled", "negotiating", "call_back"];
export const STAGE_UI: Record<DbStage, EstagioFunil> = {
  new: "lead-novo",
  visit_scheduled: "visita-marcada",
  negotiating: "negociando",
  call_back: "ligar-volta",
  won: "vendeu",
  lost: "nao-comprou",
};

/**
 * `sellerId` null means "me" on create and "unchanged" on update; a seller may only name themselves.
 * `lastContactOn` is a day; the database keeps the moment, noon in the store when only the day is known.
 */
export type LeadInput = {
  name: string;
  phone: string;
  stage: ActiveStage;
  vehicleId: string | null;
  interest: string | null;
  channelId: string | null;
  sellerId: string | null;
  note: string;
  lastContactOn: string | null;
  visitOn: string | null;
  visitTime: string | null;
  cameOn: string | null;
  callBackOn: string | null;
};
export type LeadError = "forbidden" | "not_found" | "not_editable" | "invalid";
export type LeadResult = { ok: true; id: string } | { ok: false; error: LeadError; field?: keyof LeadInput };

const MAX_NAME = 80;
const MAX_INTEREST = 120;
const MAX_NOTE = 2000;
const MAX_REASON = 120;

/** Digits with the country code, null when empty, undefined when it is not a Brazilian number. */
export function normalizePhone(raw: string): string | null | undefined {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return undefined;
}

/** "5583991110000" → "(83) 99111-0000". */
export function phoneLabel(phone: string): string {
  const local = phone.slice(4);
  const split = local.length - 4;
  return `(${phone.slice(2, 4)}) ${local.slice(0, split)}-${local.slice(split)}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateLead(input: LeadInput, today: string): keyof LeadInput | null {
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME) return "name";
  if (normalizePhone(input.phone) === undefined) return "phone";
  if (!ACTIVE_STAGES.includes(input.stage)) return "stage";
  if (input.vehicleId !== null && !UUID.test(input.vehicleId)) return "vehicleId";
  if (input.interest !== null && input.interest.length > MAX_INTEREST) return "interest";
  if (input.channelId !== null && !UUID.test(input.channelId)) return "channelId";
  if (input.sellerId !== null && !UUID.test(input.sellerId)) return "sellerId";
  if (input.note.length > MAX_NOTE) return "note";
  const pastDay = (value: string | null) => value === null || (isIsoDate(value) && value <= today);
  const day = (value: string | null) => value === null || isIsoDate(value);
  if (!pastDay(input.lastContactOn)) return "lastContactOn";
  if (!day(input.visitOn)) return "visitOn";
  if (input.visitTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.visitTime)) return "visitTime";
  if (!pastDay(input.cameOn)) return "cameOn";
  if (!day(input.callBackOn)) return "callBackOn";
  return null;
}

// The foreign keys would refuse another store's car, channel or member with a bare 23503; this names the field.
async function badReference(db: Db, storeId: string, input: LeadInput): Promise<keyof LeadInput | null> {
  const [found] = await db.query<{ vehicle: boolean; channel: boolean; seller: boolean }>(
    `select ($2::uuid is null or exists (select from vehicles where id = $2 and store_id = $1)) as vehicle,
            ($3::uuid is null or exists (select from channels where id = $3 and store_id = $1)) as channel,
            ($4::uuid is null or exists (select from memberships where id = $4 and store_id = $1)) as seller`,
    [storeId, input.vehicleId, input.channelId, input.sellerId],
  );
  if (!found.vehicle) return "vehicleId";
  if (!found.channel) return "channelId";
  if (!found.seller) return "sellerId";
  return null;
}

// A sale closing the lead in another transaction meanwhile makes the write match no row.
const OPEN = "stage not in ('won', 'lost')";
const invalid = (field: keyof LeadInput): LeadResult => ({ ok: false, error: "invalid", field });
const failed = (error: LeadError): LeadResult => ({ ok: false, error });

// $1 store, then the columns in this order.
const COLUMNS = `name = $2, phone = $3, stage = $4, vehicle_id = $5, interest = $6, channel_id = $7, seller_id = $8, note = $9,
  last_contact_at = case
    when $10::date is null then null
    when (last_contact_at at time zone '${STORE_TIME_ZONE}')::date = $10::date then last_contact_at
    else ($10::date + time '12:00') at time zone '${STORE_TIME_ZONE}' end,
  visit_on = $11, visit_time = $12, came_on = $13, call_back_on = $14`;

function values(input: LeadInput, sellerId: string | null) {
  return [
    input.name.trim(), normalizePhone(input.phone), input.stage, input.vehicleId, input.interest?.trim() || null,
    input.channelId, sellerId, input.note.trim() || null, input.lastContactOn, input.visitOn, input.visitTime,
    input.cameOn, input.callBackOn,
  ];
}

export async function createLead(ctx: MemberContext, input: LeadInput, today = todayIso()): Promise<LeadResult> {
  if (ctx.role === "seller" && input.sellerId !== null && input.sellerId !== ctx.membershipId) return failed("forbidden");
  const field = validateLead(input, today);
  if (field) return invalid(field);

  return withStore(ctx, async (db): Promise<LeadResult> => {
    const ref = await badReference(db, ctx.storeId, input);
    if (ref) return invalid(ref);
    const [row] = await db.query<{ id: string }>(
      `insert into leads (store_id, name, phone, stage, vehicle_id, interest, channel_id, seller_id, note, last_contact_at,
                          visit_on, visit_time, came_on, call_back_on)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, ($10::date + time '12:00') at time zone '${STORE_TIME_ZONE}', $11, $12, $13, $14)
       returning id`,
      [ctx.storeId, ...values(input, input.sellerId ?? ctx.membershipId)],
    );
    return { ok: true, id: row.id };
  });
}

// An open lead this member may change, or why not. No FOR UPDATE: it applies the update policy, which would hide
// a colleague's lead from a seller as not found; the writes below re-check the stage instead.
async function openLead(db: Db, ctx: MemberContext, leadId: string): Promise<{ sellerId: string | null } | LeadResult> {
  const [lead] = await db.query<{ stage: DbStage; seller_id: string | null }>(
    "select stage, seller_id from leads where id = $1 and store_id = $2",
    [leadId, ctx.storeId],
  );
  if (!lead) return failed("not_found");
  if (ctx.role === "seller" && lead.seller_id !== ctx.membershipId) return failed("forbidden");
  if (lead.stage === "won" || lead.stage === "lost") return failed("not_editable");
  return { sellerId: lead.seller_id };
}

export async function updateLead(ctx: MemberContext, leadId: string, input: LeadInput, today = todayIso()): Promise<LeadResult> {
  if (!UUID.test(leadId)) return failed("not_found");
  if (ctx.role === "seller" && input.sellerId !== null && input.sellerId !== ctx.membershipId) return failed("forbidden");
  const field = validateLead(input, today);
  if (field) return invalid(field);

  return withStore(ctx, async (db): Promise<LeadResult> => {
    const lead = await openLead(db, ctx, leadId);
    if ("ok" in lead) return lead;
    const ref = await badReference(db, ctx.storeId, input);
    if (ref) return invalid(ref);
    const sellerId = ctx.role === "seller" ? lead.sellerId : (input.sellerId ?? lead.sellerId);
    const done = await db.query(
      `update leads set ${COLUMNS} where id = $15 and store_id = $1 and ${OPEN} returning id`,
      [ctx.storeId, ...values(input, sellerId), leadId],
    );
    return done.length ? { ok: true, id: leadId } : failed("not_editable");
  });
}

export async function moveLead(ctx: MemberContext, leadId: string, stage: ActiveStage): Promise<LeadResult> {
  if (!UUID.test(leadId)) return failed("not_found");
  if (!ACTIVE_STAGES.includes(stage)) return invalid("stage");

  return withStore(ctx, async (db): Promise<LeadResult> => {
    const lead = await openLead(db, ctx, leadId);
    if ("ok" in lead) return lead;
    const done = await db.query(`update leads set stage = $2 where id = $1 and ${OPEN} returning id`, [leadId, stage]);
    return done.length ? { ok: true, id: leadId } : failed("not_editable");
  });
}

export async function loseLead(ctx: MemberContext, leadId: string, reason: string | null): Promise<LeadResult> {
  if (!UUID.test(leadId)) return failed("not_found");
  const why = reason?.trim() || null;
  if (why !== null && why.length > MAX_REASON) return { ok: false, error: "invalid" };

  return withStore(ctx, async (db): Promise<LeadResult> => {
    const lead = await openLead(db, ctx, leadId);
    if ("ok" in lead) return lead;
    const done = await db.query(
      `update leads set stage = 'lost', lost_reason = $2, closed_at = now() where id = $1 and ${OPEN} returning id`,
      [leadId, why],
    );
    return done.length ? { ok: true, id: leadId } : failed("not_editable");
  });
}

type Row = {
  id: string;
  name: string;
  phone: string | null;
  stage: DbStage;
  interest: string | null;
  note: string | null;
  sellerId: string | null;
  sellerName: string | null;
  vehicleId: string | null;
  vehicleTitle: string | null;
  channelId: string | null;
  channelName: string | null;
  lastContactOn: string | null;
  visitOn: string | null;
  visitTime: string | null;
  cameOn: string | null;
  callBackOn: string | null;
  lostReason: string | null;
  closedOn: string | null;
  salePrice: string | null;
  payment: Payment | null;
};

const opt = <T>(value: T | null) => value ?? undefined;

/** Open leads and the ones closed in the month of `today`, newest first. */
export async function listLeads(ctx: MemberContext, today = todayIso()): Promise<Lead[]> {
  const rows = await withStore(ctx, (db) =>
    db.query<Row>(
      `select l.id, l.name, l.phone, l.stage, l.interest, l.note, l.seller_id as "sellerId", m.name as "sellerName",
              l.vehicle_id as "vehicleId", v.brand || ' ' || v.model || ' ' || v.version as "vehicleTitle",
              l.channel_id as "channelId", c.name as "channelName",
              to_char(l.last_contact_at at time zone $3, 'YYYY-MM-DD') as "lastContactOn",
              to_char(l.visit_on, 'YYYY-MM-DD') as "visitOn", to_char(l.visit_time, 'HH24:MI') as "visitTime",
              to_char(l.came_on, 'YYYY-MM-DD') as "cameOn", to_char(l.call_back_on, 'YYYY-MM-DD') as "callBackOn",
              l.lost_reason as "lostReason", to_char(l.closed_at at time zone $3, 'YYYY-MM-DD') as "closedOn",
              s.price as "salePrice", s.payment
         from leads l
         left join memberships m on m.id = l.seller_id
         left join vehicles v on v.id = l.vehicle_id
         left join channels c on c.id = l.channel_id
         left join lateral (
           select price, payment from sales where lead_id = l.id order by sold_on desc, created_at desc limit 1
         ) s on true
        where l.store_id = $1
          and (l.closed_at is null
               or (l.closed_at at time zone $3) >= date_trunc('month', $2::date)
                  and (l.closed_at at time zone $3) < date_trunc('month', $2::date) + interval '1 month')
        order by l.created_at desc`,
      [ctx.storeId, today, STORE_TIME_ZONE],
    ),
  );
  return rows.map((r) => ({
    id: r.id,
    nome: r.name,
    telefone: r.phone ?? "",
    telefoneLabel: r.phone ? phoneLabel(r.phone) : "—",
    carro: opt(r.vehicleTitle ?? r.interest),
    origem: opt(r.channelName),
    nota: opt(r.note),
    estagio: STAGE_UI[r.stage],
    conversaEm: opt(r.lastContactOn),
    visitaEm: opt(r.visitOn),
    horaVisita: opt(r.visitTime),
    veioEm: opt(r.cameOn),
    retornarEm: opt(r.callBackOn),
    fechadoEm: opt(r.closedOn),
    motivoPerda: opt(r.lostReason),
    valorVenda: r.salePrice === null ? undefined : Number(r.salePrice),
    formaPagamento: r.payment ? PAYMENT_LABEL[r.payment] : undefined,
    sellerId: r.sellerId,
    sellerName: r.sellerName,
    vehicleId: r.vehicleId,
    channelId: r.channelId,
    canEdit: ctx.role !== "seller" || r.sellerId === ctx.membershipId,
  }));
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "pt-BR");

/** The lead origins in use, by name. */
export async function listChannels(ctx: MemberContext): Promise<{ id: string; name: string }[]> {
  const rows = await withStore(ctx, (db) =>
    db.query<{ id: string; name: string }>("select id, name from channels where store_id = $1 and active", [ctx.storeId]),
  );
  return rows.sort(byName);
}

/** Everyone in the store sells, owner and manager included. */
export async function listSellers(ctx: MemberContext): Promise<{ id: string; name: string }[]> {
  const rows = await withStore(ctx, (db) =>
    db.query<{ id: string; name: string }>("select id, name from memberships where store_id = $1", [ctx.storeId]),
  );
  return rows.sort(byName);
}
