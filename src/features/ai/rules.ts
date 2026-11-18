// AI rules shared by server and browser: nothing here reads the database or calls the provider.

import { CORES } from "@/data/opcoes-veiculo";
import type { StockVehicle } from "@/features/stock/model";
import { CHASSIS, PLATE, RENAVAM, registrationText } from "@/features/stock/rules";

/** AI calls a store may make in a day; it caps what one store can cost. */
export const AI_DAILY_LIMIT = 200;

export type AiFailure = "not_configured" | "limit" | "failed";

export const AI_ERROR: Record<AiFailure, string> = {
  not_configured: "A IA ainda não está ligada nesta loja.",
  limit: "A loja chegou ao limite de uso da IA por hoje. Volta amanhã.",
  failed: "A IA não respondeu agora. Tente de novo.",
};

// Reading the car's document (CRLV-e) into the new car form.

export const DOCUMENT_FIELDS = ["plate", "renavam", "chassis", "brand", "model", "manufactureYear", "modelYear", "color"] as const;
export type DocumentFields = Record<(typeof DOCUMENT_FIELDS)[number], string>;

const MAX_NAME = 40;

/**
 * What the model read, kept only where it has the shape of the field: anything else comes back empty, so a wrong
 * reading never fills the form. The color has to be one of the form's.
 */
export function cleanDocumentFields(raw: unknown, thisYear: number): DocumentFields {
  const read = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const string = (name: string) => (typeof read[name] === "string" || typeof read[name] === "number" ? String(read[name]).trim() : "");
  const shaped = (name: string, shape: RegExp) => (shape.test(registrationText(string(name))) ? registrationText(string(name)) : "");
  // A year may come as a number; a name that is not text is not a name.
  const name = (field: string) => (typeof read[field] === "string" && string(field).length <= MAX_NAME ? string(field) : "");
  const year = (field: string) => (/^[0-9]{4}$/.test(string(field)) && Number(string(field)) >= 1950 && Number(string(field)) <= thisYear + 1 ? string(field) : "");
  return {
    plate: shaped("plate", PLATE),
    renavam: shaped("renavam", RENAVAM),
    chassis: shaped("chassis", CHASSIS),
    brand: name("brand"),
    model: name("model"),
    manufactureYear: year("manufactureYear"),
    modelYear: year("modelYear"),
    color: CORES.find((color) => color.toLowerCase() === string("color").toLowerCase()) ?? "",
  };
}

// The car's ad.

export const AD_FIELDS = ["olxTitle", "olxDescription", "instagram", "whatsapp"] as const;
export type AdTexts = Record<(typeof AD_FIELDS)[number], string>;
export const AD_LABEL: Record<keyof AdTexts, string> = {
  olxTitle: "OLX: título",
  olxDescription: "OLX: descrição",
  instagram: "Instagram: legenda",
  whatsapp: "WhatsApp: mensagem",
};

const MAX_AD_TITLE = 60;
const MAX_AD_TEXT = 1500;

/**
 * What goes to the model for an ad: the car's public sheet and its price, named field by field. The cost, the
 * cash minimum, the consignor, the plate and the documents are not here for any role, so they cannot leak.
 */
export function vehicleFacts(car: StockVehicle): Record<string, string | number | string[]> {
  const facts: Record<string, string | number | string[] | null> = {
    carro: car.title,
    anoFabricacao: car.manufactureYear,
    anoModelo: car.modelYear,
    km: car.km,
    cor: car.color,
    combustivel: car.fuel,
    cambio: car.transmission,
    carroceria: car.bodyType,
    portas: car.doors,
    motor: car.engine,
    potencia: car.power,
    opcionais: car.features,
    descricao: car.description,
    preco: car.price,
  };
  return Object.fromEntries(Object.entries(facts).filter(([, value]) => value !== null && value !== "")) as Record<string, string | number | string[]>;
}

/** The four texts, trimmed and cut to size; null when one is missing or empty. */
export function cleanAd(raw: unknown): AdTexts | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const read = raw as Record<string, unknown>;
  const ad = {} as AdTexts;
  for (const field of AD_FIELDS) {
    const value = read[field];
    if (typeof value !== "string" || value.trim() === "") return null;
    ad[field] = value.trim().slice(0, field === "olxTitle" ? MAX_AD_TITLE : MAX_AD_TEXT);
  }
  return ad;
}

// The message for the client.

export type MessageKind = "first_contact" | "resume" | "after_visit" | "after_sale";
export const MESSAGE_KIND_LABEL: Record<MessageKind, string> = {
  first_contact: "Primeiro contato",
  resume: "Retomada",
  after_visit: "Pós-visita",
  after_sale: "Pós-venda",
};

/** A visit counts as recent for this many days. */
const AFTER_VISIT_DAYS = 7;
const MAX_MESSAGE = 600;

/** Which message fits: after the sale, the first one, after a recent visit, or picking the talk up again. */
export function messageKind(lead: { won: boolean; answered: boolean; daysSinceVisit: number | null }): MessageKind {
  if (lead.won) return "after_sale";
  if (!lead.answered) return "first_contact";
  return lead.daysSinceVisit !== null && lead.daysSinceVisit <= AFTER_VISIT_DAYS ? "after_visit" : "resume";
}

/** The model's text without the quotes it likes to add, cut to size; null when nothing is left. */
export function cleanMessage(raw: string): string | null {
  const text = raw.trim().replace(/^["“”']+|["“”']+$/g, "").trim().slice(0, MAX_MESSAGE);
  return text === "" ? null : text;
}
