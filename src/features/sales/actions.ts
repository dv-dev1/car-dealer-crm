"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "@/features/auth/guard";
import type { ActionState } from "@/features/leads/actions";
import { todayIso } from "@/shared/today";
import { text } from "@/shared/form";

import { recordSale, type SaleInput } from "./model";

const FIELD_LABEL: Record<keyof SaleInput, string> = {
  vehicleId: "Carro",
  leadId: "Cliente",
  sellerId: "Vendedor",
  price: "Valor da venda",
  payment: "Forma de pagamento",
  bank: "Banco",
  financedAmount: "Valor financiado",
  soldOn: "Data da venda",
};

const SALE_ERROR = {
  forbidden: "Você só registra a venda dos seus clientes.",
  not_found: "Carro ou cliente não encontrado.",
  not_available: "Este carro já foi vendido ou removido.",
  lead_closed: "Este cliente já foi fechado.",
} as const;

const invalid = (field: keyof SaleInput): ActionState => ({ error: `Confira o campo: ${FIELD_LABEL[field]}.`, field });

// Money arrives as digits only (the form strips the rest); anything else is a typing error, not a guess.
export async function recordSaleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const member = await requireMember();
  const payment = text(form, "payment") as SaleInput["payment"];
  const price = text(form, "price");
  if (!/^\d+$/.test(price)) return invalid("price");
  const financed = text(form, "financedAmount");
  if (payment === "financing" && !/^\d+$/.test(financed)) return invalid("financedAmount");

  const result = await recordSale(member, {
    vehicleId: text(form, "vehicleId"),
    leadId: text(form, "leadId") || null,
    sellerId: text(form, "sellerId") || null,
    price: Number(price),
    payment,
    bank: payment === "financing" ? text(form, "bank").trim() || null : null,
    financedAmount: payment === "financing" ? Number(financed) : null,
    soldOn: todayIso(),
  });
  if (!result.ok) {
    if (result.error !== "invalid") return { error: SALE_ERROR[result.error] };
    // record_sale itself refuses without a field only when the model's checks were bypassed.
    return result.field ? invalid(result.field) : { error: "Confira os dados da venda." };
  }
  revalidatePath("/gestao", "layout");
  return { error: null, id: result.id };
}
