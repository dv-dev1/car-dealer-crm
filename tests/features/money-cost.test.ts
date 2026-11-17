import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { LojaAgora } from "@/components/gestao/painel/LojaAgora";
import { restoreDemoStore } from "@/features/demo/model";
import { listStock } from "@/features/stock/model";
import { moneyCost, stockSummary } from "@/features/stock/rules";
import { getStoreSettings, readRatePct, setMoneyRate } from "@/features/store/model";
import { StoreSettingsView } from "@/features/store/view";
import { secoesPara } from "@/components/gestao/secoes";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";
import { car } from "./stock-car.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
vi.mock("@/features/stock/actions", () => ({ setDocumentAction: vi.fn(), setAwayAction: vi.fn(), returnToStoreAction: vi.fn(), createReservationAction: vi.fn(), cancelReservationAction: vi.fn(), addExpenseAction: vi.fn(), removeExpenseAction: vi.fn(),
  setMarginAction: vi.fn(), removeVehicleAction: vi.fn(),
}));
vi.mock("@/features/leads/actions", () => ({
  createLeadAction: vi.fn(), updateLeadAction: vi.fn(), moveLeadAction: vi.fn(), loseLeadAction: vi.fn(),
}));
vi.mock("@/features/sales/actions", () => ({ recordSaleAction: vi.fn() }));
vi.mock("@/features/store/actions", () => ({ setStaleLeadDaysAction: vi.fn(), setWarrantyDaysAction: vi.fn(), setMoneyRateAction: vi.fn() }));

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

let owner: StoreMember;
let seller: StoreMember;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  await restoreDemoStore(owner, TODAY);
});

it("the money cost of a parked car", () => {
  expect(moneyCost(100000, 0.01, 45)).toEqual({ perDay: 33.33, sinceEntry: 1500 });
  expect(moneyCost(100000, 0, 45)).toEqual({ perDay: 0, sinceEntry: 0 });
});

it("each car in the yard carries its money cost; a seller gets none", async () => {
  const cars = await listStock(owner, TODAY);
  for (const c of cars) {
    expect(c.money).toMatchObject(moneyCost(c.money!.cost, 0.01, c.daysInStock));
  }
  const total = cars.reduce((sum, c) => sum + c.money!.perDay, 0);
  expect(stockSummary(cars).yardCostPerDay).toBeCloseTo(total, 2);
  const sellerCars = await listStock(seller, TODAY);
  expect(sellerCars.every((c) => c.money === null)).toBe(true);
  expect(stockSummary(sellerCars).yardCostPerDay).toBeNull();
});

it("owner and manager set the money rate; a seller cannot", async () => {
  expect(await getStoreSettings(owner)).toMatchObject({ moneyRate: 0.01 });
  expect(await setMoneyRate(owner, 1.5)).toEqual({ ok: true });
  expect(await getStoreSettings(owner)).toMatchObject({ moneyRate: 0.015 });
  const [first] = await listStock(owner, TODAY);
  expect(first.money!.perDay).toBe(moneyCost(first.money!.cost, 0.015, first.daysInStock).perDay);
  expect(await setMoneyRate(seller, 2)).toEqual({ ok: false, error: "forbidden" });
  expect(await setMoneyRate(owner, -1)).toEqual({ ok: false, error: "invalid" });
  expect(await setMoneyRate(owner, 10.01)).toEqual({ ok: false, error: "invalid" });
  expect(await setMoneyRate(owner, 1.234)).toEqual({ ok: false, error: "invalid" });
  expect(await setMoneyRate(owner, 1.1)).toEqual({ ok: true });
  expect(await getStoreSettings(owner)).toMatchObject({ moneyRate: 0.011 });
  expect(await setMoneyRate(owner, 0)).toEqual({ ok: true });
  expect(await getStoreSettings(owner)).toMatchObject({ moneyRate: 0 });
});

it("the panel says what the yard costs a day", () => {
  const resumo = { ...stockSummary([car()]), yardCostPerDay: 1234 };
  const html = text(renderToStaticMarkup(createElement(LojaAgora, { resumo, giro: [], pedemAtencao: 0 })));
  expect(html).toMatch(/O pátio custa R\$\s?1\.234 por dia/);
  expect(html).toContain("Ajustar taxa");
  const hidden = { ...resumo, invested: null, expectedProfit: null, yardCostPerDay: null };
  expect(text(renderToStaticMarkup(createElement(LojaAgora, { resumo: hidden, giro: [], pedemAtencao: 0 })))).not.toMatch(/custa|taxa/i);
});

it("the car page says what the car costs parked", async () => {
  const { CarroGestao } = await import("@/app/gestao/estoque/[slug]/CarroGestao");
  const base = { estoque: [], channels: [], sellers: [], leads: [], memberId: "m1", canManage: true, expenses: [] };
  const money = { acquisitionCost: 100000, cost: 100000, profit: 9000, perDay: 33.33, sinceEntry: 1500 };
  const html = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: car({ money, daysInStock: 45 }) })));
  expect(html).toMatch(/Parado custa R\$\s?33 por dia/);
  expect(html).toMatch(/R\$\s?1\.500 em 45 dias/);
  const sold = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: car({ money, status: "sold" }) })));
  expect(sold).not.toContain("Parado custa");
});

it("reads the rate as typed, in percent", () => {
  expect(readRatePct("1,5")).toBe(1.5);
  expect(readRatePct(" 2 ")).toBe(2);
  expect(readRatePct("0.75")).toBe(0.75);
  for (const bad of ["", "abc", "1,555", "-1", "1%"]) expect(readRatePct(bad)).toBeNull();
});

it("only owner and manager get the store settings", () => {
  expect(secoesPara(true).map((s) => s.href)).toContain("/gestao/loja");
  expect(secoesPara(false).map((s) => s.href)).not.toContain("/gestao/loja");
  const html = text(renderToStaticMarkup(createElement(StoreSettingsView, { moneyRate: 0.015, staleLeadDays: 3, warrantyDays: 90 })));
  expect(html).toContain("Custo do dinheiro (% ao mês)");
  expect(renderToStaticMarkup(createElement(StoreSettingsView, { moneyRate: 0.015, staleLeadDays: 3, warrantyDays: 90 }))).toContain('value="1,5"');
});
