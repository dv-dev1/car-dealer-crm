"use server";

import { requireMember } from "@/features/auth/guard";
import { todayIso } from "@/shared/today";

import { generateAd } from "./ads";
import { dailySummary } from "./daily";
import { readVehicleDocument } from "./document";
import { draftMessage } from "./messages";
import { AI_ERROR, type AdTexts, type DocumentFields, type MessageKind } from "./rules";

const DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
// The same ceiling as a car photo: the form reduces the picture before sending it.
const MAX_DOCUMENT_BYTES = 2_000_000;

/** Reads the photo of a car's document for the new car form. The photo is not stored. */
export async function readDocumentAction(form: FormData): Promise<{ error: string } | { fields: DocumentFields }> {
  const member = await requireMember();
  if (member.role === "seller") return { error: "Só o dono e o gerente cadastram carro." };
  const photo = form.get("document");
  if (!(photo instanceof Blob) || !DOCUMENT_TYPES.includes(photo.type)) return { error: "Envie uma foto do documento em JPG, PNG ou WebP." };
  if (photo.size > MAX_DOCUMENT_BYTES) return { error: "A foto do documento passa de 2 MB." };
  const base64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  const result = await readVehicleDocument(member, todayIso(), { type: photo.type, base64 });
  return result.ok ? { fields: result.fields } : { error: AI_ERROR[result.reason] };
}

const AD_ERROR = { ...AI_ERROR, not_found: "Carro não encontrado." };

/** The car's ad for OLX, Instagram and WhatsApp. Every role. */
export async function generateAdAction(slug: string): Promise<{ error: string } | { ad: AdTexts }> {
  const member = await requireMember();
  const result = await generateAd(member, todayIso(), String(slug), member.storeName);
  return result.ok ? { ad: result.ad } : { error: AD_ERROR[result.reason] };
}

const MESSAGE_ERROR = { ...AI_ERROR, not_found: "Cliente não encontrado.", forbidden: "Este cliente é de outro vendedor." };

/** The WhatsApp message for a client, by the stage and the history. A seller only for his own client. */
export async function draftMessageAction(leadId: string): Promise<{ error: string } | { kind: MessageKind; text: string }> {
  const member = await requireMember();
  const result = await draftMessage(member, todayIso(), String(leadId), member.storeName);
  return result.ok ? { kind: result.kind, text: result.text } : { error: MESSAGE_ERROR[result.reason] };
}

/** The day's summary worded by the AI, for owner and manager. `byAi` false means the server's text stands. */
export async function dailySummaryAction(): Promise<{ error: string } | { text: string; byAi: boolean; aviso?: string }> {
  const member = await requireMember();
  const summary = await dailySummary(member, todayIso());
  if (!summary) return { error: "Só o dono e o gerente veem o resumo do dia." };
  if (summary.byAi) return { text: summary.text, byAi: true };
  const aviso =
    summary.reason === "numbers"
      ? "A IA citou um número que o servidor não calculou. O resumo acima segue valendo."
      : `${AI_ERROR[summary.reason ?? "failed"]} O resumo acima segue valendo.`;
  return { text: summary.text, byAi: false, aviso };
}
