"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import { ROLES } from "@/shared/db/client";
import { text } from "@/shared/form";

import { addMember, removeMember } from "./model";

export type TeamState = { error: string | null; typed?: { name: string; email: string; role: string } };

const MESSAGES = {
  forbidden: "Só o dono pode fazer isso.",
  owner_only: "Só o dono pode fazer isso.",
  invalid_email: "Digite um e-mail válido.",
  invalid_name: "Digite o nome.",
  duplicate: "Este e-mail já está na equipe.",
  last_owner: "A loja precisa ter pelo menos um dono.",
  not_found: "Esta pessoa não está mais na equipe.",
  self: "Você não pode se remover. Peça a outro dono.",
};

function finish(result: { ok: true } | { ok: false; error: keyof typeof MESSAGES }): TeamState {
  if (!result.ok) return { error: MESSAGES[result.error] };
  revalidatePath("/gestao/equipe");
  return { error: null };
}

// The caller (store, role) comes from the session through requireMember(), never from the form.
export async function addMemberAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const member = await requireMember();
  const formRole = text(form, "role");
  const role = ROLES.find((value) => value === formRole);
  if (!role) return { error: MESSAGES.forbidden };
  const input = { name: text(form, "name"), email: text(form, "email"), role };
  const result = await addMember(member, input);
  // The form resets after the action: what was typed comes back as its default values.
  return result.ok ? finish(result) : { ...finish(result), typed: input };
}

export async function removeMemberAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const member = await requireMember();
  return finish(await removeMember(member, text(form, "membershipId")));
}
