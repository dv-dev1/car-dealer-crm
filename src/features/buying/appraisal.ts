import { withStore, type MemberContext } from "@/shared/db/client";

export type AppraisalDefaults = { days: number; marginPct: number; monthlyRate: number; modelSales: number };

/**
 * What the store's last twelve months say about a car like this: the days this model takes to sell (or the store's
 * average, or 45), the store's margin held between 5% and 20% (10% with no sale), and the store's cost of money.
 * Null for a seller, who reads no profit.
 */
export async function appraisalDefaults(ctx: MemberContext, brand: string, model: string, today: string): Promise<AppraisalDefaults | null> {
  if (ctx.role === "seller") return null;
  const [row] = await withStore(ctx, (db) =>
    db.query<{ rate: string; modelSales: number; modelDays: number | null; storeDays: number | null; margin: number | null }>(
      `with sold as (
         select greatest(s.sold_on - v.entered_on, 1) as days, s.price, p.profit,
                lower(v.brand) = lower($3) and lower(v.model) = lower($4) as same_model
           from sales s join vehicles v on v.id = s.vehicle_id join sale_profits p on p.sale_id = s.id
          where s.store_id = $1 and s.sold_on > $2::date - interval '1 year' and s.sold_on <= $2::date
       )
       select (select money_rate from stores where id = $1) as rate,
              count(*) filter (where same_model)::int as "modelSales",
              round(avg(days) filter (where same_model))::int as "modelDays",
              round(avg(days))::int as "storeDays",
              (sum(profit) / nullif(sum(price), 0) * 100)::float8 as margin
         from sold`,
      [ctx.storeId, today, brand.trim(), model.trim()],
    ),
  );
  return {
    days: row.modelDays ?? row.storeDays ?? 45,
    marginPct: row.margin === null ? 10 : Math.min(20, Math.max(5, Math.round(row.margin))),
    monthlyRate: Number(row.rate),
    modelSales: row.modelSales,
  };
}
