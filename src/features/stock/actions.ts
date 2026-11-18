"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMember } from "@/features/auth/guard";
import { reaisEmDigitos } from "@/lib/format";

import {
  createVehicle, removeVehicle, returnToStore, setAway, setMargin, updateVehicle, type AwayReason, type RemoveReason, type VehicleInput,
} from "./model";
import { setDocument } from "./documents";
import { addExpense, readExpense, removeExpense } from "./expenses";
import { registrationText, type DocumentItem, type DocumentStatus } from "./rules";
import { cancelReservation, createReservation } from "./reservations";
import { addVehiclePhoto, photoBucket, removeVehiclePhoto } from "./photos";

export type VehicleFormState = { error: string | null; field?: keyof VehicleInput; id?: string; slug?: string };

const FIELD_LABEL: Record<keyof VehicleInput, string> = {
  brand: "Marca",
  model: "Modelo",
  version: "Versão",
  modelYear: "Ano do modelo",
  manufactureYear: "Ano de fabricação",
  km: "KM",
  color: "Cor",
  fuel: "Combustível",
  transmission: "Câmbio",
  bodyType: "Categoria",
  doors: "Portas",
  description: "Descrição",
  features: "Opcionais",
  featured: "Destacar na home",
  price: "Preço de venda",
  acquisitionCost: "Preço de compra",
  enteredOn: "Data de aquisição",
  ready: "Pronto para anunciar",
  source: "Origem",
  consignorName: "Nome do dono do carro",
  consignorPhone: "WhatsApp do dono do carro",
  plate: "Placa",
  renavam: "Renavam",
  chassis: "Chassi",
};

const SAVE_ERROR = {
  forbidden: "Só o dono e o gerente mexem no estoque.",
  not_found: "Carro não encontrado.",
  not_editable: "Este carro já foi vendido ou removido e não pode ser editado.",
} as const;

const PHOTO_ERROR = {
  forbidden: "Só o dono e o gerente mexem no estoque.",
  not_found: "Carro não encontrado.",
  too_big: "Foto acima de 2 MB.",
  not_image: "Formato de foto não aceito; use JPG, PNG ou WebP.",
  too_many: "Limite de 20 fotos por carro.",
} as const;

const invalid = (field: keyof VehicleInput, consigned = false): VehicleFormState => ({
  error: `Confira o campo: ${consigned && field === "acquisitionCost" ? "Valor a repassar ao dono" : FIELD_LABEL[field]}.`,
  field,
});
const NUMBERS = ["manufactureYear", "modelYear", "km", "price", "acquisitionCost"] as const;

// Numbers arrive as digits only (the form strips the rest); anything else is a typing error, not a guess.
function readVehicle(form: FormData): { input: VehicleInput } | { field: keyof VehicleInput } {
  const value = (name: string) => String(form.get(name) ?? "");
  const numbers = {} as Record<(typeof NUMBERS)[number], number>;
  for (const name of NUMBERS) {
    if (!/^\d+$/.test(value(name))) return { field: name };
    numbers[name] = Number(value(name));
  }
  const doors = value("doors");
  if (doors && !/^\d+$/.test(doors)) return { field: "doors" };
  const input: VehicleInput = {
    brand: value("brand"),
    model: value("model"),
    version: value("version"),
    ...numbers,
    color: value("color") || null,
    fuel: value("fuel"),
    transmission: value("transmission"),
    bodyType: value("bodyType") || null,
    doors: doors ? Number(doors) : null,
    description: value("description"),
    features: form.getAll("features").map(String),
    featured: form.get("featured") === "on",
    enteredOn: value("enteredOn"),
    ready: form.get("ready") === "on",
    source: value("source") === "consignment" ? "consignment" : "purchase",
    consignorName: value("consignorName") || null,
    consignorPhone: value("consignorPhone") || null,
    plate: registrationText(value("plate")) || null,
    renavam: registrationText(value("renavam")) || null,
    chassis: registrationText(value("chassis")) || null,
  };
  return { input };
}

export async function saveVehicleAction(_prev: VehicleFormState, form: FormData): Promise<VehicleFormState> {
  const member = await requireMember();
  const consigned = form.get("source") === "consignment";
  const read = readVehicle(form);
  if ("field" in read) return invalid(read.field, consigned);
  const id = String(form.get("id") ?? "");
  const result = id ? await updateVehicle(member, id, read.input) : await createVehicle(member, read.input);
  if (!result.ok) return result.error === "invalid" ? invalid(result.field!, consigned) : { error: SAVE_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null, id: result.id, slug: result.slug };
}

export async function addPhotoAction(form: FormData): Promise<{ error: string | null; id?: string }> {
  const member = await requireMember();
  const photo = form.get("photo");
  if (!(photo instanceof Blob)) return { error: PHOTO_ERROR.not_image };
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const result = await addVehiclePhoto(member, photoBucket(), String(form.get("vehicleId") ?? ""), bytes);
  if (!result.ok) return { error: PHOTO_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null, id: result.id };
}

export async function removePhotoAction(form: FormData): Promise<{ error: string | null }> {
  const member = await requireMember();
  const result = await removeVehiclePhoto(member, photoBucket(), String(form.get("photoId") ?? ""));
  if (!result.ok) return { error: PHOTO_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null };
}

export type StockActionState = { error: string | null };

const MARGIN_ERROR = {
  forbidden: "Só o dono e o gerente mexem no estoque.",
  not_found: "Carro não encontrado.",
  invalid: "O desconto precisa ser menor que o preço.",
} as const;

