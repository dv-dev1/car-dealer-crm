import type { Janela } from "@/features/reports/rules";
import { UUID, withStore, type MemberContext } from "@/shared/db/client";

export type CommissionKind = "fixed" | "sale_pct" | "profit_pct";
/** `value`: reais for "fixed", a typed percent otherwise (10 = 10%). `memberId` null is the store's rule. */
export type CommissionRule = { memberId: string | null; kind: CommissionKind; value: number };
export type CommissionSale = { id: string; soldOn: string; model: string; sellerName: string; price: number; commission: number };
export type Commissions = { sales: CommissionSale[]; bySeller: { sellerName: string; sales: number; total: number }[] };

const KINDS: readonly string[] = ["fixed", "sale_pct", "profit_pct"];
const MAX_FIXED = 1_000_000;
const isPct = (kind: CommissionKind) => kind !== "fixed";

/** The sales of the period with their commission; a seller gets only their own (sale_commissions filters it). */
export async function listCommissions(ctx: MemberContext, { de, ate }: Janela): Promise<Commissions> {
  const rows = await withStore(ctx, (db) =>
    db.query<{ id: string; soldOn: string; model: string; sellerName: string; price: string; commission: string }>(
      `select s.id, to_char(s.sold_on, 'YYYY-MM-DD') as "soldOn", v.brand || ' ' || v.model || ' ' || v.version as model,
              s.seller_name as "sellerName", s.price, c.commission
         from sale_commissions($1, $2) c
         join sales s on s.id = c.sale_id
         join vehicles v on v.id = s.vehicle_id
        order by s.sold_on desc, s.created_at desc`,
      [de, ate],
    ),
  );
  const sales = rows.map((r) => ({ ...r, price: Number(r.price), commission: Number(r.commission) }));
  const bySeller = new Map<string, { sellerName: string; sales: number; total: number }>();
  for (const sale of sales) {
    const row = bySeller.get(sale.sellerName) ?? { sellerName: sale.sellerName, sales: 0, total: 0 };
    row.sales += 1;
    row.total = Math.round((row.total + sale.commission) * 100) / 100;
    bySeller.set(sale.sellerName, row);
  }
  return { sales, bySeller: [...bySeller.values()].sort((a, b) => b.total - a.total) };
}

/** The store's rule and the exceptions; null for a seller, who never reads them. */
export async function listRules(ctx: MemberContext): Promise<CommissionRule[] | null> {
  if (ctx.role === "seller") return null;
  const rows = await withStore(ctx, (db) =>
    db.query<{ memberId: string | null; kind: CommissionKind; value: string }>(
      `select member_id as "memberId", kind, value from commission_rules where store_id = $1 order by member_id nulls first`,
      [ctx.storeId],
    ),
  );
  // Rounded: 0.07 * 100 is 7.000000000000001, and the form would refuse its own value.
  return rows.map((r) => ({ ...r, value: isPct(r.kind) ? Math.round(Number(r.value) * 10000) / 100 : Number(r.value) }));
}

type RuleResult = { ok: true } | { ok: false; error: "forbidden" | "invalid" };

/** Only the owner sets rules: % from 0,01 to 100 with two decimals; a fixed value in whole reais. */
export async function setRule(ctx: MemberContext, rule: CommissionRule): Promise<RuleResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  const { kind, value, memberId } = rule;
  const valid = KINDS.includes(kind) && (memberId === null || UUID.test(memberId)) &&
    (isPct(kind)
      ? value > 0 && value <= 100 && Math.abs(Math.round(value * 100) - value * 100) < 1e-9
      : Number.isInteger(value) && value >= 1 && value <= MAX_FIXED);
  if (!valid) return { ok: false, error: "invalid" };
  try {
    await withStore(ctx, (db) =>
      db.query(
        `insert into commission_rules (store_id, member_id, kind, value) values ($1, $2, $3, $4)
         on conflict (store_id, member_id) do update set kind = excluded.kind, value = excluded.value`,
        [ctx.storeId, memberId, kind, isPct(kind) ? (value / 100).toFixed(4) : value],
      ),
    );
  } catch (error) {
    // A member of another store breaks the foreign key: it is not this store's seller.
    if ((error as { code?: string }).code === "23503") return { ok: false, error: "invalid" };
    throw error;
  }
  return { ok: true };
}

/** Drops a seller's exception, so the store's rule applies to them again. The store's rule stays. */
export async function removeRule(ctx: MemberContext, memberId: string): Promise<RuleResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  if (!UUID.test(memberId)) return { ok: false, error: "invalid" };
  await withStore(ctx, (db) => db.query("delete from commission_rules where store_id = $1 and member_id = $2", [ctx.storeId, memberId]));
  return { ok: true };
}
