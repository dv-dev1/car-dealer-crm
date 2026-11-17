import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { createLead, listLeads, loseLead } from "@/features/leads/model";
import { loadReport } from "@/features/reports/model";
import { recordSale, type SaleInput } from "@/features/sales/model";
import { getVehicle, listStock } from "@/features/stock/model";
import { withStore } from "@/shared/db/client";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const TODAY = "2026-11-13";

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
let carId: string;
let leadId: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  await restoreDemoStore(owner, TODAY);
  carId = (await adminQuery("select id from vehicles where store_id = $1 and status = 'available' limit 1", [owner.storeId]))[0].id;
  const lead = await createLead(seller, {
    name: "Joana Lima", phone: "", stage: "negotiating", vehicleId: carId, interest: null, channelId: null, sellerId: null,
    note: "", lastContactOn: null, visitOn: null, visitTime: null, cameOn: null, callBackOn: null,
  }, TODAY);
  if (!lead.ok) throw new Error("createLead failed");
  leadId = lead.id;
});

const sale = (over: Partial<SaleInput> = {}): SaleInput => ({
  vehicleId: carId, leadId, sellerId: null, price: 68000, payment: "financing", bank: "BV", financedAmount: 40000,
  soldOn: TODAY, returnPct: null, tradeIn: null, ...over,
});

const argo = { brand: "Fiat", model: "Argo", version: "Drive 1.0", modelYear: 2020, manufactureYear: 2020, km: 60000, fuel: "Flex",
  transmission: "Manual", value: 45000 };
const NOV = { de: "2026-11-01", ate: "2026-11-30" };

it("records a financed sale and the lead shows it", async () => {
  const result = await recordSale(seller, sale(), TODAY);
  expect(result).toMatchObject({ ok: true });
  expect((await listLeads(seller, TODAY)).find((l) => l.id === leadId)).toMatchObject({
    estagio: "vendeu", valorVenda: 68000, formaPagamento: "Financiamento", fechadoEm: expect.any(String),
  });
  expect((await adminQuery("select status from vehicles where id = $1", [carId]))[0].status).toBe("sold");
});

it("records a cash sale without bank or financed amount", async () => {
  expect(await recordSale(owner, sale({ payment: "cash", bank: "BV", financedAmount: 40000 }), TODAY)).toMatchObject({ ok: true });
  const [row] = await adminQuery("select payment, bank, financed_amount from sales where vehicle_id = $1", [carId]);
  expect(row).toEqual({ payment: "cash", bank: null, financed_amount: null });
});

it("names the field before calling the database", async () => {
  expect(await recordSale(owner, sale({ financedAmount: null }), TODAY)).toEqual({ ok: false, error: "invalid", field: "financedAmount" });
  expect(await recordSale(owner, sale({ financedAmount: 90000 }), TODAY)).toEqual({ ok: false, error: "invalid", field: "financedAmount" });
  expect(await recordSale(owner, sale({ price: 0 }), TODAY)).toEqual({ ok: false, error: "invalid", field: "price" });
  expect(await recordSale(owner, sale({ soldOn: "2026-11-14" }), TODAY)).toEqual({ ok: false, error: "invalid", field: "soldOn" });
  expect(await recordSale(owner, sale({ bank: "B".repeat(61) }), TODAY)).toEqual({ ok: false, error: "invalid", field: "bank" });
  expect(await recordSale(owner, sale({ vehicleId: "x" }), TODAY)).toEqual({ ok: false, error: "invalid", field: "vehicleId" });
});

it("translates the database refusals", async () => {
  await recordSale(owner, sale({ leadId: null }), TODAY);
  expect(await recordSale(owner, sale(), TODAY)).toEqual({ ok: false, error: "not_available" });
  const [other] = await adminQuery("select id from vehicles where store_id = $1 and status = 'available' limit 1", [owner.storeId]);
  const colleague = (await adminQuery(
    "select id from leads where store_id = $1 and stage = 'negotiating' and seller_id <> $2 limit 1", [owner.storeId, seller.membershipId],
  ))[0].id;
  expect(await recordSale(seller, sale({ vehicleId: other.id, leadId: colleague }), TODAY)).toEqual({ ok: false, error: "forbidden" });
  await loseLead(owner, colleague, null);
  expect(await recordSale(owner, sale({ vehicleId: other.id, leadId: colleague }), TODAY)).toEqual({ ok: false, error: "lead_closed" });
  expect(await recordSale(owner, sale({ vehicleId: "00000000-0000-4000-8000-000000000000", leadId: null }), TODAY)).toEqual({ ok: false, error: "not_found" });
});