const REMOVE_ERROR = {
  forbidden: "Só o dono e o gerente mexem no estoque.",
  not_found: "Carro não encontrado.",
  invalid: "Este carro não pode sair do estoque por esse motivo.",
} as const;

// An empty discount clears the margin; anything but digits is a typing error.
export async function setMarginAction(_prev: StockActionState, form: FormData): Promise<StockActionState> {
  const member = await requireMember();
  const discount = String(form.get("discount") ?? "");
  if (discount && !/^\d+$/.test(discount)) return { error: MARGIN_ERROR.invalid };
  const result = await setMargin(member, String(form.get("vehicleId") ?? ""), discount ? Number(discount) : null);
  if (!result.ok) return { error: MARGIN_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null };
}

export async function removeVehicleAction(_prev: StockActionState, form: FormData): Promise<StockActionState> {
  const member = await requireMember();
  const reason = String(form.get("reason") ?? "") as RemoveReason;
  const result = await removeVehicle(member, String(form.get("vehicleId") ?? ""), reason);
  if (!result.ok) return { error: REMOVE_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  redirect("/gestao/estoque");
}

export type ExpenseFormState = { error: string | null; field?: "category" | "spentOn" | "amount" | "description" };

const EXPENSE_FIELD_ERROR = {
  category: "Escolha a categoria da despesa.",
  spentOn: "Confira a data: não pode passar de hoje.",
  amount: "Confira o valor: de R$ 1 a R$ 9.999.999.",
  description: "A descrição vai até 200 letras.",
} as const;

const EXPENSE_ERROR = {
  forbidden: "Só o dono e o gerente lançam despesas.",
  not_found: "Carro ou despesa não encontrados.",
} as const;

export async function addExpenseAction(_prev: ExpenseFormState, form: FormData): Promise<ExpenseFormState> {
  const member = await requireMember();
  const read = readExpense(form);
  if ("field" in read) return { error: EXPENSE_FIELD_ERROR.amount, field: "amount" };
  const result = await addExpense(member, read.input);
  if (!result.ok) {
    return result.error === "invalid" ? { error: EXPENSE_FIELD_ERROR[result.field], field: result.field } : { error: EXPENSE_ERROR[result.error] };
  }
  revalidatePath("/gestao", "layout");
  return { error: null };
}

export async function removeExpenseAction(_prev: StockActionState, form: FormData): Promise<StockActionState> {
  const member = await requireMember();
  const result = await removeExpense(member, String(form.get("expenseId") ?? ""));
  if (!result.ok) return { error: EXPENSE_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null };
}

const AWAY_ERROR = {
  forbidden: "Só o dono e o gerente mexem no estoque.",
  not_found: "Só carro à venda (disponível ou reservado) sai da loja.",
  invalid: "Confira o motivo e a volta prevista (hoje ou depois).",
} as const;

export async function setAwayAction(_prev: StockActionState, form: FormData): Promise<StockActionState> {
  const member = await requireMember();
  const until = String(form.get("until") ?? "");
  const result = await setAway(member, String(form.get("vehicleId") ?? ""), String(form.get("reason") ?? "") as AwayReason, until || null);
  if (!result.ok) return { error: AWAY_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null };
}

export async function returnToStoreAction(_prev: StockActionState, form: FormData): Promise<StockActionState> {
  const member = await requireMember();
  const result = await returnToStore(member, String(form.get("vehicleId") ?? ""));
  if (!result.ok) return { error: result.error === "invalid" ? "Este carro já está na loja." : AWAY_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null };
}

const RESERVATION_ERROR = {
  forbidden: "Você só reserva para os seus clientes e só cancela as suas reservas.",
  not_found: "Só carro disponível pode ser reservado.",
  invalid: "Confira o sinal e a validade (de hoje até 30 dias).",
  reserved: "Este carro já está reservado.",
} as const;

export async function createReservationAction(_prev: StockActionState, form: FormData): Promise<StockActionState> {
  const member = await requireMember();
  const deposit = reaisEmDigitos(String(form.get("deposit") ?? ""));
  const result = await createReservation(member, {
    vehicleId: String(form.get("vehicleId") ?? ""),
    leadId: String(form.get("leadId") ?? "") || null,
    deposit: deposit === "" ? 0 : Number(deposit),
    expiresOn: String(form.get("expiresOn") ?? ""),
  });
  if (!result.ok) return { error: RESERVATION_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null };
}

export async function cancelReservationAction(_prev: StockActionState, form: FormData): Promise<StockActionState> {
  const member = await requireMember();
  const result = await cancelReservation(member, String(form.get("reservationId") ?? ""));
  if (!result.ok) return { error: result.error === "forbidden" ? RESERVATION_ERROR.forbidden : "Esta reserva já foi cancelada." };
  revalidatePath("/gestao", "layout");
  return { error: null };
}

const DOCUMENT_ERROR = {
  forbidden: "Só o dono e o gerente mexem na documentação.",
  not_found: "Carro não encontrado.",
  invalid: "Escolha a situação; a observação tem até 200 letras.",
} as const;

export async function setDocumentAction(_prev: StockActionState, form: FormData): Promise<StockActionState> {
  const member = await requireMember();
  const field = (name: string) => String(form.get(name) ?? "");
  const result = await setDocument(member, {
    vehicleId: field("vehicleId"),
    item: field("item") as DocumentItem,
    status: field("status") as DocumentStatus,
    note: field("note"),
  });
  if (!result.ok) return { error: DOCUMENT_ERROR[result.error] };
  revalidatePath("/gestao", "layout");
  return { error: null };
}
