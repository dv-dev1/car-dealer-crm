import { UUID, withStore, type MemberContext } from "@/shared/db/client";

export type StoreExpenseCategory = "rent" | "payroll" | "accountant" | "utilities" | "other";
export type StoreExpense = { id: string; category: StoreExpenseCategory; description: string; amount: number };
export type StoreExpenseInput = Omit<StoreExpense, "id"> & { month: string };
/** `carsLeft`: 0 when the month is paid; null with nothing to pay yet or no profitable sale in the three months before. */
export type MonthBreakEven = { fixed: number; channels: number; profit: number; avgProfitPerCar: number | null; carsLeft: number | null };

const CATEGORIES: readonly string[] = ["rent", "payroll", "accountant", "utilities", "other"];
const isMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value);

/** The fixed expenses of `month` ("YYYY-MM-01"); only the owner reads them. */
export async function listStoreExpenses(ctx: MemberContext, month: string): Promise<StoreExpense[] | null> {
  if (ctx.role !== "owner" || !isMonth(month)) return null;
  const rows = await withStore(ctx, (db) =>
    db.query<Omit<StoreExpense, "amount"> & { amount: string }>(
      "select id, category, description, amount from store_expenses where store_id = $1 and month = $2 order by amount desc, id",
      [ctx.storeId, month],
    ),
  );
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function addStoreExpense(
  ctx: MemberContext,
  input: StoreExpenseInput,
): Promise<{ ok: true; id: string } | { ok: false; error: "forbidden" | "invalid" }> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  const description = input.description.trim();
  if (
    !isMonth(input.month) || !CATEGORIES.includes(input.category) || description.length > 200 ||
    !Number.isInteger(input.amount) || input.amount < 1 || input.amount > 9_999_999
  ) {
    return { ok: false, error: "invalid" };
  }
  const [row] = await withStore(ctx, (db) =>
    db.query<{ id: string }>(
      "insert into store_expenses (store_id, month, category, description, amount) values ($1, $2, $3, $4, $5) returning id",
      [ctx.storeId, input.month, input.category, description, input.amount],
    ),
  );
  return { ok: true, id: row.id };
}

export async function removeStoreExpense(
  ctx: MemberContext,
  id: string,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "not_found" }> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  if (!UUID.test(id)) return { ok: false, error: "not_found" };
  const rows = await withStore(ctx, (db) =>
    db.query("delete from store_expenses where id = $1 and store_id = $2 returning id", [id, ctx.storeId]),
  );
  return rows.length ? { ok: true } : { ok: false, error: "not_found" };
}

/**
 * How many cars are left to pay the month of `today`: fixed expenses plus the channels' cost, less the profit
 * already made this month, over the average profit per car of the three months before. Only for the owner.
 */
export async function monthBreakEven(ctx: MemberContext, today: string): Promise<MonthBreakEven | null> {
  if (ctx.role !== "owner") return null;
  const month = `${today.slice(0, 7)}-01`;
  const [row] = await withStore(ctx, (db) =>
    db.query<{ fixed: string; channels: string; profit: string; avg: string | null }>(
      `select (select coalesce(sum(amount), 0) from store_expenses where store_id = $1 and month = $2) as fixed,
              (select coalesce(sum(amount), 0) from channel_costs where store_id = $1 and month = $2) as channels,
              (select coalesce(sum(p.profit), 0) from sales s join sale_profits p on p.sale_id = s.id
                where s.store_id = $1 and s.sold_on >= $2::date and s.sold_on < $2::date + interval '1 month') as profit,
              (select avg(p.profit) from sales s join sale_profits p on p.sale_id = s.id
                where s.store_id = $1 and s.sold_on >= $2::date - interval '3 months' and s.sold_on < $2::date) as avg`,
      [ctx.storeId, month],
    ),
  );
  const fixed = Number(row.fixed);
  const channels = Number(row.channels);
  const profit = Number(row.profit);
  const avgProfitPerCar = row.avg === null ? null : Number(row.avg);
  // Nothing entered is not a paid month.
  const carsLeft =
    fixed + channels === 0 || avgProfitPerCar === null || avgProfitPerCar <= 0
      ? null
      : Math.max(0, Math.ceil((fixed + channels - profit) / avgProfitPerCar));
  return { fixed, channels, profit, avgProfitPerCar, carsLeft };
}
