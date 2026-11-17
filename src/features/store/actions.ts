"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import { text } from "@/shared/form";

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
