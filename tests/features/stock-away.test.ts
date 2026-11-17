import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { getVehicle, listStock, returnToStore, setAway } from "@/features/stock/model";
import { statusLabel, stockSummary } from "@/features/stock/rules";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";
import { car } from "./stock-car.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
vi.mock("@/features/stock/actions", () => ({
  setMarginAction: vi.fn(), removeVehicleAction: vi.fn(), addExpenseAction: vi.fn(), removeExpenseAction: vi.fn(),
  setAwayAction: vi.fn(), returnToStoreAction: vi.fn(),
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
let manager: StoreMember;
let seller: StoreMember;
let available: { id: string; slug: string };
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  manager = { ...owner, role: "manager", name: "Gerente" };
  await restoreDemoStore(owner, TODAY);
  available = (await listStock(owner, TODAY)).find((c) => c.status === "available")!;
});

it("a manager takes a car out for service and brings it back", async () => {
  const investedBefore = stockSummary(await listStock(owner, TODAY)).invested;
  expect(await setAway(manager, available.id, "service", "2026-11-23", TODAY)).toEqual({ ok: true });
  const away = await getVehicle(owner, available.slug, TODAY);
  expect(away).toMatchObject({ status: "away", away: { reason: "service", until: "2026-11-23" } });
  const stock = await listStock(owner, TODAY);
  expect(stock.some((c) => c.id === available.id)).toBe(true);
  expect(stockSummary(stock).invested).toBe(investedBefore);
  expect(await returnToStore(manager, available.id)).toEqual({ ok: true });
  expect(await getVehicle(owner, available.slug, TODAY)).toMatchObject({ status: "available", away: null });
});

it("takes a car out without a return date", async () => {
  expect(await setAway(owner, available.id, "other", null, TODAY)).toEqual({ ok: true });
  expect((await getVehicle(owner, available.slug, TODAY))!.away).toEqual({ reason: "other", until: null });
});

it("refuses a bad away", async () => {
  const invalid = { ok: false, error: "invalid" };
  expect(await setAway(owner, available.id, "xyz" as never, null, TODAY)).toEqual(invalid);
  expect(await setAway(owner, available.id, "repair", "2026-11-12", TODAY)).toEqual(invalid);
  expect(await setAway(owner, available.id, "repair", "2026-02-31", TODAY)).toEqual(invalid);
  const [sold] = await adminQuery("select id from vehicles where store_id = $1 and status = 'sold' limit 1", [owner.storeId]);
  expect(await setAway(owner, sold.id, "repair", null, TODAY)).toEqual({ ok: false, error: "not_found" });
  expect(await setAway(seller, available.id, "repair", null, TODAY)).toEqual({ ok: false, error: "forbidden" });
  expect(await returnToStore(owner, available.id)).toEqual(invalid);
  expect(await returnToStore(seller, available.id)).toEqual({ ok: false, error: "forbidden" });
});

it("an away car shows the reason and an overdue return", async () => {
  expect(statusLabel(car({ status: "away", away: { reason: "body_shop", until: null } }))).toBe("Fora da loja · Funilaria");
  expect(statusLabel(car({ status: "reserved" }))).toBe("Reservado");
  const { CarroGestao } = await import("@/app/gestao/estoque/[slug]/CarroGestao");
  const base = { estoque: [], channels: [], sellers: [], leads: [], memberId: "m1", canManage: true, expenses: [], today: "2026-11-16" };
  const late = text(renderToStaticMarkup(createElement(CarroGestao, {
    ...base, veiculo: car({ status: "away", away: { reason: "repair", until: "2026-11-10" } }),
  })));
  expect(late).toContain("Oficina");
  expect(late).toContain("Volta prevista passou");
  expect(late).toContain("Voltou para a loja");
  const open = text(renderToStaticMarkup(createElement(CarroGestao, {
    ...base, veiculo: car({ status: "away", away: { reason: "repair", until: null } }),
  })));
  expect(open).toContain("Oficina");
  expect(open).not.toContain("Volta prevista");
  const here = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: car() })));
  expect(here).toContain("Tirar da loja");
  const sellerView = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, canManage: false, veiculo: car({ money: null }) })));
  expect(sellerView).not.toMatch(/Tirar da loja|Voltou para a loja/);
});
