// ─── AGREGAÇÕES DOS RELATÓRIOS (Fase 2 — interno) ────────────
// Números puros pra tela de Relatórios do gestor. Derivam do MOCK de vendas
// (`data/vendas-mock`) — quando o Supabase entrar, a fonte troca e estas funções
// seguem iguais (recebem os mesmos registros). Sem estado, sem React: só entrada
// → saída, fácil de conferir contra os dados.

import {
  vendasMock,
  funilMesMock,
  resumoVendas,
  type VendaRegistro,
  type FormaPagamento,
  type Janela,
} from "@/data/vendas-mock";
import { MESES } from "@/lib/hoje";

/** Vendas dentro de [de, ate] (ISO inclusive). */
function noIntervalo({ de, ate }: Janela): VendaRegistro[] {
  return vendasMock.filter((v) => v.dataVenda >= de && v.dataVenda <= ate);
}

// ─── Vendas mês a mês (o gráfico de barras do ano) ───────────
export interface MesResumo {
  mes: number; // 0-11
  label: string; // "Jan", "Fev"…
  faturamento: number;
  lucro: number;
  vendas: number;
}

/** Faturamento/lucro/vendas de cada mês do ano — pro gráfico de barras. */
export function vendasPorMes(ano: number): MesResumo[] {
  const meses: MesResumo[] = MESES.map((nome, i) => ({
    mes: i,
    label: nome.slice(0, 3),
    faturamento: 0,
    lucro: 0,
    vendas: 0,
  }));
  for (const v of vendasMock) {
    const [a, m] = v.dataVenda.split("-").map(Number);
    if (a !== ano) continue;
    const alvo = meses[m - 1];
    alvo.faturamento += v.valor;
    alvo.lucro += v.valor - v.custo;
    alvo.vendas += 1;
  }
  return meses;
}

// ─── Ranking de modelos ──────────────────────────────────────
export interface ModeloResumo {
  modelo: string;
  vendas: number;
  faturamento: number;
}

/** Modelos mais vendidos na janela, do mais pro menos. */
export function rankingModelos(janela: Janela): ModeloResumo[] {
  const mapa = new Map<string, ModeloResumo>();
  for (const v of noIntervalo(janela)) {
    const atual = mapa.get(v.modelo) ?? { modelo: v.modelo, vendas: 0, faturamento: 0 };
    atual.vendas += 1;
    atual.faturamento += v.valor;
    mapa.set(v.modelo, atual);
  }
  return [...mapa.values()].sort(
    (a, b) => b.vendas - a.vendas || b.faturamento - a.faturamento,
  );
}

// ─── Quebra por forma de pagamento ───────────────────────────
export interface FormaResumo {
  forma: FormaPagamento;
  vendas: number;
  valor: number;
  fatia: number; // fração 0..1 das vendas da janela
}

const ORDEM_FORMAS: FormaPagamento[] = ["Financiamento", "Troca + diferença", "À vista"];

/** Como os clientes pagaram na janela — contagem, valor e fatia do total. */
export function porFormaPagamento(janela: Janela): FormaResumo[] {
  const registros = noIntervalo(janela);
  const total = registros.length || 1;
  const mapa = new Map<FormaPagamento, FormaResumo>();
  for (const v of registros) {
    const atual =
      mapa.get(v.formaPagamento) ?? { forma: v.formaPagamento, vendas: 0, valor: 0, fatia: 0 };
    atual.vendas += 1;
    atual.valor += v.valor;
    mapa.set(v.formaPagamento, atual);
  }
  return ORDEM_FORMAS.filter((f) => mapa.has(f)).map((f) => {
    const r = mapa.get(f)!;
    return { ...r, fatia: r.vendas / total };
  });
}

// ─── Funil de conversão (mês corrente) ───────────────────────
export interface EtapaFunil {
  nome: string;
  valor: number;
  /** Conversão a partir da etapa anterior (0..1). A 1ª etapa é a base (1). */
  taxa: number;
}

/**
 * Funil do mês: Leads → Visitas → Negociação → Venda. Topo vem do
 * `funilMesMock` (volume do mês); a base (vendas) casa com as vendas reais de
 * julho. É sempre "do mês" — não muda com o seletor de período dos KPIs, porque
 * conversão só faz sentido sobre um mês fechado de entradas.
 */
export function funilConversao(): { etapas: EtapaFunil[]; conversaoGeral: number } {
  const vendas = resumoVendas("mes").vendas;
  const { leads, visitas, negociacoes } = funilMesMock;
  const bruto = [
    { nome: "Leads", valor: leads },
    { nome: "Visitas", valor: visitas },
    { nome: "Negociação", valor: negociacoes },
    { nome: "Vendas", valor: vendas },
  ];
  const etapas: EtapaFunil[] = bruto.map((e, i) => ({
    ...e,
    taxa: i === 0 ? 1 : bruto[i - 1].valor ? e.valor / bruto[i - 1].valor : 0,
  }));
  return { etapas, conversaoGeral: leads ? vendas / leads : 0 };
}
