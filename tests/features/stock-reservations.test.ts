import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { createLead } from "@/features/leads/model";
import { recordSale } from "@/features/sales/model";
import { getVehicle, listStock } from "@/features/stock/model";
import { cancelReservation, createReservation } from "@/features/stock/reservations";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";
import { car } from "./stock-car.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
vi.mock("@/features/stock/actions", () => ({
  setMarginAction: vi.fn(), removeVehicleAction: vi.fn(), addExpenseAction: vi.fn(), removeExpenseAction: vi.fn(),
  setAwayAction: vi.fn(), returnToStoreAction: vi.fn(), createReservationAction: vi.fn(), cancelReservationAction: vi.fn(),
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
let colleague: StoreMember;
let carro: { id: string; slug: string };
let leadId: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  await restoreDemoStore(owner, TODAY);
  const [other] = await adminQuery(
    "select id, name from memberships where store_id = $1 and role = 'seller' and id <> $2 limit 1", [owner.storeId, seller.membershipId],
  );
  colleague = { ...seller, membershipId: other.id, name: other.name };
  carro = (await listStock(owner, TODAY)).find((c) => c.status === "available")!;
  const lead = await createLead(seller, {
    name: "Paula Reserva", phone: "", stage: "negotiating", vehicleId: carro.id, interest: null, channelId: null, sellerId: null,
    note: "", lastContactOn: null, visitOn: null, visitTime: null, cameOn: null, callBackOn: null,
  }, TODAY);
  if (!lead.ok) throw new Error("createLead failed");
  leadId = lead.id;
});

const reserve = (who: StoreMember, over: Record<string, unknown> = {}) =>
  createReservation(who, { vehicleId: carro.id, leadId, deposit: 1000, expiresOn: "2026-11-16", ...over }, TODAY);

it("a seller reserves a car for their client and it reads as reserved", async () => {
  const result = await reserve(seller);
  expect(result.ok).toBe(true);
  const reserved = (await listStock(seller, TODAY)).find((c) => c.id === carro.id)!;
  expect(reserved.status).toBe("reserved");
  expect(reserved.reservation).toMatchObject({ leadName: "Paula Reserva", deposit: 1000, expiresOn: "2026-11-16", mine: true });
  expect((await getVehicle(owner, carro.slug, TODAY))!.reservation).toMatchObject({ mine: false });
  expect(await reserve(owner, { leadId: null })).toEqual({ ok: false, error: "reserved" });
});

it("refuses a car not on sale and a bad deposit or date", async () => {
  const [preparing] = await adminQuery("select id from vehicles where store_id = $1 and status = 'preparing' limit 1", [owner.storeId]);
  const [sold] = await adminQuery("select id from vehicles where store_id = $1 and status = 'sold' limit 1", [owner.storeId]);
  for (const id of [preparing.id, sold.id]) expect(await reserve(owner, { vehicleId: id, leadId: null })).toEqual({ ok: false, error: "not_found" });
  await adminQuery("update vehicles set status = 'away', away_reason = 'service' where id = $1", [carro.id]);
  expect(await reserve(seller)).toEqual({ ok: false, error: "not_found" });
  await adminQuery("update vehicles set status = 'available', away_reason = null where id = $1", [carro.id]);
  for (const over of [{ deposit: 0 }, { expiresOn: "2026-11-12" }, { expiresOn: "2026-12-14" }, { expiresOn: "2026-02-31" }]) {
    expect(await reserve(seller, over)).toEqual({ ok: false, error: "invalid" });
  }
  expect(await reserve(colleague)).toEqual({ ok: false, error: "forbidden" });
});

it("a seller cancels their own reservation, not a colleague's; the owner cancels any", async () => {
  const mine = await reserve(seller);
  if (!mine.ok) throw new Error(mine.error);
  expect(await cancelReservation(colleague, mine.id)).toEqual({ ok: false, error: "forbidden" });
  expect(await cancelReservation(seller, mine.id)).toEqual({ ok: true });
  expect(await cancelReservation(seller, mine.id)).toEqual({ ok: false, error: "not_found" });
  expect((await listStock(owner, TODAY)).find((c) => c.id === carro.id)!.status).toBe("available");
  const again = await reserve(colleague, { leadId: null });
  if (!again.ok) throw new Error(again.error);
  expect(await cancelReservation(owner, again.id)).toEqual({ ok: true });
});

it("an expired reservation lets the car go back to available on its own", async () => {
  expect((await reserve(seller)).ok).toBe(true);
  const later = (await listStock(owner, "2026-11-17")).find((c) => c.id === carro.id)!;
  expect(later).toMatchObject({ status: "available", reservation: null });
});

it("the car page shows the reservation and who can cancel it", async () => {
  const { CarroGestao } = await import("@/app/gestao/estoque/[slug]/CarroGestao");
  const base = { estoque: [], channels: [], sellers: [], leads: [], memberId: "m1", today: TODAY };
  const reservation = { id: "r1", leadName: "Paula Reserva", deposit: 1000, expiresOn: "2026-11-16", mine: false };
  const reserved = car({ status: "reserved", reservation });
  const ownerView = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: reserved, canManage: true })));
  expect(ownerView).toContain("Reservado para Paula Reserva até 16/11");
  expect(ownerView).toMatch(/Sinal R\$\s?1\.000/);
  expect(ownerView).toContain("Cancelar reserva");
  const sellerView = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: reserved, canManage: false })));
  expect(sellerView).not.toContain("Cancelar reserva");
  const own = car({ status: "reserved", reservation: { ...reservation, mine: true } });
  expect(text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: own, canManage: false })))).toContain("Cancelar reserva");
  expect(text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: car(), canManage: false })))).toContain("Reservar");
});

it("a sold car shows no reservation", async () => {
  expect((await reserve(seller)).ok).toBe(true);
  const sold = await recordSale(seller, {
    vehicleId: carro.id, leadId, sellerId: null, price: 60000, payment: "cash", bank: null, financedAmount: null, soldOn: TODAY,
    returnPct: null, tradeIn: null,
  }, TODAY);
  expect(sold.ok).toBe(true);
  expect(await getVehicle(owner, carro.slug, TODAY)).toMatchObject({ status: "sold", reservation: null });
});
