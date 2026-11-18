import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResumoDia } from "@/components/gestao/painel/ResumoDia";
import { dailySummaryAction } from "@/features/ai/actions";
import { dailyFacts, dailySummary } from "@/features/ai/daily";
import { onlyKnownNumbers, plainSummary, type DailyFacts } from "@/features/ai/rules";
import { restoreDemoStore } from "@/features/demo/model";
import { listStock } from "@/features/stock/model";
import { priceSuggestion } from "@/features/stock/rules";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
const guard = vi.hoisted(() => ({ requireMember: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/features/auth/guard", () => guard);

const TODAY = "2026-11-13";
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
const answer = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const ZERO: DailyFacts = { salesToday: 0, newLeadsNoResponse: 0, carsOver60: 0, carsOver90: 0, reservationsExpiring: 0, pendingDocs: 0, priceSuggestions: 0 };

let owner: StoreMember;
let manager: StoreMember;
let seller: StoreMember;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  manager = { ...owner, role: "manager" };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  await restoreDemoStore(owner, TODAY);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("the day's numbers come from the store's own rows", async () => {
  // Something for today in each count that the demo may not have.
  await adminQuery("update sales set sold_on = $2 where id = (select id from sales where store_id = $1 order by sold_on desc limit 1)", [owner.storeId, TODAY]);
  const [available] = await adminQuery("select id from vehicles where store_id = $1 and status = 'available' limit 1", [owner.storeId]);
  await adminQuery("insert into reservations (store_id, vehicle_id, deposit, expires_on) values ($1, $2, 500, $3::date + 1)", [owner.storeId, available.id, TODAY]);
  await adminQuery("insert into reservations (store_id, vehicle_id, deposit, expires_on) values ($1, $2, 500, $3::date + 2)", [owner.storeId, available.id, TODAY]);

  const yard = "v.store_id = $1 and v.status not in ('sold', 'removed')";
  const [sql] = await adminQuery(
    `select (select count(*)::int from sales where store_id = $1 and sold_on = $2::date) as "salesToday",
            (select count(*)::int from leads where store_id = $1 and stage not in ('won', 'lost') and first_response_at is null) as "newLeadsNoResponse",
            (select count(*)::int from vehicles v where ${yard} and $2::date - v.entered_on between 60 and 90) as "carsOver60",
            (select count(*)::int from vehicles v where ${yard} and $2::date - v.entered_on > 90) as "carsOver90",
            (select count(*)::int from reservations r join vehicles v on v.id = r.vehicle_id
              where ${yard} and r.canceled_at is null and r.expires_on between $2::date and $2::date + 1) as "reservationsExpiring",
            (select count(*)::int from vehicles v where ${yard}
                and exists (select from vehicle_documents d where d.vehicle_id = v.id and d.status = 'pending')) as "pendingDocs"`,
    [owner.storeId, TODAY],
  );
  const priceSuggestions = (await listStock(owner, TODAY)).filter((car) => priceSuggestion(car)?.suggested != null).length;
  const facts = await dailyFacts(owner, TODAY);
  expect(facts).toEqual({ ...sql, priceSuggestions });
  expect(facts!.salesToday).toBeGreaterThan(0);
  expect(facts!.reservationsExpiring).toBe(1);
  expect(facts!.pendingDocs).toBeGreaterThan(0);
  expect(await dailyFacts(manager, TODAY)).toEqual(facts);
  expect(await dailyFacts(seller, TODAY)).toBeNull();
});

it("the server writes the summary on its own, one line per number that asks for attention", () => {
  expect(plainSummary(ZERO)).toEqual(["Dia tranquilo: nada pedindo atenção."]);
  expect(plainSummary({ ...ZERO, salesToday: 2, reservationsExpiring: 1 })).toEqual(["2 vendas hoje.", "1 reserva vence até amanhã."]);
  expect(plainSummary({ salesToday: 1, newLeadsNoResponse: 3, carsOver60: 1, carsOver90: 2, reservationsExpiring: 2, pendingDocs: 1, priceSuggestions: 4 })).toEqual([
    "1 venda hoje.",
    "3 clientes novos sem resposta.",
    "2 carros passaram de 90 dias no pátio.",
    "1 carro entre 60 e 90 dias no pátio.",
    "2 reservas vencem até amanhã.",
    "1 carro com documento pendente.",
    "4 carros com sugestão de baixar o preço.",
  ]);
});

it("a text passes only when every number in it is one the server computed", () => {
  const facts = { ...ZERO, salesToday: 3, carsOver90: 2 };
  expect(onlyKnownNumbers("3 vendas hoje e 2 carros acima de 90 dias; olhe os de 60 também.", facts)).toBe(true);
  expect(onlyKnownNumbers("3 vendas e 12 carros.", facts)).toBe(false);
  expect(onlyKnownNumbers("Lucro de R$ 18.400 hoje.", facts)).toBe(false);
  expect(onlyKnownNumbers("Vendeu 3,5 carros.", facts)).toBe(false);
  expect(onlyKnownNumbers("Dia tranquilo.", ZERO)).toBe(true);
});

it("the AI words the summary, and a number of its own sends back the server's text", async () => {
  const facts = (await dailyFacts(owner, TODAY))!;
  const plain = plainSummary(facts).join(" ");

  fetchMock.mockResolvedValueOnce(answer(`Hoje ${facts.pendingDocs} carros estão com documento pendente. Vale resolver antes de vender.`));
  expect(await dailySummary(owner, TODAY)).toEqual({ text: `Hoje ${facts.pendingDocs} carros estão com documento pendente. Vale resolver antes de vender.`, byAi: true });
  const sent = JSON.parse(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).messages[1].content);
  expect(Object.values(sent).sort()).toEqual(Object.values(facts).sort());

  fetchMock.mockResolvedValueOnce(answer("A loja vendeu 987654 carros hoje."));
  expect(await dailySummary(owner, TODAY)).toEqual({ text: plain, byAi: false, reason: "numbers" });
  fetchMock.mockResolvedValueOnce(answer("   "));
  expect(await dailySummary(owner, TODAY)).toEqual({ text: plain, byAi: false, reason: "failed" });
  fetchMock.mockRejectedValueOnce(new Error("down"));
  expect(await dailySummary(manager, TODAY)).toEqual({ text: plain, byAi: false, reason: "failed" });
  vi.stubEnv("OPENAI_API_KEY", "");
  expect(await dailySummary(owner, TODAY)).toEqual({ text: plain, byAi: false, reason: "not_configured" });

  expect(await dailySummary(seller, TODAY)).toBeNull();
});

it("the action is for owner and manager", async () => {
  guard.requireMember.mockResolvedValue(seller);
  expect(await dailySummaryAction()).toEqual({ error: "Só o dono e o gerente veem o resumo do dia." });
  expect(fetchMock).not.toHaveBeenCalled();
  guard.requireMember.mockResolvedValue(owner);
  fetchMock.mockResolvedValueOnce(answer("Dia tranquilo."));
  expect(await dailySummaryAction()).toEqual({ text: "Dia tranquilo.", byAi: true });
});

it("the panel block shows the server's lines and offers the AI wording", () => {
  const html = text(renderToStaticMarkup(createElement(ResumoDia, { linhas: ["2 vendas hoje.", "1 reserva vence até amanhã."] })));
  expect(html).toContain("Resumo do dia");
  expect(html).toContain("2 vendas hoje.");
  expect(html).toContain("1 reserva vence até amanhã.");
  expect(html).toContain("Escrever com IA");
});
