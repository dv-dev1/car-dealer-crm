"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import { text } from "@/shared/form";
import { todayIso } from "@/shared/today";

import { setStoreGoal } from "./model";

export type GoalState = { error: string | null };

const GOAL_ERROR = {
  forbidden: "Só dono e gerente definem a meta.",
  invalid: "A meta vai de 1 a 99 carros.",
} as const;

/** Sets the store goal of the store's current month; reads `cars`. */
export async function setGoalAction(_prev: GoalState, form: FormData): Promise<GoalState> {
  const member = await requireMember();
  const raw = text(form, "cars").trim();
  const result = await setStoreGoal(member, /^\d{1,3}$/.test(raw) ? Number(raw) : Number.NaN, todayIso());
  if (!result.ok) return { error: GOAL_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null };
}
