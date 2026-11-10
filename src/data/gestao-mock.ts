import type { Veiculo } from "@/types/veiculo";
import { veiculosMock } from "./veiculos-mock";

// ─── DADOS DE GESTÃO (Fase 2 — interno) ──────────────────────
// Camada de gestão sobre o estoque público. O site mostra preço e ficha; o
// painel do gestor mostra também custo, margem, dias no pátio e lucro. Esses
// números são MOCK plausível pra as telas ficarem vivas — quando o Supabase
// entrar, `src/lib/gestao.ts` troca esta fonte por queries. As telas não mudam.
//
// Regra de negócio: o vendedor não vê desconto até o gerente DEFINIR A MARGEM.
// Enquanto `margemDefinida` é false, o carro entra em "sem margem" e o desconto
// à vista fica travado (mínimo à vista = preço de tabela).

export interface GestaoInfo {
  /** O que a loja pagou no veículo (custo de aquisição). */
  custo: number;
  /** Dias parados no pátio desde a entrada. */
  diasEstoque: number;
  /** O gerente já liberou a margem de desconto pro vendedor? */
  margemDefinida: boolean;
  /** Desconto máximo à vista liberado, em R$ (0 enquanto sem margem). */
  descontoMax: number;
  /** Ainda em preparação (higienização, foto, documentação) — não anunciado. */
  emPreparacao?: boolean;
  /** Já vendido — sai das contas de disponível. */
  vendido?: boolean;
}

export type StatusGestao =
  | "disponivel"
  | "sem-margem"
  | "parado"
  | "preparacao"
  | "vendido";

/** Veículo enriquecido com os campos e derivados de gestão. */
export interface VeiculoGestao extends Veiculo, GestaoInfo {
  /** Menor preço à vista que o vendedor pode oferecer (tabela − desconto). */
  minimoAVista: number;
  /** Lucro no mínimo à vista (mínimo − custo). */
  lucro: number;
  status: Veiculo["status"];
  statusGestao: StatusGestao;
}

const DIAS_PARADO = 90;

// Gestão por id do veículo. Spread pensado pra exercitar todos os estados:
// 5 com margem definida, 3 sem, 1 parado (+90d), 0 vendido.
const gestaoPorId: Record<string, GestaoInfo> = {
  "1": { custo: 124000, diasEstoque: 0, margemDefinida: true, descontoMax: 6000 },
  "2": { custo: 203000, diasEstoque: 13, margemDefinida: true, descontoMax: 9000 },
  "3": { custo: 161000, diasEstoque: 22, margemDefinida: false, descontoMax: 0 },
  "4": { custo: 133000, diasEstoque: 5, margemDefinida: true, descontoMax: 5000 },
  "5": { custo: 214000, diasEstoque: 40, margemDefinida: false, descontoMax: 0 },
  "6": { custo: 366000, diasEstoque: 13, margemDefinida: true, descontoMax: 12000 },
  "7": { custo: 111000, diasEstoque: 67, margemDefinida: true, descontoMax: 5500 },
  "8": { custo: 96000, diasEstoque: 95, margemDefinida: false, descontoMax: 0 },
};

function derivarStatus(v: Veiculo, g: GestaoInfo): StatusGestao {
  if (g.vendido || v.status === "vendido") return "vendido";
  if (g.emPreparacao) return "preparacao";
  if (!g.margemDefinida) return "sem-margem";
  if (g.diasEstoque > DIAS_PARADO) return "parado";
  return "disponivel";
}

/** Junta o veículo público com sua gestão e calcula mínimo à vista + lucro. */
export function comGestao(v: Veiculo): VeiculoGestao {
  const g =
    gestaoPorId[v.id] ??
    ({ custo: Math.round(v.preco * 0.88), diasEstoque: 0, margemDefinida: false, descontoMax: 0 } satisfies GestaoInfo);
  const minimoAVista = v.preco - (g.margemDefinida ? g.descontoMax : 0);
  return {
    ...v,
    ...g,
    minimoAVista,
    lucro: minimoAVista - g.custo,
    statusGestao: derivarStatus(v, g),
  };
}

/** Estoque completo já enriquecido pra gestão. */
export const estoqueGestao: VeiculoGestao[] = veiculosMock.map(comGestao);

/** Um veículo de gestão pelo slug (detalhe). */
export function veiculoGestaoPorSlug(slug: string): VeiculoGestao | undefined {
  const v = veiculosMock.find((x) => x.slug === slug);
  return v ? comGestao(v) : undefined;
}

/** Números do topo da lista (os 3 stat cards). */
export function resumoEstoque(itens: VeiculoGestao[]) {
  const noPatio = itens.filter((i) => i.statusGestao !== "vendido");
  return {
    total: noPatio.length,
    disponiveis: noPatio.length,
    semMargem: noPatio.filter((i) => i.statusGestao === "sem-margem").length,
    parados: noPatio.filter((i) => i.diasEstoque > DIAS_PARADO && i.statusGestao !== "vendido").length,
  };
}

// Limiares de atenção no giro (dias no pátio). Acima de PARADO é perigo;
// entre ATENCAO e PARADO é âmbar; abaixo, tranquilo.
export const GIRO_ATENCAO = 60;
export const GIRO_PARADO = DIAS_PARADO; // 90

/** Foto do dinheiro no pátio: quanto está investido, quanto vale, lucro esperado. */
export function resumoLoja(itens: VeiculoGestao[]) {
  const noPatio = itens.filter((i) => i.statusGestao !== "vendido");
  return {
    total: noPatio.length,
    /** Custo de aquisição somado — o capital imobilizado no estoque. */
    investido: noPatio.reduce((s, i) => s + i.custo, 0),
    /** Preço de tabela somado — o que o pátio vale à venda. */
    valeNaVenda: noPatio.reduce((s, i) => s + i.preco, 0),
    /** Lucro somado no mínimo à vista — o que sobra se vender tudo na margem atual. */
    lucroEsperado: noPatio.reduce((s, i) => s + i.lucro, 0),
    semMargem: noPatio.filter((i) => i.statusGestao === "sem-margem").length,
  };
}

/** Nível de atenção de um veículo pelo tempo de pátio. */
export function nivelGiro(dias: number): "ok" | "atencao" | "parado" {
  if (dias > GIRO_PARADO) return "parado";
  if (dias >= GIRO_ATENCAO) return "atencao";
  return "ok";
}

/** Os `n` veículos há mais tempo no pátio (giro travado primeiro). */
export function giroEstoque(itens: VeiculoGestao[], n = 3): VeiculoGestao[] {
  return itens
    .filter((i) => i.statusGestao !== "vendido")
    .sort((a, b) => b.diasEstoque - a.diasEstoque)
    .slice(0, n);
}
