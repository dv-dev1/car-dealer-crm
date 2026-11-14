import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { EstoqueGestao } from "@/app/gestao/estoque/EstoqueGestao";
import { car } from "./stock-car.ts";

vi.mock("@/features/stock/actions", () => ({ setMarginAction: vi.fn(), removeVehicleAction: vi.fn() }));

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
  const html = renderToStaticMarkup(createElement(CarroGestao, { veiculo: car({ photos }), estoque: [], canManage: true }));
  expect(html).toContain('src="/fotos/demo/fiat-argo/02.webp"');
  expect(html).not.toContain("/_next/image");
});
