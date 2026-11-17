import type { Janela } from "@/features/reports/rules";
import { UUID, withStore, type MemberContext } from "@/shared/db/client";
import { STORE_TIME_ZONE } from "@/shared/today";

export type ContactKind = "whatsapp" | "call" | "note";
const KINDS: readonly string[] = ["whatsapp", "call", "note"];

/**
 * A contact with an open client: the first one is the first response, every one is the last contact.
 * A seller records only on their own clients.
 */
export async function recordContact(
  ctx: MemberContext,
  leadId: string,
  kind: ContactKind,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "not_found" }> {
  if (!UUID.test(leadId) || !KINDS.includes(kind)) return { ok: false, error: "not_found" };
  return withStore(ctx, async (db) => {
    const [lead] = await db.query<{ sellerId: string | null }>(
      `select seller_id as "sellerId" from leads where id = $1 and store_id = $2 and closed_at is null`,
      [leadId, ctx.storeId],
    );
    if (!lead) return { ok: false, error: "not_found" } as const;
    if (ctx.role === "seller" && lead.sellerId !== ctx.membershipId) return { ok: false, error: "forbidden" } as const;
    await db.query("insert into lead_contacts (store_id, lead_id, member_id, kind) values ($1, $2, $3, $4)", [
      ctx.storeId, leadId, ctx.membershipId, kind,
    ]);
    await db.query("update leads set first_response_at = coalesce(first_response_at, now()), last_contact_at = now() where id = $1", [leadId]);
    return { ok: true } as const;
  });
}

export type StaleLead = { id: string; name: string; sellerName: string | null; days: number; mine: boolean };

/**
 * Open clients with no contact for more than the store's days, the longest wait first. A client nobody
 * contacted counts from the day they came in; one with a call back or a visit ahead is waiting, not stale.
 */
export async function staleLeads(ctx: MemberContext, today: string): Promise<StaleLead[]> {
  return withStore(ctx, (db) =>
    db.query<StaleLead>(
      `select l.id, l.name, m.name as "sellerName", coalesce(l.seller_id = $4, false) as mine,
              $2::date - (coalesce(l.last_contact_at, l.created_at) at time zone $3)::date as days
         from leads l left join memberships m on m.id = l.seller_id
        where l.store_id = $1 and l.closed_at is null
          and not coalesce(l.call_back_on >= $2::date, false) and not coalesce(l.visit_on >= $2::date, false)
          and $2::date - (coalesce(l.last_contact_at, l.created_at) at time zone $3)::date
              > (select stale_lead_days from stores where id = $1)
        order by days desc, l.name`,
      [ctx.storeId, today, STORE_TIME_ZONE, ctx.membershipId],
    ),
  );
}

export type ResponseTime = { sellerName: string; leads: number; answered: number; avgMinutes: number | null };

/**
 * How long each seller takes to first answer the clients that came in during the period, the fastest first.
 * A seller gets only their own line.
 */
export async function responseTimes(ctx: MemberContext, { de, ate }: Janela): Promise<ResponseTime[]> {
  return withStore(ctx, (db) =>
    db.query<ResponseTime>(
      `select m.name as "sellerName", count(*)::int as leads, count(l.first_response_at)::int as answered,
              round(avg(extract(epoch from l.first_response_at - l.created_at) / 60))::int as "avgMinutes"
         from leads l join memberships m on m.id = l.seller_id
        where l.store_id = $1 and (l.created_at at time zone $4)::date between $2 and $3
          and ($5::uuid is null or l.seller_id = $5)
        group by m.id, m.name
        order by "avgMinutes" nulls last, m.name`,
      [ctx.storeId, de, ate, STORE_TIME_ZONE, ctx.role === "seller" ? ctx.membershipId : null],
    ),
  );
}
