"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMember } from "@/features/auth/guard";

import { createVehicle, removeVehicle, setMargin, updateVehicle, type RemoveReason, type VehicleInput } from "./model";
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

const invalid = (field: keyof VehicleInput): VehicleFormState => ({ error: `Confira o campo: ${FIELD_LABEL[field]}.`, field });
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
  };
  return { input };
}

export async function saveVehicleAction(_prev: VehicleFormState, form: FormData): Promise<VehicleFormState> {
  const member = await requireMember();
  const read = readVehicle(form);
  if ("field" in read) return invalid(read.field);
  const id = String(form.get("id") ?? "");
  const result = id ? await updateVehicle(member, id, read.input) : await createVehicle(member, read.input);
  if (!result.ok) return result.error === "invalid" ? invalid(result.field!) : { error: SAVE_ERROR[result.error] };
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
