import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { createLead, listLeads, loseLead } from "@/features/leads/model";
import { recordSale, type SaleInput } from "@/features/sales/model";
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
  soldOn: TODAY, ...over,
});

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
