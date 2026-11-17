import { withStore, type MemberContext } from "@/shared/db/client";

export type StoreSettings = { moneyRate: number; staleLeadDays: number; warrantyDays: number };

export async function getStoreSettings(ctx: MemberContext): Promise<StoreSettings> {
  const [row] = await withStore(ctx, (db) =>
    db.query<{ moneyRate: string; staleLeadDays: number; warrantyDays: number }>(
      `select money_rate as "moneyRate", stale_lead_days as "staleLeadDays", warranty_days as "warrantyDays" from stores where id = $1`,
      [ctx.storeId],
    ),
  );
  return { ...row, moneyRate: Number(row.moneyRate) };
}

/** `pct` is a percent a month, as typed: 1.5 is 1,5% (0.015). From 0 to 10, at most two decimals. */
export async function setMoneyRate(ctx: MemberContext, pct: number): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (!Number.isFinite(pct) || pct < 0 || pct > 10 || Math.abs(Math.round(pct * 100) - pct * 100) > 1e-9) return { ok: false, error: "invalid" };
  await withStore(ctx, (db) => db.query("update stores set money_rate = $2 where id = $1", [ctx.storeId, (pct / 100).toFixed(4)]));
  return { ok: true };
}

/** After how many days without contact an open client counts as stale: 1 to 30. */
export async function setStaleLeadDays(ctx: MemberContext, days: number): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (!Number.isInteger(days) || days < 1 || days > 30) return { ok: false, error: "invalid" };
  await withStore(ctx, (db) => db.query("update stores set stale_lead_days = $2 where id = $1", [ctx.storeId, days]));
  return { ok: true };
}

/** The warranty of the next sales, in days from the sale: 0 (no warranty) to 365. */
export async function setWarrantyDays(ctx: MemberContext, days: number): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (!Number.isInteger(days) || days < 0 || days > 365) return { ok: false, error: "invalid" };
  await withStore(ctx, (db) => db.query("update stores set warranty_days = $2 where id = $1", [ctx.storeId, days]));
  return { ok: true };
}

/** The rate as a person types it, in percent ("1,5", "0.75"); null when it is not a number with up to two decimals. */
export function readRatePct(raw: string): number | null {
  const value = raw.trim();
  return /^\d{1,2}([.,]\d{1,2})?$/.test(value) ? Number(value.replace(",", ".")) : null;
}
