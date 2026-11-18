import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { priceSuggestion } from "@/features/stock/rules";
import { car } from "./stock-car.ts";

vi.mock("@/features/ai/actions", () => ({ readDocumentAction: vi.fn(), generateAdAction: vi.fn(), draftMessageAction: vi.fn(), dailySummaryAction: vi.fn(), askStoreAction: vi.fn() }));
vi.mock("@/features/stock/actions", () => ({ setDocumentAction: vi.fn(), setAwayAction: vi.fn(), returnToStoreAction: vi.fn(), createReservationAction: vi.fn(), cancelReservationAction: vi.fn(), addExpenseAction: vi.fn(), removeExpenseAction: vi.fn(),
  setMarginAction: vi.fn(), removeVehicleAction: vi.fn(),
}));
vi.mock("@/features/leads/actions", () => ({
  createLeadAction: vi.fn(), updateLeadAction: vi.fn(), moveLeadAction: vi.fn(), loseLeadAction: vi.fn(),
}));
vi.mock("@/features/sales/actions", () => ({ recordSaleAction: vi.fn() }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const money = { acquisitionCost: 58000, cost: 60000, profit: 10000, perDay: 20, sinceEntry: 1500 };
const parked = (over: Parameters<typeof car>[0] = {}) => car({ status: "available", daysInStock: 75, price: 70000, minCashPrice: null, money, ...over });

it("a car parked 60 days or more gets a lower price that pays the wait", () => {
  expect(priceSuggestion(parked())).toEqual({ moneyCost: 600, depreciation: 700, waitCost: 1300, floor: 61800, suggested: 68700 });
  expect(priceSuggestion(parked({ daysInStock: 60 }))!.suggested).toBe(68700);
});

it("never suggests below the real cost plus the minimum margin, nor below the cash minimum", () => {
  expect(priceSuggestion(parked({ price: 62000 }))!.suggested).toBe(61800);
  expect(priceSuggestion(parked({ price: 61500 }))).toMatchObject({ floor: 61800, suggested: null });
  expect(priceSuggestion(parked({ price: 61800 }))!.suggested).toBeNull();
  expect(priceSuggestion(parked({ minCashPrice: 69500 }))).toMatchObject({ floor: 69500, suggested: 69500 });
  expect(priceSuggestion(parked({ minCashPrice: 70000 }))!.suggested).toBeNull();
});

it("says nothing for a car under 60 days, not for sale now, or to who reads no cost", () => {
  expect(priceSuggestion(parked({ daysInStock: 59 }))).toBeNull();
  for (const status of ["reserved", "away", "preparing", "sold"] as const) expect(priceSuggestion(parked({ status }))).toBeNull();
  const reservation = { id: "r1", leadName: null, deposit: 500, expiresOn: "2026-11-20", mine: false };
  expect(priceSuggestion(parked({ reservation }))).toBeNull();
  expect(priceSuggestion(parked({ money: null }))).toBeNull();
});

it("the car page shows the suggestion to who manages, and nothing of it to a seller", async () => {
  const { CarroGestao } = await import("@/app/gestao/estoque/[slug]/CarroGestao");
  const base = { estoque: [], channels: [], sellers: [], leads: [], memberId: "m1", canManage: true, expenses: [] };
  const html = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: parked() })));
  expect(html).toMatch(/Esperar mais 30 dias custa R\$\s?1\.300/);
  expect(html).toMatch(/Baixar para R\$\s?68\.700/);
  expect(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: parked({ slug: "onix-parado" }) }))).toMatch(
    /href="\/gestao\/estoque\/onix-parado\/editar"[^>]*>(<[^>]+>)*Mudar o preço/,
  );
  const atFloor = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: parked({ price: 61500 }) })));
  expect(atFloor).toContain("O preço já está no limite");
  expect(atFloor).not.toContain("Baixar para");

  const seller = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, canManage: false, expenses: null, veiculo: parked({ money: null }) })));
  expect(seller).not.toContain("Esperar mais 30 dias");
  expect(seller).not.toContain("O preço já está no limite");
  const fresh = text(renderToStaticMarkup(createElement(CarroGestao, { ...base, veiculo: parked({ daysInStock: 20 }) })));
  expect(fresh).not.toContain("Esperar mais 30 dias");
});
