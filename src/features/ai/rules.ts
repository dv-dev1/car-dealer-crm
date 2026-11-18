// AI rules shared by server and browser: nothing here reads the database or calls the provider.

import { CORES } from "@/data/opcoes-veiculo";
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
