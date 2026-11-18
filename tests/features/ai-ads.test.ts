import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateAdAction } from "@/features/ai/actions";
import { generateAd } from "@/features/ai/ads";
import { cleanAd, vehicleFacts } from "@/features/ai/rules";
import { createVehicle, type VehicleInput } from "@/features/stock/model";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";
import { car } from "./stock-car.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
const guard = vi.hoisted(() => ({ requireMember: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/features/auth/guard", () => guard);
vi.mock("@/features/stock/actions", () => ({ setDocumentAction: vi.fn(), setAwayAction: vi.fn(), returnToStoreAction: vi.fn(), createReservationAction: vi.fn(), cancelReservationAction: vi.fn(), addExpenseAction: vi.fn(), removeExpenseAction: vi.fn(),
  setMarginAction: vi.fn(), removeVehicleAction: vi.fn(),
}));
vi.mock("@/features/leads/actions", () => ({
  createLeadAction: vi.fn(), updateLeadAction: vi.fn(), moveLeadAction: vi.fn(), loseLeadAction: vi.fn(),
}));
vi.mock("@/features/sales/actions", () => ({ recordSaleAction: vi.fn() }));

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
const AD = {
  olxTitle: "Chevrolet Onix LT 1.0 2023", olxDescription: "Onix 2023 com 32.000 km.", instagram: "Onix 2023 na loja. #onix", whatsapp: "Chegou Onix 2023. Vem ver!",
};
const INPUT: VehicleInput = {
  brand: "Chevrolet", model: "Onix", version: "LT 1.0", modelYear: 2023, manufactureYear: 2022, km: 32000, color: "Prata", fuel: "Flex",
  transmission: "Manual", bodyType: "Hatch", doors: 4, description: "Único dono.", features: ["Ar condicionado"], featured: false, price: 72990,
  acquisitionCost: 61357, enteredOn: "2026-11-10", ready: true, source: "consignment", consignorName: "Severino Dono", consignorPhone: "83991112222",
  plate: "ABC1D23",
};

let owner: StoreMember;
let seller: StoreMember;
let other: StoreMember;
let slug: string;
let vehicleId: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: false };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  other = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla", storeName: "Loja B", isDemo: false };
  const created = await createVehicle(owner, INPUT, TODAY);
  if (!created.ok) throw new Error(created.error);
  ({ slug, id: vehicleId } = created);
  await adminQuery("update vehicles set min_cash_price = 70123 where id = $1", [vehicleId]);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("the facts sent for an ad are the car's public sheet, never what it cost or who owns it", () => {
  const money = { acquisitionCost: 61357, cost: 62468, profit: 8522, perDay: 21, sinceEntry: 903 };
  const facts = vehicleFacts(
    car({ money, minCashPrice: 70123, source: "consignment", consignor: { name: "Severino Dono", phone: "5583991112222" },
      registration: { plate: "ABC1D23", renavam: "01234567890", chassis: "9BWZZZ377VT004251" }, features: ["Ar condicionado"], description: "Único dono." }),
  );
  const sent = JSON.stringify(facts);
  for (const secret of ["61357", "62468", "8522", "70123", "Severino", "83991112222", "ABC1D23", "01234567890", "9BWZZZ377VT004251", "consign", "cost", "money", "profit"]) {
    expect(sent).not.toContain(secret);
  }
  expect(facts).toMatchObject({ carro: "Chevrolet Onix LT 1.0", km: 32000, preco: 72990, opcionais: ["Ar condicionado"], descricao: "Único dono." });
});

it("an ad needs its four texts, and the title fits OLX", () => {
  expect(cleanAd(AD)).toEqual(AD);
  expect(cleanAd({ ...AD, olxTitle: "x".repeat(80), whatsapp: `  ${"y".repeat(1600)}  ` })).toMatchObject({ olxTitle: "x".repeat(60), whatsapp: "y".repeat(1500) });
  for (const broken of [null, "texto", [], { ...AD, instagram: "" }, { ...AD, instagram: "   " }, { ...AD, whatsapp: 3 }, { olxTitle: "só o título" }]) {
    expect(cleanAd(broken)).toBeNull();
  }
});

it("a seller gets the ad, and nothing of the cost goes to the AI", async () => {
  fetchMock.mockResolvedValueOnce(answer(JSON.stringify(AD)));
  expect(await generateAd(seller, TODAY, slug, "Loja A")).toEqual({ ok: true, ad: AD });
  const body = fetchMock.mock.calls[0][1]!.body as string;
  expect(body).toContain("72990");
  expect(body).toContain("Loja A");
  for (const secret of ["61357", "70123", "Severino", "ABC1D23"]) expect(body).not.toContain(secret);
  expect(JSON.parse(body).response_format.json_schema.strict).toBe(true);

  fetchMock.mockResolvedValueOnce(answer(JSON.stringify(AD)));
  await generateAd(owner, TODAY, slug, "Loja A");
  for (const secret of ["61357", "70123", "Severino", "ABC1D23"]) expect(fetchMock.mock.calls[1][1]!.body as string).not.toContain(secret);
});

it("no ad for a sold car, a car of another store or a broken answer", async () => {
  expect(await generateAd(other, TODAY, slug, "Loja B")).toEqual({ ok: false, reason: "not_found" });
  expect(await generateAd(owner, TODAY, "nao-existe", "Loja A")).toEqual({ ok: false, reason: "not_found" });
  await adminQuery("update vehicles set status = 'sold' where id = $1", [vehicleId]);
  expect(await generateAd(owner, TODAY, slug, "Loja A")).toEqual({ ok: false, reason: "not_found" });
  expect(fetchMock).not.toHaveBeenCalled();

  await adminQuery("update vehicles set status = 'available' where id = $1", [vehicleId]);
  fetchMock.mockResolvedValueOnce(answer("{ quebrado"));
  expect(await generateAd(owner, TODAY, slug, "Loja A")).toEqual({ ok: false, reason: "failed" });
  fetchMock.mockResolvedValueOnce(answer(JSON.stringify({ olxTitle: "só o título" })));
  expect(await generateAd(owner, TODAY, slug, "Loja A")).toEqual({ ok: false, reason: "failed" });
});

it("the action answers the ad or a message in Portuguese", async () => {
  guard.requireMember.mockResolvedValue(seller);
  fetchMock.mockResolvedValueOnce(answer(JSON.stringify(AD)));
  expect(await generateAdAction(slug)).toEqual({ ad: AD });
  expect(await generateAdAction("nao-existe")).toEqual({ error: "Carro não encontrado." });
  vi.stubEnv("OPENAI_API_KEY", "");
  expect(await generateAdAction(slug)).toEqual({ error: "A IA ainda não está ligada nesta loja." });
});

it("the car page offers the ad to every role, but not for a sold car", async () => {
  const { CarroGestao } = await import("@/app/gestao/estoque/[slug]/CarroGestao");
  const base = { estoque: [], channels: [], sellers: [], leads: [], memberId: "m1", canManage: false, expenses: null };
  expect(text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: car({ money: null }) })))).toContain("Gerar anúncio");
  expect(text(renderToStaticMarkup(createElement(CarroGestao, { ...base, canManage: true, expenses: [], veiculo: car() })))).toContain("Gerar anúncio");
  expect(text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: car({ money: null, status: "sold" }) })))).not.toContain("Gerar anúncio");
});
