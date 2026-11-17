// Pure report math over the store's sales: no database, no React, safe in the browser bundle.
import { MESES } from "@/lib/hoje";
import { isIsoDate } from "@/shared/today";

export type Periodo = "hoje" | "ontem" | "semana" | "mes" | "ano" | "custom";

export const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: "hoje", label: "Hoje" },
  { valor: "ontem", label: "Ontem" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mês" },
  { valor: "ano", label: "Ano" },
  { valor: "custom", label: "Personalizado" },
];

/** Days "YYYY-MM-DD", both inclusive. */
export type Janela = { de: string; ate: string };

export type FormaPagamento = "À vista" | "Financiamento";

/** One sale as the reports read it; `lucro` is null for a seller. */
export type VendaRelatorio = {
  id: string;
  dataVenda: string;
  valor: number;
  lucro: number | null;
  modelo: string;
  clienteNome: string | null;
  vendedor: string;
  formaPagamento: FormaPagamento;
};

export type ResumoVendas = {
  faturamento: number;
  lucro: number | null;
  vendas: number;
  ticketMedio: number;
  /** Fraction (0.09 = 9%). */
  margem: number | null;
  /** Running totals per day of the window, for the sparklines. */
  serie: { faturamento: number[]; lucro: number[] | null; vendas: number[] };
};

export type MesResumo = { mes: number; label: string; faturamento: number; lucro: number | null; vendas: number };
export type ModeloResumo = { modelo: string; vendas: number; faturamento: number };
export type FormaResumo = { forma: FormaPagamento; vendas: number; valor: number; fatia: number };
/** `taxa` is the share of the step before; the first step is 1. */
export type EtapaFunil = { nome: string; valor: number; taxa: number };
export type FunilNumeros = { entraram: number; vieram: number; compraram: number };

const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const brDate = (iso: string) => iso.split("-").reverse().join("/");

