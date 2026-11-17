"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import { reaisEmDigitos } from "@/lib/format";

import { removeRule, setRule, type CommissionKind } from "./model";

export type RuleState = { error: string | null; saved?: boolean };

const RULE_ERROR = {
  forbidden: "Só o dono define as regras de comissão.",
  invalid: "Confira a regra: valor fixo em reais, ou % de 0,01 a 100.",
} as const;

// A fixed value is whole reais as typed; a percent takes a comma or a dot and up to two decimals.
export async function setRuleAction(_prev: RuleState, form: FormData): Promise<RuleState> {
  const member = await requireMember();
  const kind = String(form.get("kind") ?? "") as CommissionKind;
  const raw = String(form.get("value") ?? "").trim();
  const value =
    kind === "fixed" ? Number(reaisEmDigitos(raw) || "0") : /^\d{1,3}([.,]\d{1,2})?$/.test(raw) ? Number(raw.replace(",", ".")) : 0;
  const result = await setRule(member, { memberId: String(form.get("memberId") ?? "") || null, kind, value });
  if (!result.ok) return { error: RULE_ERROR[result.error] };
  revalidatePath("/gestao/comissoes");
  return { error: null, saved: true };
}

export async function removeRuleAction(_prev: RuleState, form: FormData): Promise<RuleState> {
  const member = await requireMember();
  const result = await removeRule(member, String(form.get("memberId") ?? ""));
  if (!result.ok) return { error: RULE_ERROR[result.error] };
  revalidatePath("/gestao/comissoes");
  return { error: null };
}
