import { withStore, type MemberContext } from "@/shared/db/client";

import { AI_DAILY_LIMIT, type AiFailure } from "./rules";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5-mini";
const TIMEOUT_MS = 30_000;

export type AiPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type AiToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type AiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | AiPart[] | null;
  tool_calls?: AiToolCall[];
  tool_call_id?: string;
};
export type AiTool = { name: string; description: string; parameters: object };
export type AiRequest = { messages: AiMessage[]; json?: { name: string; schema: object }; tools?: AiTool[] };
export type AiAnswer = { ok: true; text: string; toolCalls: AiToolCall[] } | { ok: false; reason: AiFailure };

/**
 * One call to the model, from the server only. The key never leaves process.env, and neither the key nor the
 * conversation is logged. Each call counts in the store's daily limit; a store without the key counts nothing.
 */
export async function complete(ctx: MemberContext, today: string, request: AiRequest): Promise<AiAnswer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: "not_configured" };
  // Counted in its own transaction, before the call: no connection stays open while the model answers.
  const [{ ok }] = await withStore(ctx, (db) => db.query<{ ok: boolean }>("select use_ai_call($1, $2) as ok", [today, AI_DAILY_LIMIT]));
  if (!ok) return { ok: false, reason: "limit" };
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages: request.messages,
        ...(request.json ? { response_format: { type: "json_schema", json_schema: { ...request.json, strict: true } } } : {}),
        ...(request.tools?.length
          ? { tools: request.tools.map(({ name, description, parameters }) => ({ type: "function", function: { name, description, parameters } })) }
          : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: "failed" };
    const data = (await response.json()) as { choices?: { message?: { content?: unknown; tool_calls?: unknown } }[] };
    const message = data.choices?.[0]?.message;
    if (!message) return { ok: false, reason: "failed" };
    return {
      ok: true,
      text: typeof message.content === "string" ? message.content : "",
      toolCalls: Array.isArray(message.tool_calls) ? (message.tool_calls as AiToolCall[]) : [],
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
