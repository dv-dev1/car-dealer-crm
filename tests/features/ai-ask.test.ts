import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { secoesPara } from "@/components/gestao/secoes";
import { askStoreAction } from "@/features/ai/actions";
import { ASK_TOOLS, askStore, toolsFor } from "@/features/ai/ask";
import { AskView } from "@/features/ai/ask-view";
import { restoreDemoStore } from "@/features/demo/model";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
const guard = vi.hoisted(() => ({ requireMember: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/features/auth/guard", () => guard);

const TODAY = "2026-11-13";
const MONTH = { de: "2026-11-01", ate: "2026-11-30" };
const HALF_YEAR = { de: "2026-06-01", ate: TODAY };
const SECRET_KEY = /lucro|custo|margem|investido|profit|cost|margin/i;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

const fetchMock = vi.fn<typeof fetch>();
const reply = (message: object) => new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
const says = (content: string) => reply({ content });
const calls = (...asked: [name: string, args: object][]) =>
  reply({ content: null, tool_calls: asked.map(([name, args], i) => ({ id: `c${i + 1}`, type: "function", function: { name, arguments: JSON.stringify(args) } })) });
/** What the functions answered, as the model received it in the request number `call`. */
const toolResults = (call: number) =>
  (JSON.parse(fetchMock.mock.calls[call][1]!.body as string).messages as { role: string; content: string }[])
    .filter((message) => message.role === "tool")
    .map((message) => JSON.parse(message.content));
const run = (name: string, ctx: StoreMember, args: Record<string, unknown> = {}) => ASK_TOOLS.find((tool) => tool.name === name)!.run(ctx, args, TODAY);

let owner: StoreMember;
let seller: StoreMember;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  await restoreDemoStore(owner, TODAY);
  // A seller of the demo with sales of his own.
  const [bruno] = await adminQuery("select id from memberships where store_id = $1 and name = 'Bruno Farias'", [owner.storeId]);
  seller = { ...owner, membershipId: bruno.id, role: "seller", name: "Bruno Farias" };
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("a seller is not offered the functions of who manages", () => {
  const names = (role: StoreMember["role"]) => toolsFor(role).map((tool) => tool.name);
  expect(names("owner")).toEqual(["estoque", "vendas", "clientes", "ranking_vendedores", "comissoes", "canais", "o_que_comprar"]);
  expect(names("manager")).toEqual(names("owner"));
  expect(names("seller")).toEqual(["estoque", "vendas", "clientes", "ranking_vendedores", "comissoes"]);
});

it("the owner's question is answered with what the function read from the store", async () => {
  const [{ sold, revenue }] = await adminQuery(
    "select count(*)::int as sold, coalesce(sum(price), 0)::float as revenue from sales where store_id = $1 and sold_on between $2 and $3",
    [owner.storeId, MONTH.de, MONTH.ate],
  );
  expect(sold).toBeGreaterThan(0);
  fetchMock.mockResolvedValueOnce(calls(["vendas", MONTH])).mockResolvedValueOnce(says(`  A loja vendeu ${sold} carros este mês.  `));
  expect(await askStore(owner, TODAY, "Quantos carros vendemos este mês?")).toEqual({ ok: true, answer: `A loja vendeu ${sold} carros este mês.` });

  const first = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  expect(first.tools.map((tool: { function: { name: string } }) => tool.function.name)).toContain("canais");
  expect(first.messages[0].content).toContain(TODAY);
  expect(first.messages[1]).toEqual({ role: "user", content: "Quantos carros vendemos este mês?" });
  const [result] = toolResults(1);
  expect(result).toMatchObject({ quantidade: sold, valorVendido: revenue });
  expect(result.lucro).toBeGreaterThan(0);
});

it("as a seller the functions answer no cost, profit or margin, and only his own commissions", async () => {
  const asOwner = { vendas: (await run("vendas", owner, HALF_YEAR)) as Record<string, number>, estoque: (await run("estoque", owner)) as Record<string, number> };
  const asSeller = { vendas: await run("vendas", seller, HALF_YEAR), estoque: await run("estoque", seller) };
  expect(asSeller.vendas).toMatchObject({ quantidade: asOwner.vendas.quantidade, valorVendido: asOwner.vendas.valorVendido });
  // A trade-in still in preparation is not in a seller's stock, so he may count fewer cars.
  const sellerCars = (asSeller.estoque as { carros: number }).carros;
  expect(sellerCars).toBeGreaterThan(0);
  expect(sellerCars).toBeLessThanOrEqual(asOwner.estoque.carros);
  const sent = JSON.stringify(asSeller);
  expect(sent).not.toMatch(SECRET_KEY);
  for (const secret of [asOwner.vendas.lucro, asOwner.estoque.investido, asOwner.estoque.lucroEsperado]) {
    expect(secret).toBeGreaterThan(0);
    expect(sent).not.toContain(String(secret));
  }

  const all = (await run("comissoes", owner, HALF_YEAR)) as { porVendedor: { vendedor: string }[] };
  const own = (await run("comissoes", seller, HALF_YEAR)) as { porVendedor: { vendedor: string }[] };
  expect(all.porVendedor.length).toBeGreaterThan(1);
  expect(own.porVendedor.map((row) => row.vendedor)).toEqual(["Bruno Farias"]);

  fetchMock.mockResolvedValueOnce(calls(["canais", MONTH], ["o_que_comprar", {}], ["apagar_tudo", {}], ["vendas", MONTH])).mockResolvedValueOnce(says("Você não tem acesso a esse dado."));
  expect(await askStore(seller, TODAY, "Qual canal dá mais lucro?")).toMatchObject({ ok: true });
  const offered = JSON.parse(fetchMock.mock.calls[0][1]!.body as string).tools.map((tool: { function: { name: string } }) => tool.function.name);
  expect(offered).not.toContain("canais");
  const results = toolResults(1);
  expect(results.slice(0, 3)).toEqual([{ erro: "sem acesso" }, { erro: "sem acesso" }, { erro: "sem acesso" }]);
  expect(JSON.stringify(results[3])).not.toMatch(SECRET_KEY);
});

it("the functions of who manages answer the owner", async () => {
  expect(((await run("canais", owner, HALF_YEAR)) as { canais: unknown[] }).canais.length).toBeGreaterThan(0);
  expect(((await run("o_que_comprar", owner)) as { porModelo: unknown[] }).porModelo.length).toBeGreaterThan(0);
  expect(await run("clientes", owner)).toMatchObject({ parados: expect.any(Number), porEtapa: expect.any(Object) });
  expect(((await run("ranking_vendedores", owner)) as { vendedores: unknown[] }).vendedores.length).toBeGreaterThan(0);
});

it("a period that is not two dates in order, up to a year, is refused", async () => {
  for (const args of [{ de: "ontem", ate: TODAY }, { de: "2026-02-31", ate: TODAY }, { de: TODAY, ate: "2026-11-01" }, { de: "2024-01-01", ate: TODAY }, { ate: TODAY }, {}]) {
    for (const name of ["vendas", "comissoes", "canais"]) expect(await run(name, owner, args)).toEqual({ erro: "período inválido" });
  }
  fetchMock.mockResolvedValueOnce(reply({ content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "vendas", arguments: "{ quebrado" } }] })).mockResolvedValueOnce(says("Não consegui ler o período."));
  expect(await askStore(owner, TODAY, "Quanto vendemos?")).toEqual({ ok: true, answer: "Não consegui ler o período." });
  expect(toolResults(1)).toEqual([{ erro: "período inválido" }]);
});

