import { UUID, withStore, type MemberContext } from "@/shared/db/client";
import { addDays, isIsoDate, todayIso } from "@/shared/today";

export type ReservationInput = { vehicleId: string; leadId: string | null; deposit: number; expiresOn: string };
export type ReservationResult = { ok: true; id: string } | { ok: false; error: "forbidden" | "not_found" | "invalid" | "reserved" };

const MAX_DEPOSIT = 9_999_999;
const MAX_DAYS = 30;

/**
 * Holds a car on sale for a client (optional) with a deposit, until `expiresOn` (today to 30 days ahead).
 * A seller reserves for their own client or for nobody in particular; the car reads as reserved while it is open.
 */
export async function createReservation(
  ctx: MemberContext,
  input: ReservationInput,
  today: string = todayIso(),
): Promise<ReservationResult> {
  if (
    !Number.isInteger(input.deposit) || input.deposit < 1 || input.deposit > MAX_DEPOSIT ||
    !isIsoDate(input.expiresOn) || input.expiresOn < today || input.expiresOn > addDays(today, MAX_DAYS)
  ) {
    return { ok: false, error: "invalid" };
  }
  if (!UUID.test(input.vehicleId) || (input.leadId !== null && !UUID.test(input.leadId))) return { ok: false, error: "not_found" };

  return withStore(ctx, async (db): Promise<ReservationResult> => {
    // A seller cannot lock the car's row (RLS lets only managers update it): the lock is on the car's id instead.
    await db.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [input.vehicleId]);
    const [car] = await db.query<{ status: string }>("select status from vehicles where id = $1 and store_id = $2", [
      input.vehicleId, ctx.storeId,
    ]);
    if (car?.status !== "available") return { ok: false, error: "not_found" };
    if (input.leadId !== null) {
      const [lead] = await db.query<{ sellerId: string | null; stage: string }>(
        `select seller_id as "sellerId", stage from leads where id = $1 and store_id = $2`, [input.leadId, ctx.storeId],
      );
      if (!lead || lead.stage === "won" || lead.stage === "lost") return { ok: false, error: "not_found" };
      if (ctx.role === "seller" && lead.sellerId !== ctx.membershipId) return { ok: false, error: "forbidden" };
    }
    const [open] = await db.query(
      "select 1 from reservations where vehicle_id = $1 and canceled_at is null and expires_on >= $2", [input.vehicleId, today],
    );
    if (open) return { ok: false, error: "reserved" };
    const [row] = await db.query<{ id: string }>(
      `insert into reservations (store_id, vehicle_id, lead_id, deposit, expires_on, created_by)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [ctx.storeId, input.vehicleId, input.leadId, input.deposit, input.expiresOn, ctx.membershipId],
    );
    return { ok: true, id: row.id };
  });
}

/** A seller cancels the reservations they made; owner and manager cancel any. */
export async function cancelReservation(
  ctx: MemberContext,
  id: string,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "not_found" }> {
  if (!UUID.test(id)) return { ok: false, error: "not_found" };
  return withStore(ctx, async (db) => {
    const [row] = await db.query<{ createdBy: string | null }>(
      `select created_by as "createdBy" from reservations where id = $1 and store_id = $2 and canceled_at is null`, [id, ctx.storeId],
    );
    if (!row) return { ok: false, error: "not_found" } as const;
    if (ctx.role === "seller" && row.createdBy !== ctx.membershipId) return { ok: false, error: "forbidden" } as const;
    const done = await db.query("update reservations set canceled_at = now() where id = $1 and canceled_at is null returning id", [id]);
    return done.length ? ({ ok: true } as const) : ({ ok: false, error: "not_found" } as const);
  });
}
