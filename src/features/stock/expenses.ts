import { reaisEmDigitos } from "@/lib/format";
import { UUID, withStore, type MemberContext } from "@/shared/db/client";
import { text } from "@/shared/form";
import { isIsoDate, todayIso } from "@/shared/today";

import { EXPENSE_LABEL, type Expense, type ExpenseCategory } from "./rules";

export type ExpenseInput = Omit<Expense, "id"> & { vehicleId: string };
type ExpenseField = "category" | "spentOn" | "amount" | "description";

export type AddExpenseResult =
  | { ok: true; id: string }
  | { ok: false; error: "forbidden" | "not_found" }
  | { ok: false; error: "invalid"; field: ExpenseField };

const MAX_DESCRIPTION = 200;
const MAX_AMOUNT = 9_999_999;

/** The form as typed: the amount keeps whole reais ("89,90" is 89), the rest is checked by addExpense. */
export function readExpense(form: FormData): { input: ExpenseInput } | { field: "amount" } {
  const digits = reaisEmDigitos(text(form, "amount"));
  if (!digits) return { field: "amount" };
  return {
    input: {
      vehicleId: text(form, "vehicleId"),
      category: text(form, "category") as ExpenseCategory,
      spentOn: text(form, "spentOn"),
      amount: Number(digits),
      description: text(form, "description"),
    },
  };
}

function invalidField(input: ExpenseInput, today: string): ExpenseField | null {
  if (!Object.hasOwn(EXPENSE_LABEL, input.category)) return "category";
  if (!isIsoDate(input.spentOn) || input.spentOn > today) return "spentOn";
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > MAX_AMOUNT) return "amount";
  if (input.description.trim().length > MAX_DESCRIPTION) return "description";
  return null;
}

/** A car's expenses, the latest first; null for a seller, who never reads them. */
export async function listExpenses(ctx: MemberContext, vehicleId: string): Promise<Expense[] | null> {
  if (ctx.role === "seller") return null;
  if (!UUID.test(vehicleId)) return [];
  const rows = await withStore(ctx, (db) =>
    db.query<Omit<Expense, "amount"> & { amount: string }>(
      `select id, category, to_char(spent_on, 'YYYY-MM-DD') as "spentOn", amount, description
         from vehicle_expenses where vehicle_id = $1 and store_id = $2
        order by spent_on desc, created_at desc`,
      [vehicleId, ctx.storeId],
    ),
  );
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

// RLS lets only owner and manager write expenses; the checks here pick the error to show.
export async function addExpense(ctx: MemberContext, input: ExpenseInput, today: string = todayIso()): Promise<AddExpenseResult> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  const field = invalidField(input, today);
  if (field) return { ok: false, error: "invalid", field };
  if (!UUID.test(input.vehicleId)) return { ok: false, error: "not_found" };

  return withStore(ctx, async (db): Promise<AddExpenseResult> => {
    const [row] = await db.query<{ id: string }>(
      `insert into vehicle_expenses (store_id, vehicle_id, category, spent_on, amount, description, created_by)
       select $1, v.id, $3, $4, $5, $6, $7 from vehicles v where v.id = $2 and v.store_id = $1 and v.status <> 'removed'
       returning id`,
      [ctx.storeId, input.vehicleId, input.category, input.spentOn, input.amount, input.description.trim(), ctx.membershipId],
    );
    return row ? { ok: true, id: row.id } : { ok: false, error: "not_found" };
  });
}

export async function removeExpense(
  ctx: MemberContext,
  expenseId: string,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "not_found" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (!UUID.test(expenseId)) return { ok: false, error: "not_found" };
  const rows = await withStore(ctx, (db) =>
    db.query("delete from vehicle_expenses where id = $1 and store_id = $2 returning id", [expenseId, ctx.storeId]),
  );
  return rows.length ? { ok: true } : { ok: false, error: "not_found" };
}
