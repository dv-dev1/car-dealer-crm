"use server";

import { requireMember } from "@/features/auth/guard";
import { reaisEmDigitos } from "@/lib/format";
import { todayIso } from "@/shared/today";

import { appraisalDefaults } from "./appraisal";
import { CONDITION, appraise, referencePrice, type AppraisalState, type Condition } from "./rules";

const FIELDS = ["brand", "model", "year", "km", "condition", "reference", "marginPct"] as const;

/** Appraises a car offered in a trade, with the store's own history. Owner and manager only. Saves nothing. */
export async function appraiseAction(_prev: AppraisalState, form: FormData): Promise<AppraisalState> {
  const member = await requireMember();
  if (member.role === "seller") return { error: "Só o dono e o gerente avaliam a troca." };

  const typed = Object.fromEntries(FIELDS.map((name) => [name, String(form.get(name) ?? "").trim()]));
  const fail = (error: string): AppraisalState => ({ error, typed });
  // Whole numbers as a person types them ("48.000"); empty is null.
  const whole = (name: string) => (reaisEmDigitos(typed[name]) === "" ? null : Number(reaisEmDigitos(typed[name])));

  const today = todayIso();
  const thisYear = Number(today.slice(0, 4));
  const { brand, model, condition } = typed;
  const year = whole("year");
  const km = whole("km");
  const typedReference = whole("reference");
  const typedMargin = whole("marginPct");
  if (!brand || !model || brand.length > 40 || model.length > 40) return fail("Informe a marca e o modelo.");
  if (year === null || year < 1980 || year > thisYear + 1) return fail("Confira o ano do carro.");
  if (km === null || km > 999_999) return fail("Informe a quilometragem.");
  if (!Object.hasOwn(CONDITION, condition)) return fail("Escolha o estado do carro.");
  if (typedReference !== null && (typedReference < 1000 || typedReference > 9_999_999)) return fail("Confira o valor da FIPE.");
  if (typedMargin !== null && (typedMargin < 1 || typedMargin > 40)) return fail("A margem vai de 1% a 40%.");

  const reference = typedReference ?? referencePrice(brand, model, year);
  if (reference === null) return fail("Este modelo e ano não estão na tabela de exemplo. Digite o valor da FIPE.");
  const defaults = await appraisalDefaults(member, brand, model, today);
  if (!defaults) return fail("Só o dono e o gerente avaliam a troca.");
  const marginPct = typedMargin ?? defaults.marginPct;

  return {
    error: null,
    typed,
    input: { brand, model, year, km, condition: condition as Condition, reference, marginPct },
    result: appraise({ reference, year, km, condition: condition as Condition, days: defaults.days, marginPct, monthlyRate: defaults.monthlyRate }, thisYear),
    modelSales: defaults.modelSales,
  };
}
