import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EstoqueGestao } from "@/app/gestao/estoque/EstoqueGestao";
import { car } from "./stock-car.ts";

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
