"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import type { ActionState } from "@/features/leads/actions";
import { todayIso } from "@/shared/today";

import { setTransferDone } from "./after-sale";
import { readSale, recordSale, type SaleInput } from "./model";

const FIELD_LABEL: Record<keyof SaleInput, string> = {
  vehicleId: "Carro",
  leadId: "Cliente",
  sellerId: "Vendedor",
  price: "Valor da venda",
  payment: "Forma de pagamento",
  bank: "Banco",
  financedAmount: "Valor financiado",
  soldOn: "Data da venda",
  returnPct: "% de retorno do banco",
  tradeIn: "Carro na troca",
};

const SALE_ERROR = {
  forbidden: "Você só registra a venda dos seus clientes.",
  not_found: "Carro ou cliente não encontrado.",
  not_available: "Este carro já foi vendido ou removido.",
  lead_closed: "Este cliente já foi fechado.",
  reserved: "Este carro está reservado para outro cliente.",
} as const;

const invalid = (field: keyof SaleInput): ActionState => ({ error: `Confira o campo: ${FIELD_LABEL[field]}.`, field });

export async function recordSaleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const member = await requireMember();
  const read = readSale(form);
  if ("field" in read) return invalid(read.field);
  const result = await recordSale(member, { ...read.input, soldOn: todayIso() });
  if (!result.ok) {
    if (result.error !== "invalid") return { error: SALE_ERROR[result.error] };
    // record_sale itself refuses without a field only when the model's checks were bypassed.
    return result.field ? invalid(result.field) : { error: "Confira os dados da venda." };
  }
  revalidatePath("/gestao", "layout");
  return { error: null, id: result.id };
}

/** The transfer button of the after-sale screen; a refusal leaves the screen as it was. */
export async function setTransferDoneAction(form: FormData): Promise<void> {
  const member = await requireMember();
  const result = await setTransferDone(member, String(form.get("saleId") ?? ""), form.get("done") === "1", todayIso());
  if (result.ok) revalidatePath("/gestao", "layout");
}
