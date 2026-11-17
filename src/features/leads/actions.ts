"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import { recordContact, type ContactKind } from "@/features/leads/contacts";
import { text } from "@/shared/form";

import { createLead, loseLead, moveLead, updateLead, type ActiveStage, type LeadInput, type LeadResult } from "./model";

export type ActionState = { error: string | null; field?: string; id?: string };

const FIELD_LABEL: Record<keyof LeadInput, string> = {
  name: "Nome",
  phone: "Telefone",
  stage: "Etapa",
  vehicleId: "Carro",
  interest: "Interesse",
  channelId: "Origem",
  sellerId: "Vendedor",
  note: "Observações",
  lastContactOn: "Conversou em",
  visitOn: "Visita",
  visitTime: "Horário da visita",
  cameOn: "Veio em",
  callBackOn: "Retornar em",
};

const LEAD_ERROR = {
  forbidden: "Você só mexe nos seus clientes.",
  not_found: "Cliente não encontrado.",
  not_editable: "Este cliente já foi fechado.",
} as const;

function readLead(form: FormData): LeadInput {
  const optional = (name: string) => text(form, name).trim() || null;
  return {
    name: text(form, "name"),
    phone: text(form, "phone"),
    stage: text(form, "stage") as ActiveStage,
    vehicleId: optional("vehicleId"),
    interest: optional("interest"),
    channelId: optional("channelId"),
    sellerId: optional("sellerId"),
    note: text(form, "note"),
    lastContactOn: optional("lastContactOn"),
    visitOn: optional("visitOn"),
    visitTime: optional("visitTime"),
    cameOn: optional("cameOn"),
    callBackOn: optional("callBackOn"),
  };
}

function answer(result: LeadResult): ActionState {
  if (result.ok) {
    revalidatePath("/gestao", "layout");
    return { error: null, id: result.id };
  }
  if (result.error !== "invalid") return { error: LEAD_ERROR[result.error] };
  // Only loseLead refuses without a field: the reason is too long.
  return result.field ? { error: `Confira o campo: ${FIELD_LABEL[result.field]}.`, field: result.field } : { error: "Confira o campo: Motivo." };
}

export async function createLeadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const member = await requireMember();
  return answer(await createLead(member, readLead(form)));
}

export async function updateLeadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const member = await requireMember();
  return answer(await updateLead(member, text(form, "id"), readLead(form)));
}

export async function moveLeadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const member = await requireMember();
  return answer(await moveLead(member, text(form, "id"), text(form, "stage") as ActiveStage));
}

export async function loseLeadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const member = await requireMember();
  return answer(await loseLead(member, text(form, "id"), text(form, "reason") || null));
}

/** Fired when the seller taps WhatsApp or call on a client, or says they talked to them. A refusal changes nothing on screen. */
export async function recordContactAction(leadId: string, kind: ContactKind): Promise<void> {
  const member = await requireMember();
  const result = await recordContact(member, leadId, kind);
  if (result.ok) revalidatePath("/gestao", "layout");
}
