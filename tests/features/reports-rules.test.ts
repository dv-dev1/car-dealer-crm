import { expect, it } from "vitest";
import {
  funilConversao, lerPeriodo, porFormaPagamento, rankingModelos, resumoVendas, rotuloPeriodo, vendasPorMes,
  type VendaRelatorio,
} from "@/features/reports/rules";

const HOJE = "2026-11-16";

const venda = (over: Partial<VendaRelatorio> = {}): VendaRelatorio => ({
  id: "s1", dataVenda: "2026-11-05", valor: 100000, lucro: 10000, modelo: "Fiat Argo Drive", clienteNome: "Joana",
  vendedor: "Beto", formaPagamento: "Financiamento", ...over,
});

it("reads the period from the URL and falls back to the month", () => {
  const mes = { periodo: "mes", janela: { de: "2026-11-01", ate: "2026-11-30" } };
  expect(lerPeriodo({}, HOJE)).toEqual(mes);
  expect(lerPeriodo({ periodo: "semana" }, HOJE)).toEqual({ periodo: "semana", janela: { de: "2026-11-10", ate: "2026-11-16" } });
  expect(lerPeriodo({ periodo: "ano" }, HOJE)).toEqual({ periodo: "ano", janela: { de: "2026-01-01", ate: "2026-12-31" } });
  expect(lerPeriodo({ periodo: "hoje" }, HOJE).janela).toEqual({ de: HOJE, ate: HOJE });
  expect(lerPeriodo({ periodo: "ontem" }, HOJE).janela).toEqual({ de: "2026-11-15", ate: "2026-11-15" });
  expect(lerPeriodo({ periodo: "mes" }, "2028-02-10").janela).toEqual({ de: "2028-02-01", ate: "2028-02-29" });
  expect(lerPeriodo({ periodo: "custom", de: "2026-02-31", ate: "2026-03-05" }, HOJE)).toEqual(mes);
  expect(lerPeriodo({ periodo: "custom", de: "2026-11-10", ate: "2026-11-01" }, HOJE)).toEqual(mes);
  expect(lerPeriodo({ periodo: "custom", de: "2025-01-01", ate: "2026-11-16" }, HOJE)).toEqual(mes);
  expect(lerPeriodo({ periodo: "xyz" }, HOJE)).toEqual(mes);
  const custom = lerPeriodo({ periodo: "custom", de: "2026-11-01", ate: "2026-11-15" }, HOJE);
  expect(custom).toEqual({ periodo: "custom", janela: { de: "2026-11-01", ate: "2026-11-15" } });
  expect(rotuloPeriodo(custom.periodo, custom.janela)).toBe("01/11/2026 a 15/11/2026");
  expect(rotuloPeriodo("mes", mes.janela)).toBe("novembro de 2026");
  expect(rotuloPeriodo("ano", { de: "2026-01-01", ate: "2026-12-31" })).toBe("2026");
  expect(rotuloPeriodo("semana", { de: "2026-11-10", ate: HOJE })).toBe("últimos 7 dias");
});

it("summarizes revenue, profit and margin, without profit for a seller", () => {
  const vendas = [venda(), venda({ id: "s2", dataVenda: "2026-11-10", valor: 50000, lucro: 5000 })];
  const janela = { de: "2026-11-01", ate: "2026-11-30" };
  const dono = resumoVendas(vendas, janela, true);
  expect(dono).toMatchObject({ faturamento: 150000, lucro: 15000, vendas: 2, ticketMedio: 75000, margem: 0.1 });
  expect(dono.serie.faturamento).toHaveLength(30);
  expect(dono.serie.lucro?.[9]).toBe(15000);
  const vendedor = resumoVendas(vendas.map((v) => ({ ...v, lucro: null })), janela, false);
  expect(vendedor).toMatchObject({ faturamento: 150000, lucro: null, margem: null, vendas: 2 });
  expect(vendedor.serie.lucro).toBeNull();
});

it("groups the year's sales by month", () => {
  const meses = vendasPorMes([venda(), venda({ id: "s2", dataVenda: "2026-03-02", valor: 80000, lucro: 6000 })], 2026, true);
  expect(meses).toHaveLength(12);
  expect(meses[10]).toMatchObject({ label: "Nov", faturamento: 100000, lucro: 10000, vendas: 1 });
  expect(meses[2]).toMatchObject({ faturamento: 80000, lucro: 6000, vendas: 1 });
  expect(meses[0]).toMatchObject({ faturamento: 0, vendas: 0 });
  expect(vendasPorMes([venda({ lucro: null })], 2026, false)[10].lucro).toBeNull();
});

it("ranks models and payments", () => {
  const vendas = [
    venda(), venda({ id: "s2", modelo: "Jeep Compass", valor: 150000, formaPagamento: "À vista" }),
    venda({ id: "s3", modelo: "Jeep Compass", valor: 140000 }),
  ];
  expect(rankingModelos(vendas).map((m) => [m.modelo, m.vendas])).toEqual([["Jeep Compass", 2], ["Fiat Argo Drive", 1]]);
  expect(porFormaPagamento(vendas).map((f) => [f.forma, f.vendas])).toEqual([["Financiamento", 2], ["À vista", 1]]);
  expect(porFormaPagamento(vendas)[1].fatia).toBeCloseTo(1 / 3);
});

it("builds the funnel from the period's leads", () => {
  const { etapas, conversaoGeral } = funilConversao({ entraram: 10, vieram: 4, compraram: 2 });
  expect(etapas.map((e) => e.nome)).toEqual(["Clientes novos", "Vieram à loja", "Compraram"]);
  expect(etapas.map((e) => e.taxa)).toEqual([1, 0.4, 0.5]);
  expect(conversaoGeral).toBe(0.2);
  const vazio = funilConversao({ entraram: 0, vieram: 0, compraram: 0 });
  expect(vazio.etapas.map((e) => e.taxa)).toEqual([1, 0, 0]);
  expect(vazio.conversaoGeral).toBe(0);
});
