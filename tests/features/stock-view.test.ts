import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { EstoqueGestao } from "@/app/gestao/estoque/EstoqueGestao";
import { car } from "./stock-car.ts";

vi.mock("@/features/ai/actions", () => ({ readDocumentAction: vi.fn(), generateAdAction: vi.fn(), draftMessageAction: vi.fn(), dailySummaryAction: vi.fn(), askStoreAction: vi.fn() }));
vi.mock("@/features/stock/actions", () => ({ setDocumentAction: vi.fn(), setAwayAction: vi.fn(), returnToStoreAction: vi.fn(), createReservationAction: vi.fn(), cancelReservationAction: vi.fn(), addExpenseAction: vi.fn(), removeExpenseAction: vi.fn(), setMarginAction: vi.fn(), removeVehicleAction: vi.fn() }));
vi.mock("@/features/leads/actions", () => ({
  createLeadAction: vi.fn(), updateLeadAction: vi.fn(), moveLeadAction: vi.fn(), loseLeadAction: vi.fn(),
}));
vi.mock("@/features/sales/actions", () => ({ recordSaleAction: vi.fn() }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

it("shows no cost or profit to a seller", () => {
  const html = renderToStaticMarkup(
    createElement(EstoqueGestao, { cars: [car({ money: null }), car({ money: null, minCashPrice: null })], canManage: false }),
  );
  expect(text(html)).not.toMatch(/custo|lucro|adicionar carro|definir margem/i);
  expect(text(html)).toContain("Mínimo à vista");
});

it("shows cost and profit to a manager", () => {
  const html = text(renderToStaticMarkup(createElement(EstoqueGestao, { cars: [car()], canManage: true })));
  expect(html).toContain("Custo");
  expect(html).toContain("Lucro");
  expect(html).toContain("Adicionar carro");
});

it("says the stock is empty", () => {
  expect(text(renderToStaticMarkup(createElement(EstoqueGestao, { cars: [], canManage: true })))).toContain(
    "Nenhum carro no estoque.",
  );
});

it("shows a car without photos as such", () => {
  expect(text(renderToStaticMarkup(createElement(EstoqueGestao, { cars: [car({ photos: [] })], canManage: true })))).toContain(
    "Sem foto",
  );
});

// The image optimizer of OpenNext only reads static assets, so a /fotos/ photo must skip it.
it("serves car photos straight from /fotos, not through the image optimizer", () => {
  const photos = [{ id: "p1", url: "/fotos/demo/fiat-argo/01.webp" }];
  const html = renderToStaticMarkup(createElement(EstoqueGestao, { cars: [car({ photos })], canManage: true }));
  expect(html).toContain('src="/fotos/demo/fiat-argo/01.webp"');
  expect(html).not.toContain("/_next/image");
});

it("the car page also serves its photos straight from /fotos", async () => {
  const { CarroGestao } = await import("@/app/gestao/estoque/[slug]/CarroGestao");
  const photos = [{ id: "p1", url: "/fotos/demo/fiat-argo/01.webp" }, { id: "p2", url: "/fotos/demo/fiat-argo/02.webp" }];
  const html = renderToStaticMarkup(createElement(CarroGestao, { veiculo: car({ photos }), estoque: [], canManage: true, channels: [], sellers: [], leads: [], memberId: "m1" }));
  expect(html).toContain('src="/fotos/demo/fiat-argo/02.webp"');
  expect(html).not.toContain("/_next/image");
});

// One name per number: "custo" with the expenses everywhere it is shown; the form asks for the purchase price.
it("names the cost with expenses as such on the car page", async () => {
  const { CarroGestao } = await import("@/app/gestao/estoque/[slug]/CarroGestao");
  const veiculo = car({ money: { acquisitionCost: 50000, cost: 53000, profit: 9000, perDay: 0, sinceEntry: 0 } });
  const html = text(renderToStaticMarkup(createElement(CarroGestao, { veiculo, estoque: [], canManage: true, channels: [], sellers: [], leads: [], memberId: "m1" })));
  expect(html).toMatch(/Custo com despesas R\$\s?53\.000/);
  expect(html).not.toContain("Custo de aquisição");
});

const pressed = (html: string) => [...html.matchAll(/aria-pressed="true"[^>]*>([^<(]+)/g)].map((match) => match[1].trim());

it("opens on the filter the address asks for, as the panel's cards link it", () => {
  const cars = [car({ title: "Com pendência", pendingDocs: 2 }), car({ title: "Em dia" })];
  const html = renderToStaticMarkup(createElement(EstoqueGestao, { cars, canManage: true, filtroInicial: "documento" }));
  expect(pressed(html)).toEqual(["Documento pendente"]);
  expect(text(html)).toContain("Com pendência");
  expect(text(html)).not.toContain("Em dia");
});

it("lists the reserved cars under their own filter", () => {
  const cars = [car({ title: "Separado", status: "reserved" }), car({ title: "Livre" })];
  const html = renderToStaticMarkup(createElement(EstoqueGestao, { cars, canManage: true, filtroInicial: "reservados" }));
  expect(pressed(html)).toEqual(["Reservados"]);
  expect(text(html)).toContain("Separado");
  expect(text(html)).not.toContain("Livre");
});

it("falls back to every car on an unknown filter, and on the price filter for a seller", () => {
  for (const [filtroInicial, canManage] of [["qualquer", true], ["baixar-preco", false]] as const) {
    const html = renderToStaticMarkup(
      createElement(EstoqueGestao, { cars: [car({ money: null })], canManage, filtroInicial }),
    );
    expect(pressed(html)).toEqual(["Todos"]);
  }
});

it("opens on the order the address asks for, and ignores an unknown one", () => {
  const ordered = renderToStaticMarkup(createElement(EstoqueGestao, { cars: [car()], canManage: true, ordemInicial: "patio-desc" }));
  expect(ordered).toMatch(/<option value="patio-desc" selected="">/);
  const unknown = renderToStaticMarkup(createElement(EstoqueGestao, { cars: [car()], canManage: true, ordemInicial: "x" }));
  expect(unknown).toMatch(/<option value="relevancia" selected="">/);
});
