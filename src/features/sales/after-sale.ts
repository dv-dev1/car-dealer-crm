import { UUID, withStore, type MemberContext, type StoreMember } from "@/shared/db/client";
import { addDays } from "@/shared/today";

export type FollowUpKind = "warranty_end" | "six_months" | "one_year" | "transfer";
export type FollowUp = {
  saleId: string;
  kind: FollowUpKind;
  dueOn: string;
  customer: string | null;
  phone: string | null;
  car: string;
  label: string;
  message: string;
};
export type AfterSaleRow = {
  saleId: string;
  soldOn: string;
  customer: string | null;
  car: string;
  sellerName: string;
  warrantyUntil: string;
  transferDoneOn: string | null;
  /** Not done 20 days after the sale: the 30 days to transfer are near. */
  transferLate: boolean;
  canMarkTransfer: boolean;
};

/** A reminder stays on today's list for a week; a transfer shows from this many days after the sale. */
const REMINDER_DAYS = 6;
const TRANSFER_ALERT_DAYS = 20;
const TRANSFER_LIMIT_DAYS = 30;

const brDate = (iso: string) => iso.split("-").reverse().join("/");

/** The WhatsApp text of a reminder, by first name. */
export function followUpMessage(
  kind: FollowUpKind,
  { customer, car, store, dueOn }: { customer: string | null; car: string; store: string; dueOn: string },
): string {
  const hello = `Olá${customer ? ` ${customer.trim().split(" ")[0]}` : ""}, aqui é da ${store}.`;
  switch (kind) {
    case "warranty_end":
      return `${hello} A garantia do seu ${car} termina em ${brDate(dueOn)}. Está tudo certo com o carro? Se precisar de algo, fale com a gente.`;
    case "six_months":
      return `${hello} Faz seis meses que você levou o ${car}. Como ele está? Se pensar em trocar ou indicar alguém, conte com a gente.`;
    case "one_year":
      return `${hello} Faz um ano que você levou o ${car}. Como ele está? Se pensar em trocar ou indicar alguém, conte com a gente.`;
    case "transfer":
      return `${hello} Falta concluir a transferência do ${car} para o seu nome. Podemos resolver isso esta semana?`;
  }
}

type Row = Omit<AfterSaleRow, "transferLate" | "canMarkTransfer"> & { phone: string | null; sixMonths: string; oneYear: string; days: number };

/**
 * The sales of the last year with their warranty and transfer, and today's follow-ups: a warranty ending, six months
 * and one year of the sale (each for a week from its date), and the transfers still open 20 days after the sale.
 * A seller gets only their own sales.
 */
export async function afterSale(ctx: StoreMember, today: string): Promise<{ today: FollowUp[]; sales: AfterSaleRow[] }> {
  const rows = await withStore(ctx, (db) =>
    db.query<Row>(
      `select s.id as "saleId", to_char(s.sold_on, 'YYYY-MM-DD') as "soldOn", l.name as customer, l.phone,
              v.brand || ' ' || v.model as car, s.seller_name as "sellerName",
              to_char(s.warranty_until, 'YYYY-MM-DD') as "warrantyUntil", to_char(s.transfer_done_on, 'YYYY-MM-DD') as "transferDoneOn",
              to_char(s.sold_on + interval '6 months', 'YYYY-MM-DD') as "sixMonths",
              to_char(s.sold_on + interval '1 year', 'YYYY-MM-DD') as "oneYear", $2::date - s.sold_on as days
         from sales s join vehicles v on v.id = s.vehicle_id left join leads l on l.id = s.lead_id
        where s.store_id = $1 and s.sold_on > $2::date - interval '1 year' - interval '7 days'
          and ($3::uuid is null or s.seller_id = $3)
        order by s.sold_on desc, s.id`,
      [ctx.storeId, today, ctx.role === "seller" ? ctx.membershipId : null],
    ),
  );
  const from = addDays(today, -REMINDER_DAYS);
  const followUps: FollowUp[] = [];
  const add = (r: Row, kind: FollowUpKind, dueOn: string, label: string) =>
    followUps.push({
      saleId: r.saleId, kind, dueOn, customer: r.customer, phone: r.phone, car: r.car, label,
      message: followUpMessage(kind, { customer: r.customer, car: r.car, store: ctx.storeName, dueOn }),
    });
  for (const r of rows) {
    const late = r.transferDoneOn === null && r.days >= TRANSFER_ALERT_DAYS;
    if (late) add(r, "transfer", addDays(r.soldOn, TRANSFER_LIMIT_DAYS), `Transferência pendente há ${r.days} dias`);
    const dates: [FollowUpKind, string, string][] = [
      ["warranty_end", r.warrantyUntil, `Garantia termina em ${brDate(r.warrantyUntil)}`],
      ["six_months", r.sixMonths, "6 meses da venda"],
      ["one_year", r.oneYear, "1 ano da venda"],
    ];
    for (const [kind, dueOn, label] of dates) {
      // A sale with no warranty has no end to remind of.
      if (dueOn >= from && dueOn <= today && !(kind === "warranty_end" && dueOn === r.soldOn)) add(r, kind, dueOn, label);
    }
  }
  return {
    today: followUps.sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    sales: rows.map(({ phone: _phone, sixMonths: _six, oneYear: _year, days, ...row }) => ({
      ...row,
      transferLate: row.transferDoneOn === null && days >= TRANSFER_ALERT_DAYS,
      canMarkTransfer: ctx.role !== "seller",
    })),
  };
}

/** Owner and manager mark the transfer as done on the store's day, or undo it. */
export async function setTransferDone(
  ctx: MemberContext,
  saleId: string,
  done: boolean,
  today: string,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "not_found" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (!UUID.test(saleId)) return { ok: false, error: "not_found" };
  const rows = await withStore(ctx, (db) =>
    db.query("update sales set transfer_done_on = $3 where id = $1 and store_id = $2 returning id", [saleId, ctx.storeId, done ? today : null]),
  );
  return rows.length ? { ok: true } : { ok: false, error: "not_found" };
}