it("a financed sale with a return adds it to the profit", async () => {
  const result = await recordSale(owner, sale({ price: 100000, financedAmount: 80000, returnPct: 3 }), TODAY);
  if (!result.ok) throw new Error(result.error);
  const [finance] = await adminQuery("select financing_return_pct::float8 as pct from sale_finances where sale_id = $1", [result.id]);
  expect(finance.pct).toBe(0.03);
  const [cost] = await adminQuery("select cost::float8 as cost from vehicle_costs where vehicle_id = $1", [carId]);
  const venda = (await loadReport(owner, NOV, TODAY)).vendas.find((v) => v.id === result.id)!;
  expect(venda.lucro).toBe(100000 - cost.cost + 2400);
});

it("a seller cannot record the return", async () => {
  expect(await recordSale(seller, sale({ returnPct: 2 }), TODAY)).toEqual({ ok: false, error: "forbidden" });
  expect((await adminQuery("select status from vehicles where id = $1", [carId]))[0].status).not.toBe("sold");
});

it("a cash sale with a return is invalid", async () => {
  expect(await recordSale(owner, sale({ payment: "cash", returnPct: 2 }), TODAY)).toMatchObject({ ok: false, error: "invalid" });
  expect(await recordSale(owner, sale({ returnPct: 21 }), TODAY)).toMatchObject({ ok: false, error: "invalid" });
});

it("a trade-in enters the stock in preparation, costing what was given", async () => {
  const result = await recordSale(seller, sale({ tradeIn: argo }), TODAY);
  if (!result.ok) throw new Error(result.error);
  const [row] = await adminQuery(
    "select v.slug, v.status, v.source, v.acquired_in_sale_id from sales s join vehicles v on v.id = s.trade_in_vehicle_id where s.id = $1",
    [result.id],
  );
  expect(row).toMatchObject({ status: "preparing", source: "trade_in", acquired_in_sale_id: result.id });
  expect(await getVehicle(owner, row.slug, TODAY)).toMatchObject({ title: "Fiat Argo Drive 1.0", km: 60000, money: { acquisitionCost: 45000 } });
  // What was given in trade is the car's cost: a seller does not see the car until it is ready to sell.
  expect(await getVehicle(seller, row.slug, TODAY)).toBeNull();
  expect((await listStock(seller, TODAY)).some((c) => c.slug === row.slug)).toBe(false);
  await adminQuery("update vehicles set status = 'available', price = 52000 where slug = $1", [row.slug]);
  expect(await getVehicle(seller, row.slug, TODAY)).toMatchObject({ price: 52000, money: null });
  const [trade] = await adminQuery("select trade_in_value::int as value from sale_trade_ins where sale_id = $1", [result.id]);
  expect(trade.value).toBe(45000);
});

it("refuses a bad trade-in", async () => {
  const bad = (over: Record<string, unknown>) => recordSale(seller, sale({ tradeIn: { ...argo, ...over } }), TODAY);
  for (const over of [{ value: 0 }, { brand: " " }, { modelYear: 1900, manufactureYear: 1900 }, { fuel: "Vapor" }, { km: -1 }]) {
    expect(await bad(over)).toEqual({ ok: false, error: "invalid", field: "tradeIn" });
  }
});

it("a reserved car sells only to the reservation's client", async () => {
  const other = await createLead(seller, {
    name: "Outro Cliente", phone: "", stage: "negotiating", vehicleId: carId, interest: null, channelId: null, sellerId: null,
    note: "", lastContactOn: null, visitOn: null, visitTime: null, cameOn: null, callBackOn: null,
  }, TODAY);
  if (!other.ok) throw new Error("createLead failed");
  const reserve = (expires: string, canceled = false) =>
    adminQuery(
      `insert into reservations (store_id, vehicle_id, lead_id, deposit, expires_on, canceled_at) values ($1, $2, $3, 1000, $4, $5)`,
      [owner.storeId, carId, other.id, expires, canceled ? new Date() : null],
    );
  await reserve("2000-01-01");
  await reserve("2099-01-01", true);
  await reserve("2099-01-01");
  expect(await recordSale(seller, sale(), TODAY)).toEqual({ ok: false, error: "reserved" });
  expect(await recordSale(seller, sale({ leadId: other.id }), TODAY)).toMatchObject({ ok: true });
});

it("a seller reads no sale profit, not even through the view", async () => {
  expect((await recordSale(owner, sale(), TODAY)).ok).toBe(true);
  expect(await withStore(seller, (db) => db.query("select * from sale_profits"))).toEqual([]);
  expect((await withStore(owner, (db) => db.query("select * from sale_profits"))).length).toBeGreaterThan(0);
});
