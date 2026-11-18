"use server";

import { headers } from "next/headers";

import { createAuthDeps } from "@/features/auth/workos";
import { normalizePhone } from "@/features/leads/model";
import { text } from "@/shared/form";

import { createSiteLead } from "./model";
import type { InterestState } from "./rules";

/**
 * "Tenho interesse" on a car's page: the visitor becomes a new client of the store. Anyone on the internet can
 * call this, so nothing is written before Turnstile and the limit per IP pass.
 */
export async function sendInterestAction(_prev: InterestState, form: FormData): Promise<InterestState> {
  const typed = { name: text(form, "name").trim(), phone: text(form, "phone").trim() };
  const fail = (error: string): InterestState => ({ status: "error", error, typed });
  if (typed.name.length < 2 || typed.name.length > 80) return fail("Informe seu nome.");
  const phone = normalizePhone(typed.phone);
  if (!phone) return fail("Confira o WhatsApp com DDD.");

  const ip = (await headers()).get("cf-connecting-ip")?.trim() ?? "";
  const deps = createAuthDeps();
  if (!ip || !(await deps.verifyTurnstile(text(form, "cf-turnstile-response"), ip))) {
    return fail("Não foi possível confirmar que você é uma pessoa. Recarregue a página.");
  }
  if (!(await deps.rateLimit(`site:ip:${ip}`))) return fail("Muitas tentativas. Espere um minuto e tente de novo.");

  let received: boolean;
  try {
    received = await createSiteLead({ vehicleSlug: text(form, "vehicle"), name: typed.name, phone });
  } catch (error) {
    // Fixed fields only: a database message can carry the row, with the visitor's name and phone.
    console.error("Site interest failed", { name: (error as Error)?.name, code: (error as { code?: unknown })?.code });
    return fail("Não deu para enviar agora. Chame a loja no WhatsApp.");
  }
  return received ? { status: "sent" } : fail("Este carro saiu do site. Veja os outros ou chame no WhatsApp.");
}
