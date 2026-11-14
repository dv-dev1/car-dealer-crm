import { beforeEach, expect, it, vi } from "vitest";

import { createLeadAction, loseLeadAction, moveLeadAction, updateLeadAction } from "@/features/leads/actions";
import { recordSaleAction } from "@/features/sales/actions";
import type { MemberContext } from "@/shared/db/client";
import { todayIso } from "@/shared/today";

const guard = vi.hoisted(() => ({ requireMember: vi.fn() }));
vi.mock("@/features/auth/guard", () => guard);

const leads = vi.hoisted(() => ({ createLead: vi.fn(), updateLead: vi.fn(), moveLead: vi.fn(), loseLead: vi.fn() }));
vi.mock("@/features/leads/model", () => leads);

const sales = vi.hoisted(() => ({ recordSale: vi.fn() }));
vi.mock("@/features/sales/model", () => sales);

const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

const ctx: MemberContext = { storeId: "store-a", membershipId: "member-a", role: "seller", name: "Beto" };
const LEAD = "22222222-2222-4222-8222-222222222222";
const CAR = "11111111-1111-4111-8111-111111111111";
const EMPTY = { error: null };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  guard.requireMember.mockResolvedValue(ctx);
  for (const fn of Object.values(leads)) fn.mockResolvedValue({ ok: true, id: LEAD });
  sales.recordSale.mockResolvedValue({ ok: true, id: "sale-1" });
});

it("rejects a price with dots", async () => {
  const state = await recordSaleAction(EMPTY, form({ vehicleId: CAR, leadId: LEAD, price: "79.990", payment: "cash" }));
  expect(state).toEqual({ error: "Confira o campo: Valor da venda.", field: "price" });
  expect(sales.recordSale).not.toHaveBeenCalled();
});

it("asks for the financed amount only when financed", async () => {
  const financed = await recordSaleAction(EMPTY, form({ vehicleId: CAR, price: "68000", payment: "financing", financedAmount: "" }));
  expect(financed).toEqual({ error: "Confira o campo: Valor financiado.", field: "financedAmount" });
  await recordSaleAction(EMPTY, form({ vehicleId: CAR, price: "68000", payment: "cash", financedAmount: "", bank: "" }));
  expect(sales.recordSale).toHaveBeenCalledWith(ctx, expect.objectContaining({ payment: "cash", financedAmount: null, bank: null }));
});

it("shows the seller message for a colleague's lead", async () => {
  leads.moveLead.mockResolvedValue({ ok: false, error: "forbidden" });
  expect(await moveLeadAction(EMPTY, form({ id: LEAD, stage: "negotiating" }))).toEqual({ error: "Você só mexe nos seus clientes." });
  sales.recordSale.mockResolvedValue({ ok: false, error: "forbidden" });
  expect(await recordSaleAction(EMPTY, form({ vehicleId: CAR, leadId: LEAD, price: "68000", payment: "cash" }))).toEqual({
    error: "Você só registra a venda dos seus clientes.",
  });
  sales.recordSale.mockResolvedValue({ ok: false, error: "not_available" });
  expect((await recordSaleAction(EMPTY, form({ vehicleId: CAR, price: "68000", payment: "cash" }))).error).toBe("Este carro já foi vendido ou removido.");
  expect(cache.revalidatePath).not.toHaveBeenCalled();
});

it("moves, loses and records with the store's today", async () => {
  expect(await moveLeadAction(EMPTY, form({ id: LEAD, stage: "negotiating" }))).toEqual({ error: null, id: LEAD });
  expect(leads.moveLead).toHaveBeenCalledWith(ctx, LEAD, "negotiating");
  await loseLeadAction(EMPTY, form({ id: LEAD, reason: "Achou caro" }));
  expect(leads.loseLead).toHaveBeenCalledWith(ctx, LEAD, "Achou caro");
  await recordSaleAction(EMPTY, form({
    vehicleId: CAR, leadId: LEAD, sellerId: "", price: "68000", payment: "financing", bank: "BV", financedAmount: "40000",
  }));
  expect(sales.recordSale).toHaveBeenCalledWith(ctx, {
    vehicleId: CAR, leadId: LEAD, sellerId: null, price: 68000, payment: "financing", bank: "BV", financedAmount: 40000,
    soldOn: todayIso(),
  });
  expect(cache.revalidatePath).toHaveBeenCalledWith("/gestao", "layout");
});

it("reads the client form, empty fields as null, and names the field the model refused", async () => {
  const fields = {
    name: "Joana Lima", phone: "(83) 99111-0000", stage: "visit_scheduled", vehicleId: CAR, interest: "", channelId: "",
    sellerId: "", note: "Quer trocar", lastContactOn: "", visitOn: "2026-11-20", visitTime: "10:30", cameOn: "", callBackOn: "",
  };
  await createLeadAction(EMPTY, form(fields));
  expect(leads.createLead).toHaveBeenCalledWith(ctx, {
    name: "Joana Lima", phone: "(83) 99111-0000", stage: "visit_scheduled", vehicleId: CAR, interest: null, channelId: null,
    sellerId: null, note: "Quer trocar", lastContactOn: null, visitOn: "2026-11-20", visitTime: "10:30", cameOn: null, callBackOn: null,
  });
  leads.updateLead.mockResolvedValue({ ok: false, error: "invalid", field: "phone" });
  expect(await updateLeadAction(EMPTY, form({ ...fields, id: LEAD }))).toEqual({ error: "Confira o campo: Telefone.", field: "phone" });
  expect(leads.updateLead).toHaveBeenCalledWith(ctx, LEAD, expect.objectContaining({ name: "Joana Lima" }));
  leads.updateLead.mockResolvedValue({ ok: false, error: "not_editable" });
  expect((await updateLeadAction(EMPTY, form({ ...fields, id: LEAD }))).error).toBe("Este cliente já foi fechado.");
});
