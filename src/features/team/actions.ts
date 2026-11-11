"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import { ROLES } from "@/shared/db/client";
import { text } from "@/shared/form";

import { addMember, removeMember } from "./model";

export type TeamState = { error: string | null };

const MESSAGES = {
  forbidden: "Só o dono pode fazer isso.",
  owner_only: "Só o dono pode fazer isso.",
  invalid_email: "Digite um e-mail válido.",
  invalid_name: "Digite o nome.",
  duplicate: "Este e-mail já está na equipe.",
  last_owner: "A loja precisa ter pelo menos um dono.",
  not_found: "Esta pessoa não está mais na equipe.",
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
  return finish(await addMember(member, { name: text(form, "name"), email: text(form, "email"), role }));
}

export async function removeMemberAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const member = await requireMember();
  return finish(await removeMember(member, text(form, "membershipId")));
}