it("stops after four rounds of functions, and never asks with an empty or huge question", async () => {
  for (const question of ["", "  ", "oi", "x".repeat(301)]) expect(await askStore(owner, TODAY, question)).toEqual({ ok: false, reason: "invalid" });
  expect(fetchMock).not.toHaveBeenCalled();

  fetchMock.mockImplementation(async () => calls(["estoque", {}]));
  expect(await askStore(owner, TODAY, "Como está o estoque?")).toEqual({ ok: false, reason: "failed" });
  expect(fetchMock).toHaveBeenCalledTimes(5);

  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(says("   "));
  expect(await askStore(owner, TODAY, "Como está o estoque?")).toEqual({ ok: false, reason: "failed" });
  vi.stubEnv("OPENAI_API_KEY", "");
  expect(await askStore(owner, TODAY, "Como está o estoque?")).toEqual({ ok: false, reason: "not_configured" });
});

it("the action answers the question typed or the example tapped", async () => {
  guard.requireMember.mockResolvedValue(owner);
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };
  fetchMock.mockResolvedValueOnce(says("22 carros."));
  expect(await askStoreAction({ error: null }, form({ question: " Quantos carros temos? " }))).toEqual({ error: null, question: "Quantos carros temos?", answer: "22 carros." });
  fetchMock.mockResolvedValueOnce(says("3 parados."));
  expect(await askStoreAction({ error: null }, form({ question: "", example: "Quantos clientes estão parados?" }))).toMatchObject({ question: "Quantos clientes estão parados?", answer: "3 parados." });
  expect(await askStoreAction({ error: null }, form({ question: "oi" }))).toEqual({ error: "Escreva a pergunta com 3 a 300 letras.", question: "oi" });
});

it("the page shows the field and three examples, and the menu offers it to every role", () => {
  const html = renderToStaticMarkup(createElement(AskView));
  expect(html).toContain('name="question"');
  expect(html.match(/name="example"/g)).toHaveLength(3);
  expect(text(html)).toContain("Quantos carros vendemos este mês?");
  for (const managing of [true, false]) expect(secoesPara(managing).map((s) => s.href)).toContain("/gestao/perguntar");
});