function monthOf(hoje: string): Janela {
  const [ano, mes] = hoje.split("-").map(Number);
  const mm = String(mes).padStart(2, "0");
  const lastDay = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${lastDay}` };
}

/** The period in the URL; anything unknown or invalid falls back to the store's month. */
export function lerPeriodo(params: { periodo?: string; de?: string; ate?: string }, hoje: string): { periodo: Periodo; janela: Janela } {
  const { periodo, de = "", ate = "" } = params;
  if (periodo === "hoje") return { periodo, janela: { de: hoje, ate: hoje } };
  if (periodo === "ontem") return { periodo, janela: { de: addDays(hoje, -1), ate: addDays(hoje, -1) } };
  if (periodo === "semana") return { periodo, janela: { de: addDays(hoje, -6), ate: hoje } };
  if (periodo === "ano") return { periodo, janela: { de: `${hoje.slice(0, 4)}-01-01`, ate: `${hoje.slice(0, 4)}-12-31` } };
  if (periodo === "custom" && isIsoDate(de) && isIsoDate(ate) && de <= ate && addDays(de, 365) >= ate) {
    return { periodo, janela: { de, ate } };
  }
  return { periodo: "mes", janela: monthOf(hoje) };
}

/** "novembro de 2026", "últimos 7 dias", "01/11/2026 a 15/11/2026"… */
export function rotuloPeriodo(periodo: Periodo, janela: Janela): string {
  switch (periodo) {
    case "hoje":
      return "hoje";
    case "ontem":
      return "ontem";
    case "semana":
      return "últimos 7 dias";
    case "mes":
      return `${MESES[Number(janela.de.slice(5, 7)) - 1].toLowerCase()} de ${janela.de.slice(0, 4)}`;
    case "ano":
      return janela.de.slice(0, 4);
    case "custom":
      return `${brDate(janela.de)} a ${brDate(janela.ate)}`;
  }
}

/** Revenue, profit and count of the window; profit, margin and its series stay null without `comLucro`. */
export function resumoVendas(vendas: VendaRelatorio[], janela: Janela, comLucro: boolean): ResumoVendas {
  const faturamento = vendas.reduce((s, v) => s + v.valor, 0);
  const lucro = vendas.reduce((s, v) => s + (v.lucro ?? 0), 0);
  const serie = { faturamento: [] as number[], lucro: [] as number[], vendas: [] as number[] };
  let f = 0;
  let l = 0;
  let n = 0;
  // 400 guards a huge window; lerPeriodo already caps it at a year.
  for (let dia = janela.de, i = 0; dia <= janela.ate && i < 400; dia = addDays(dia, 1), i++) {
    for (const v of vendas) {
      if (v.dataVenda !== dia) continue;
      f += v.valor;
      l += v.lucro ?? 0;
      n += 1;
    }
    serie.faturamento.push(f);
    serie.lucro.push(l);
    serie.vendas.push(n);
  }
  return {
    faturamento,
    lucro: comLucro ? lucro : null,
    vendas: vendas.length,
    ticketMedio: vendas.length ? Math.round(faturamento / vendas.length) : 0,
    margem: comLucro ? (faturamento ? lucro / faturamento : 0) : null,
    serie: { ...serie, lucro: comLucro ? serie.lucro : null },
  };
}

/** Each month of `ano`, for the bar chart. */
export function vendasPorMes(vendas: VendaRelatorio[], ano: number, comLucro: boolean): MesResumo[] {
  const meses: MesResumo[] = MESES.map((nome, i) => ({
    mes: i, label: nome.slice(0, 3), faturamento: 0, lucro: comLucro ? 0 : null, vendas: 0,
  }));
  for (const v of vendas) {
    const [a, m] = v.dataVenda.split("-").map(Number);
    if (a !== ano) continue;
    const alvo = meses[m - 1];
    alvo.faturamento += v.valor;
    if (alvo.lucro !== null) alvo.lucro += v.lucro ?? 0;
    alvo.vendas += 1;
  }
  return meses;
}

/** Best-selling models first, revenue breaks ties. */
export function rankingModelos(vendas: VendaRelatorio[]): ModeloResumo[] {
  const mapa = new Map<string, ModeloResumo>();
  for (const v of vendas) {
    const atual = mapa.get(v.modelo) ?? { modelo: v.modelo, vendas: 0, faturamento: 0 };
    atual.vendas += 1;
    atual.faturamento += v.valor;
    mapa.set(v.modelo, atual);
  }
  return [...mapa.values()].sort((a, b) => b.vendas - a.vendas || b.faturamento - a.faturamento);
}

const ORDEM_FORMAS: FormaPagamento[] = ["Financiamento", "À vista"];

/** How customers paid: count, value and share of the window's sales. */
export function porFormaPagamento(vendas: VendaRelatorio[]): FormaResumo[] {
  return ORDEM_FORMAS.map((forma) => {
    const daForma = vendas.filter((v) => v.formaPagamento === forma);
    return {
      forma,
      vendas: daForma.length,
      valor: daForma.reduce((s, v) => s + v.valor, 0),
      fatia: vendas.length ? daForma.length / vendas.length : 0,
    };
  }).filter((f) => f.vendas > 0);
}

/** The leads that entered in the period: how many came to the store and how many bought. */
export function funilConversao({ entraram, vieram, compraram }: FunilNumeros): { etapas: EtapaFunil[]; conversaoGeral: number } {
  const bruto = [
    { nome: "Clientes novos", valor: entraram },
    { nome: "Vieram à loja", valor: vieram },
    { nome: "Compraram", valor: compraram },
  ];
  const etapas = bruto.map((e, i) => ({
    ...e,
    taxa: i === 0 ? 1 : bruto[i - 1].valor ? e.valor / bruto[i - 1].valor : 0,
  }));
  return { etapas, conversaoGeral: entraram ? compraram / entraram : 0 };
}
