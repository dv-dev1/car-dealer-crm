import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { RelatoriosView } from "@/app/gestao/relatorios/RelatoriosView";
import {
  funilConversao, porFormaPagamento, rankingModelos, resumoVendas, vendasPorMes, type Periodo, type VendaRelatorio,
} from "@/features/reports/rules";
import { resumoMetaMes } from "@/lib/metas";

vi.mock("@/features/reports/actions", () => ({ setGoalAction: vi.fn() }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const janela = { de: "2026-11-01", ate: "2026-11-30" };
const vendas: VendaRelatorio[] = [
  { id: "s1", dataVenda: "2026-11-05", valor: 100000, lucro: 10000, modelo: "Fiat Argo Drive", clienteNome: "Joana Lima",
    vendedor: "Beto", formaPagamento: "Financiamento" },
  { id: "s2", dataVenda: "2026-11-06", valor: 80000, lucro: 8000, modelo: "Jeep Compass", clienteNome: null,
    vendedor: "Ana", formaPagamento: "À vista" },
];

function page(comLucro: boolean, periodo: Periodo = "mes") {
  const vs = comLucro ? vendas : vendas.map((v) => ({ ...v, lucro: null }));
  return renderToStaticMarkup(createElement(RelatoriosView, {
    periodo, janela, rotulo: "novembro de 2026",
    resumo: resumoVendas(vs, janela, comLucro), meses: vendasPorMes(vs, 2026, comLucro), ano: 2026, mesCorrente: 10,
    ranking: rankingModelos(vs), formas: porFormaPagamento(vs), funil: funilConversao({ entraram: 10, vieram: 4, compraram: 2 }),
    vendas: vs, meta: resumoMetaMes({ alvo: 12, feito: 2, emNegociacao: 3, aguardandoRetorno: 1 }, "2026-11-16"),
    mesLabel: "Novembro", podeEditarMeta: comLucro,
  }));
}

it("a seller's report has no profit, margin or cost", () => {
  const html = text(page(false));
  expect(html).toContain("Faturamento");
  expect(html).not.toMatch(/lucro|margem|custo/i);
});

it("an owner's report shows profit and margin", () => {
  const html = text(page(true));
  expect(html).toContain("Lucro");
  expect(html).toContain("Margem");
});

it("the period buttons are links and the custom period is a form", () => {
  expect(page(true)).toContain('href="?periodo=semana"');
  expect(page(true)).not.toContain('name="de"');
  const custom = page(true, "custom");
  expect(custom).toContain('name="de"');
  expect(custom).toContain('name="ate"');
});

it("a sale without a client", () => {
  expect(text(page(true))).toContain("Cliente não informado");
});

it("the funnel shows the period's leads", () => {
  const html = text(page(true));
  for (const step of ["Clientes novos", "Vieram à loja", "Compraram"]) expect(html).toContain(step);
});
