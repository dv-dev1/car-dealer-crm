import { withStore, type MemberContext } from "@/shared/db/client";

import { PRICE_BANDS, buyingVerdict, type BuyingRow } from "./rules";

type Group = { sold: number; avgDays: number; avgProfit: number; profitPerDay: number };
export type BuyingReport = { byModel: BuyingRow[]; byBand: BuyingRow[]; store: Group | null };

type Sale = { model: string; price: number; days: number; profit: number };

function group(sales: Sale[]): Group {
  const days = sales.reduce((sum, s) => sum + s.days, 0);
  const profit = sales.reduce((sum, s) => sum + s.profit, 0);
  return { sold: sales.length, avgDays: days / sales.length, avgProfit: profit / sales.length, profitPerDay: profit / days };
}

/**
 * What the store sold in the last twelve months, by model and by price band: how many, how long each took, what it
 * earned and what it earned per day in the yard. Null for a seller, who reads no profit.
 */
export async function buyingReport(ctx: MemberContext, today: string): Promise<BuyingReport | null> {
  if (ctx.role === "seller") return null;
  const sales = await withStore(ctx, (db) =>
    db.query<{ model: string; price: string; days: number; profit: string }>(
      // A car sold the day it came in still took a day of the yard.
      `select v.brand || ' ' || v.model as model, s.price, greatest(s.sold_on - v.entered_on, 1) as days, p.profit
         from sales s join vehicles v on v.id = s.vehicle_id join sale_profits p on p.sale_id = s.id
        where s.store_id = $1 and s.sold_on > $2::date - interval '1 year' and s.sold_on <= $2::date`,
      [ctx.storeId, today],
    ),
  ).then((rows) => rows.map((r) => ({ ...r, price: Number(r.price), profit: Number(r.profit) })));
  if (sales.length === 0) return { byModel: [], byBand: [], store: null };

  const store = group(sales);
  const rows = (keyOf: (sale: Sale) => { key: string; label: string }): BuyingRow[] => {
    const groups = new Map<string, { label: string; sales: Sale[] }>();
    for (const sale of sales) {
      const { key, label } = keyOf(sale);
      groups.set(key, { label, sales: [...(groups.get(key)?.sales ?? []), sale] });
    }
    return [...groups]
      .map(([key, g]) => {
        const numbers = group(g.sales);
        return { key, label: g.label, ...numbers, verdict: buyingVerdict(numbers, store.profitPerDay) };
      })
      .sort((a, b) => b.profitPerDay - a.profitPerDay || a.label.localeCompare(b.label));
  };
  return {
    byModel: rows((s) => ({ key: s.model, label: s.model })),
    byBand: rows((s) => PRICE_BANDS.find((band) => s.price <= band.upTo)!),
    store,
  };
}
