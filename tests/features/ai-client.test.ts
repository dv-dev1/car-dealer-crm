import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { complete } from "@/features/ai/client";
import { AI_DAILY_LIMIT, AI_ERROR } from "@/features/ai/rules";
import { withStore, type MemberContext } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const TODAY = "2026-11-13";
const FAKE_KEY = "test-key-not-real";

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

const reply = (message: unknown, status = 200) => new Response(JSON.stringify({ choices: [{ message }] }), { status });
const fetchMock = vi.fn<typeof fetch>();
const use = (ctx: MemberContext, limit: number, day = TODAY) =>
  withStore(ctx, (db) => db.query<{ ok: boolean }>("select use_ai_call($1, $2) as ok", [day, limit])).then((rows) => rows[0].ok);
const calls = (storeId: string) => adminQuery("select day::text, calls from ai_usage where store_id = $1", [storeId]);

let owner: MemberContext;
let seller: MemberContext;
let other: MemberContext;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana" };
  seller = { membershipId: seed.a.beto.id, storeId: seed.a.storeId, role: "seller", name: "Beto" };
  other = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla" };
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENAI_API_KEY", FAKE_KEY);
  vi.stubEnv("OPENAI_MODEL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const messages = [{ role: "system" as const, content: "Responda curto." }, { role: "user" as const, content: "Oi" }];

it("without the key the AI is off: no call, nothing counted", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  expect(await complete(owner, TODAY, { messages })).toEqual({ ok: false, reason: "not_configured" });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await calls(owner.storeId)).toEqual([]);
  expect(AI_ERROR.not_configured).toBe("A IA ainda não está ligada nesta loja.");
});

it("sends the model, the messages and the strict format, with the key in the header only", async () => {
  fetchMock.mockResolvedValueOnce(reply({ content: "oi" }));
  const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false };
  expect(await complete(seller, TODAY, { messages, json: { name: "answer", schema } })).toEqual({ ok: true, text: "oi", toolCalls: [] });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.openai.com/v1/chat/completions");
  expect(new Headers(init!.headers).get("authorization")).toBe(`Bearer ${FAKE_KEY}`);
  const body = JSON.parse(init!.body as string);
  expect(body.model).toBe("gpt-5-mini");
  expect(body.messages).toEqual(messages);
  expect(body.response_format).toEqual({ type: "json_schema", json_schema: { name: "answer", strict: true, schema } });
  expect(body.tools).toBeUndefined();
  expect(init!.body as string).not.toContain(FAKE_KEY);
  expect(await calls(owner.storeId)).toEqual([{ day: TODAY, calls: 1 }]);
});

it("uses the configured model and offers the tools as functions", async () => {
  vi.stubEnv("OPENAI_MODEL", "gpt-5");
  const toolCalls = [{ id: "c1", type: "function", function: { name: "vendas", arguments: "{}" } }];
  fetchMock.mockResolvedValueOnce(reply({ content: null, tool_calls: toolCalls }));
  const tool = { name: "vendas", description: "Vendas do período.", parameters: { type: "object", properties: {} }, managersOnly: false };
  expect(await complete(owner, TODAY, { messages, tools: [tool] })).toEqual({ ok: true, text: "", toolCalls });
  const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  expect(body.model).toBe("gpt-5");
  expect(body.tools).toEqual([{ type: "function", function: { name: "vendas", description: "Vendas do período.", parameters: tool.parameters } }]);
  expect(body.response_format).toBeUndefined();
});

it("an error, a broken answer or a network failure is a failure, never an exception", async () => {
  fetchMock.mockResolvedValueOnce(reply({ content: "x" }, 500));
  expect(await complete(owner, TODAY, { messages })).toEqual({ ok: false, reason: "failed" });
  fetchMock.mockRejectedValueOnce(new Error("network down"));
  expect(await complete(owner, TODAY, { messages })).toEqual({ ok: false, reason: "failed" });
  fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
  expect(await complete(owner, TODAY, { messages })).toEqual({ ok: false, reason: "failed" });
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
  expect(await complete(owner, TODAY, { messages })).toEqual({ ok: false, reason: "failed" });
});

it("the daily limit is per store and per day, and holds under simultaneous calls", async () => {
  expect(await use(owner, 2)).toBe(true);
  expect(await use(seller, 2)).toBe(true);
  expect(await use(owner, 2)).toBe(false);
  expect(await calls(owner.storeId)).toEqual([{ day: TODAY, calls: 2 }]);
  expect(await calls(other.storeId)).toEqual([]);
  expect(await use(other, 2)).toBe(true);
  expect(await use(owner, 2, "2026-11-14")).toBe(true);
  expect(await use(owner, 0, "2026-11-15")).toBe(false);

  const many = await Promise.all(Array.from({ length: 10 }, () => use(other, 4)));
  expect(many.filter(Boolean)).toHaveLength(3);
  expect(await calls(other.storeId)).toEqual([{ day: TODAY, calls: 4 }]);
});

it("the app reads and writes the counter only through the function", async () => {
  await use(owner, 5);
  for (const sql of ["select * from ai_usage", "update ai_usage set calls = 0", "delete from ai_usage"]) {
    await expect(withStore(owner, (db) => db.query(sql))).rejects.toMatchObject({ code: "42501" });
  }
});

it("at the limit the call is refused before reaching the provider", async () => {
  await adminQuery("insert into ai_usage (store_id, day, calls) values ($1, $2, $3)", [owner.storeId, TODAY, AI_DAILY_LIMIT]);
  expect(AI_DAILY_LIMIT).toBe(200);
  expect(await complete(owner, TODAY, { messages })).toEqual({ ok: false, reason: "limit" });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await calls(owner.storeId)).toEqual([{ day: TODAY, calls: 200 }]);
});
