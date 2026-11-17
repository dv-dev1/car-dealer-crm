// AI rules shared by server and browser: nothing here reads the database or calls the provider.

/** AI calls a store may make in a day; it caps what one store can cost. */
export const AI_DAILY_LIMIT = 200;

export type AiFailure = "not_configured" | "limit" | "failed";

export const AI_ERROR: Record<AiFailure, string> = {
  not_configured: "A IA ainda não está ligada nesta loja.",
  limit: "A loja chegou ao limite de uso da IA por hoje. Volta amanhã.",
  failed: "A IA não respondeu agora. Tente de novo.",
};
