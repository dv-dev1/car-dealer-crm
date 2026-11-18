import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { loadReport } from "@/features/reports/model";
import { addExpense, listExpenses, readExpense, removeExpense } from "@/features/stock/expenses";
import type { Expense } from "@/features/stock/rules";
import { getVehicle, listStock } from "@/features/stock/model";
import type { StoreMember } from "@/shared/db/client";
import { formData } from "@/shared/form";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";
import { car } from "./stock-car.ts";

vi.mock("@/features/ai/actions", () => ({ readDocumentAction: vi.fn(), generateAdAction: vi.fn(), draftMessageAction: vi.fn(), dailySummaryAction: vi.fn(), askStoreAction: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
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

let owner: StoreMember;
let seller: StoreMember;
let carla: StoreMember;
let carId: string;
let carSlug: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  carla = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla", storeName: "Loja B", isDemo: false };
  await restoreDemoStore(owner, TODAY);
  ({ id: carId, slug: carSlug } = (await listStock(owner, TODAY))[0]);
});

const tires = (over: Record<string, unknown> = {}) => ({
  vehicleId: carId, category: "tires" as const, spentOn: TODAY, amount: 1200, description: "Dois pneus", ...over,
});

it("an owner adds an expense and the car's real cost grows by it", async () => {
  const before = (await getVehicle(owner, carSlug, TODAY))!.money!.cost;
  const result = await addExpense(owner, tires(), TODAY);
  expect(result.ok).toBe(true);
  const [first] = (await listExpenses(owner, carId))!;
  expect(first).toMatchObject({ category: "tires", spentOn: TODAY, amount: 1200, description: "Dois pneus" });
  expect((await getVehicle(owner, carSlug, TODAY))!.money!.cost).toBe(before + 1200);
});

it("a seller gets no expenses and cannot add one", async () => {
  expect(await listExpenses(seller, carId)).toBeNull();
  const count = async () => (await adminQuery("select count(*)::int as n from vehicle_expenses where vehicle_id = $1", [carId]))[0].n;
  const before = await count();
  expect(await addExpense(seller, tires(), TODAY)).toEqual({ ok: false, error: "forbidden" });
  expect(await count()).toBe(before);
});

it("refuses a bad expense", async () => {
  const invalid = (field: string) => ({ ok: false, error: "invalid", field });
  expect(await addExpense(owner, tires({ amount: 0 }), TODAY)).toEqual(invalid("amount"));
  expect(await addExpense(owner, tires({ category: "xyz" }), TODAY)).toEqual(invalid("category"));
  expect(await addExpense(owner, tires({ spentOn: "2026-11-14" }), TODAY)).toEqual(invalid("spentOn"));
  expect(await addExpense(owner, tires({ spentOn: "2026-02-31" }), TODAY)).toEqual(invalid("spentOn"));
  expect(await addExpense(owner, tires({ description: "x".repeat(201) }), TODAY)).toEqual(invalid("description"));
  expect(await addExpense(carla, tires(), TODAY)).toEqual({ ok: false, error: "not_found" });
});

it("an expense on a sold car changes the sale's profit", async () => {
  const [sale] = await adminQuery(
    "select id, vehicle_id from sales where store_id = $1 and sold_on between '2026-11-01' and $2 limit 1",
    [owner.storeId, TODAY],
  );
  const nov = { de: "2026-11-01", ate: "2026-11-30" };
  const profit = async () => (await loadReport(owner, nov, TODAY)).vendas.find((v) => v.id === sale.id)!.lucro!;
  const before = await profit();
  expect((await addExpense(owner, tires({ vehicleId: sale.vehicle_id, amount: 1000 }), TODAY)).ok).toBe(true);
  expect(await profit()).toBe(before - 1000);
});

it("reads the typed amount as whole reais", () => {
  const form = (amount: string) => formData({ vehicleId: carId, category: "tires", spentOn: TODAY, amount, description: "" });
  expect(readExpense(form("89,90"))).toMatchObject({ input: { amount: 89 } });
  expect(readExpense(form("R$ 1.200"))).toMatchObject({ input: { amount: 1200 } });
  expect(readExpense(form(""))).toEqual({ field: "amount" });
  expect(readExpense(form("abc"))).toEqual({ field: "amount" });
});

it("removes an expense once", async () => {
  const added = await addExpense(owner, tires(), TODAY);
  if (!added.ok) throw new Error("expense not added");
  expect(await removeExpense(seller, added.id)).toEqual({ ok: false, error: "forbidden" });
  expect(await removeExpense(carla, added.id)).toEqual({ ok: false, error: "not_found" });
  expect(await removeExpense(owner, added.id)).toEqual({ ok: true });
  expect(await removeExpense(owner, added.id)).toEqual({ ok: false, error: "not_found" });
});

it("the car page shows the real cost in parts to a manager and nothing to a seller", async () => {
  const { CarroGestao } = await import("@/app/gestao/estoque/[slug]/CarroGestao");
  const base = { estoque: [], channels: [], sellers: [], leads: [], memberId: "m1" };
  const expenses: Expense[] = [{ id: "e1", category: "tires", spentOn: TODAY, amount: 1200, description: "Dois pneus" }];
  const veiculo = car({ money: { acquisitionCost: 50000, cost: 51200, profit: 9000, perDay: 0, sinceEntry: 0 } });
  const manager = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo, canManage: true, expenses })));
  expect(manager).toMatch(/Compra R\$\s?50\.000/);
  expect(manager).toMatch(/Despesas R\$\s?1\.200/);
  expect(manager).toMatch(/Custo com despesas R\$\s?51\.200/);
  expect(manager).toContain("Pneus");
  const consigned = car({ source: "consignment", money: { acquisitionCost: 50000, cost: 50000, profit: 9000, perDay: 0, sinceEntry: 0 } });
  expect(text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: consigned, canManage: true, expenses: [] })))).toContain(
    "Repasse ao dono",
  );
  const sellerView = text(
    renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: car({ money: null }), canManage: false, expenses: null })),
  );
  expect(sellerView).not.toMatch(/despesa|custo|lucro/i);
});
