"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import { reaisEmDigitos } from "@/lib/format";
import { text } from "@/shared/form";
import { todayIso } from "@/shared/today";

import { addStoreExpense, removeStoreExpense, type StoreExpenseCategory } from "./expenses";
import { readRatePct, setMoneyRate } from "./model";

export type StoreSettingsState = { error: string | null; saved?: boolean };

const RATE_ERROR = {
  forbidden: "Só o dono e o gerente mudam os ajustes da loja.",
  invalid: "A taxa vai de 0 a 10% ao mês, com até duas casas (ex.: 1,5).",
} as const;

export async function setMoneyRateAction(_prev: StoreSettingsState, form: FormData): Promise<StoreSettingsState> {
  const member = await requireMember();
  const pct = readRatePct(text(form, "moneyRate"));
  if (pct === null) return { error: RATE_ERROR.invalid };
  const result = await setMoneyRate(member, pct);
  if (!result.ok) return { error: RATE_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null, saved: true };
}

const EXPENSE_ERROR = {
  forbidden: "Só o dono lança as despesas fixas.",
  invalid: "Confira a despesa: categoria, valor em reais (sem centavos) e descrição de até 200 letras.",
  not_found: "Despesa não encontrada.",
} as const;

/** A fixed expense of the store's current month. */
export async function addStoreExpenseAction(_prev: StoreSettingsState, form: FormData): Promise<StoreSettingsState> {
  const member = await requireMember();
  const result = await addStoreExpense(member, {
    month: `${todayIso().slice(0, 7)}-01`,
    category: text(form, "category") as StoreExpenseCategory,
    description: text(form, "description"),
    amount: Number(reaisEmDigitos(text(form, "amount")) || "0"),
  });
  if (!result.ok) return { error: EXPENSE_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null, saved: true };
}

export async function removeStoreExpenseAction(_prev: StoreSettingsState, form: FormData): Promise<StoreSettingsState> {
  const member = await requireMember();
  const result = await removeStoreExpense(member, text(form, "id"));
  if (!result.ok) return { error: EXPENSE_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null };
}
