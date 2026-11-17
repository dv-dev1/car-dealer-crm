"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import { reaisEmDigitos } from "@/lib/format";
import { text } from "@/shared/form";
import { todayIso } from "@/shared/today";

import { addChannel, setChannelActive, setChannelCost } from "./model";

export type ChannelState = { error: string | null; saved?: boolean };

const CHANNEL_ERROR = {
  forbidden: "Só o dono mexe nos canais.",
  invalid: "Confira o nome (até 40 letras) e o custo (em reais, sem centavos).",
  not_found: "Canal não encontrado.",
  duplicate: "Já existe um canal com este nome.",
} as const;

const done = (result: Awaited<ReturnType<typeof addChannel>>): ChannelState => {
  if (!result.ok) return { error: CHANNEL_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null, saved: true };
};

export async function addChannelAction(_prev: ChannelState, form: FormData): Promise<ChannelState> {
  return done(await addChannel(await requireMember(), text(form, "name")));
}

export async function setChannelActiveAction(_prev: ChannelState, form: FormData): Promise<ChannelState> {
  return done(await setChannelActive(await requireMember(), text(form, "id"), text(form, "active") === "1"));
}

/** The cost of the store's current month; an empty field is zero. */
export async function setChannelCostAction(_prev: ChannelState, form: FormData): Promise<ChannelState> {
  const member = await requireMember();
  const amount = reaisEmDigitos(text(form, "amount"));
  return done(await setChannelCost(member, text(form, "id"), `${todayIso().slice(0, 7)}-01`, Number(amount || "0")));
}
