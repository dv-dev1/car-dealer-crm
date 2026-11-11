"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import type { Role } from "@/shared/db/client";

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
const ROLES: string[] = ["owner", "manager", "seller"];

// FormData values can be null or a File: anything that is not a string counts as empty.
function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function finish(result: { ok: true } | { ok: false; error: keyof typeof MESSAGES }): TeamState {
  if (!result.ok) return { error: MESSAGES[result.error] };
  revalidatePath("/gestao/equipe");
  return { error: null };
}

// The caller (store, role) comes from the session through requireMember(), never from the form.
export async function addMemberAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const member = await requireMember();
  const role = text(form, "role");
  if (!ROLES.includes(role)) return { error: MESSAGES.forbidden };
  return finish(await addMember(member, { name: text(form, "name"), email: text(form, "email"), role: role as Role }));
}

export async function removeMemberAction(_prev: TeamState, form: FormData): Promise<TeamState> {
  const member = await requireMember();
  return finish(await removeMember(member, text(form, "membershipId")));
}
