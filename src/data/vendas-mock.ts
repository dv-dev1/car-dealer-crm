import type { Venda } from "@/types/veiculo";
import { HOJE_ISO, somaDias, isoParaData, MESES } from "@/lib/hoje";

// ─── VENDAS E META (Fase 2 — interno) ────────────────────────
// Histórico de vendas do gestor + meta do mês. Alimentam a "Visão de vendas"
// e o aviso de meta do Painel. Números MOCK plausíveis pra as telas ficarem
// vivas — quando o Supabase entrar, `src/lib/vendas.ts` troca esta fonte por
// queries à tabela `vendas`. As telas não mudam.
//
// Ancorado em HOJE_ISO (2026-07-21) pra ficar determinístico com o resto do
// painel. Julho é o mês corrente: 3 vendas fechadas, meta de 5.

/** Venda com o custo do veículo, pra derivar lucro e margem. */
export interface VendaRegistro extends Venda {
  /** O que a loja pagou no veículo vendido (custo de aquisição). */
  custo: number;
  /** Modelo vendido — alimenta o ranking de veículos dos Relatórios. */
  modelo: string;
  /** Forma de pagamento — alimenta a quebra de pagamento dos Relatórios. */
  formaPagamento: FormaPagamento;
}

// Formas de pagamento do seminovo — o essencial pro relatório. Financiamento é o
// grosso; troca com diferença é forte no usado; à vista é a minoria premium.
export type FormaPagamento = "Financiamento" | "Troca + diferença" | "À vista";

// Vendas de 2026 até hoje. Espalhadas pra "Ano" ficar cheio e "Mês"/"Semana"
// serem recortes reais. Margem entre ~7% e ~13% — seminovo premium gira apertado.
// Modelo e forma de pagamento plausíveis com o valor (SW4/RAM/GLA em cima,
// Corolla/Jetta/BYD embaixo) — mock até o Supabase.
export const vendasMock: VendaRegistro[] = [
  // Janeiro
  { id: "v01", dataVenda: "2026-01-11", valor: 112000, custo: 101000, vendedor: "Cassiano", clienteNome: "Eduardo M.", modelo: "Toyota Corolla XEI", formaPagamento: "Financiamento" },
  { id: "v02", dataVenda: "2026-01-27", valor: 168000, custo: 152000, vendedor: "Cassiano", clienteNome: "Regina P.", modelo: "Jeep Compass Longitude", formaPagamento: "Troca + diferença" },
  // Fevereiro
  { id: "v03", dataVenda: "2026-02-08", valor: 94000, custo: 87000, vendedor: "Cassiano", clienteNome: "Marcos A.", modelo: "BYD Yuan Pro", formaPagamento: "Financiamento" },
  { id: "v04", dataVenda: "2026-02-19", valor: 205000, custo: 186000, vendedor: "Cassiano", clienteNome: "Fernanda L.", modelo: "Toyota SW4 Diamond", formaPagamento: "Troca + diferença" },
  { id: "v05", dataVenda: "2026-02-26", valor: 131000, custo: 119000, vendedor: "Cassiano", clienteNome: "Otávio R.", modelo: "Volkswagen Nivus Highline", formaPagamento: "Financiamento" },
  // Março
  { id: "v06", dataVenda: "2026-03-06", valor: 98000, custo: 90000, vendedor: "Cassiano", clienteNome: "Beatriz S.", modelo: "Volkswagen Jetta Comfortline", formaPagamento: "À vista" },
  { id: "v07", dataVenda: "2026-03-23", valor: 149000, custo: 134000, vendedor: "Cassiano", clienteNome: "Gustavo T.", modelo: "GAC GS3 Premium", formaPagamento: "Financiamento" },
  // Abril
  { id: "v08", dataVenda: "2026-04-03", valor: 122000, custo: 111000, vendedor: "Cassiano", clienteNome: "Helena C.", modelo: "Hyundai Creta Platinum", formaPagamento: "Troca + diferença" },
  { id: "v09", dataVenda: "2026-04-15", valor: 177000, custo: 160000, vendedor: "Cassiano", clienteNome: "Ricardo N.", modelo: "Mercedes-Benz GLA 200", formaPagamento: "Financiamento" },
  { id: "v10", dataVenda: "2026-04-22", valor: 89000, custo: 83000, vendedor: "Cassiano", clienteNome: "Paula V.", modelo: "BYD Yuan Pro", formaPagamento: "À vista" },
  { id: "v11", dataVenda: "2026-04-29", valor: 143000, custo: 129000, vendedor: "Cassiano", clienteNome: "André F.", modelo: "Honda HR-V EXL", formaPagamento: "Financiamento" },
  // Maio
  { id: "v12", dataVenda: "2026-05-09", valor: 214000, custo: 194000, vendedor: "Cassiano", clienteNome: "Sônia D.", modelo: "RAM Rampage Laramie", formaPagamento: "Troca + diferença" },
  { id: "v13", dataVenda: "2026-05-18", valor: 106000, custo: 97000, vendedor: "Cassiano", clienteNome: "Vinícius B.", modelo: "Toyota Corolla XEI", formaPagamento: "Financiamento" },
  { id: "v14", dataVenda: "2026-05-30", valor: 158000, custo: 143000, vendedor: "Cassiano", clienteNome: "Tânia O.", modelo: "GAC GS3 Premium", formaPagamento: "Troca + diferença" },
  // Junho
  { id: "v15", dataVenda: "2026-06-07", valor: 133000, custo: 121000, vendedor: "Cassiano", clienteNome: "Rogério A.", modelo: "Caoa Chery Tiggo 5X", formaPagamento: "Financiamento" },
  { id: "v16", dataVenda: "2026-06-16", valor: 189000, custo: 171000, vendedor: "Cassiano", clienteNome: "Cláudia M.", modelo: "Mercedes-Benz GLA 200", formaPagamento: "À vista" },
  { id: "v17", dataVenda: "2026-06-28", valor: 97000, custo: 90000, vendedor: "Cassiano", clienteNome: "Felipe G.", modelo: "Volkswagen Jetta Comfortline", formaPagamento: "Financiamento" },
  // Julho (mês corrente)
  { id: "v18", dataVenda: "2026-07-05", valor: 118000, custo: 106000, vendedor: "Cassiano", clienteNome: "Mariana R.", modelo: "Toyota Corolla XEI", formaPagamento: "Troca + diferença" },
  { id: "v19", dataVenda: "2026-07-14", valor: 96000, custo: 89000, vendedor: "Cassiano", clienteNome: "Diego S.", modelo: "Caoa Chery Tiggo 5X", formaPagamento: "Financiamento" },
  { id: "v20", dataVenda: "2026-07-20", valor: 152000, custo: 137000, vendedor: "Cassiano", clienteNome: "Letícia F.", modelo: "Jeep Compass Longitude", formaPagamento: "Financiamento" },
];

// ─── FUNIL DE CONVERSÃO (mês corrente) ───────────────────────
// Volume do topo do funil do mês — os leads em `clientes-mock` são um retrato do
// agora (7), pouco pra ler taxa de conversão. Estas contagens do mês dão corpo
// ao bloco "Funil de conversão" dos Relatórios. O piso (vendas) casa com as
// vendas reais de julho no `vendasMock`. Mock até o Supabase somar de verdade.
export const funilMesMock = {
  leads: 24, // clientes que entraram no funil no mês
  visitas: 13, // marcaram/fizeram visita
  negociacoes: 7, // chegaram a negociar preço
  // vendas vem do vendasMock (mês corrente) — não duplica número.
};

/** Meta de vendas do mês — quantos carros a loja se propôs a vender. */
export const META_VENDAS_MES = 5;

// ─── PERÍODOS ────────────────────────────────────────────────

export type Periodo = "hoje" | "ontem" | "semana" | "mes" | "ano" | "custom";

export const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: "hoje", label: "Hoje" },
  { valor: "ontem", label: "Ontem" },
  { valor: "semana", label: "Semana" },
  { valor: "mes", label: "Mês" },
  { valor: "ano", label: "Ano" },
  { valor: "custom", label: "Personalizado" },
];

export interface Janela {
  de: string; // ISO inclusive
  ate: string; // ISO inclusive
}

/** Recorte de datas [de, ate] de um período, ancorado em `ref` (default hoje). */
export function janelaDoPeriodo(
  periodo: Periodo,
  custom?: Janela,
  ref: string = HOJE_ISO,
): Janela {
  const [ano, mes] = ref.split("-");
  switch (periodo) {
    case "hoje":
      return { de: ref, ate: ref };
    case "ontem": {
      const ontem = somaDias(ref, -1);
      return { de: ontem, ate: ontem };
    }
    case "semana":
      return { de: somaDias(ref, -6), ate: ref }; // últimos 7 dias
    case "mes":
      return { de: `${ano}-${mes}-01`, ate: `${ano}-${mes}-31` };
    case "ano":
      return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
    case "custom":
      return custom ?? { de: ref, ate: ref };
  }
}

/** Rótulo do período pro cabeçalho ("julho de 2026", "hoje", "2026"…). */
export function rotuloPeriodo(periodo: Periodo, custom?: Janela, ref: string = HOJE_ISO): string {
  const [ano, mes] = ref.split("-");
  switch (periodo) {
    case "hoje":
      return "hoje";
    case "ontem":
      return "ontem";
    case "semana":
      return "últimos 7 dias";
    case "mes":
      return `${MESES[Number(mes) - 1].toLowerCase()} de ${ano}`;
    case "ano":
      return ano;
    case "custom":
      return custom ? `${custom.de} a ${custom.ate}` : "personalizado";
  }
}

// ─── AGREGAÇÃO ───────────────────────────────────────────────

export interface ResumoVendas {
  faturamento: number;
  lucro: number;
  vendas: number;
  ticketMedio: number;
  margem: number; // fração (0.09 = 9%)
  /** Séries acumuladas por dia da janela — pras sparklines. */
  serie: { lucro: number[]; faturamento: number[]; vendas: number[] };
}

/** Lista de ISOs (inclusive) entre de..ate. */
function diasDaJanela({ de, ate }: Janela): string[] {
  const dias: string[] = [];
  let atual = de;
  // Guarda contra janela invertida ou gigante.
  for (let i = 0; i < 400 && atual <= ate; i++) {
    dias.push(atual);
    atual = somaDias(atual, 1);
  }
  return dias;
}

/** Números da Visão de vendas pro período escolhido. */
export function resumoVendas(periodo: Periodo, custom?: Janela): ResumoVendas {
  const janela = janelaDoPeriodo(periodo, custom);
  const noPeriodo = vendasMock.filter((v) => v.dataVenda >= janela.de && v.dataVenda <= janela.ate);

  const faturamento = noPeriodo.reduce((s, v) => s + v.valor, 0);
  const custoTotal = noPeriodo.reduce((s, v) => s + v.custo, 0);
  const lucro = faturamento - custoTotal;
  const vendas = noPeriodo.length;

  // Séries acumuladas dia a dia (curva monotônica — lê como "o mês construindo").
  const dias = diasDaJanela(janela);
  const serie = { lucro: [] as number[], faturamento: [] as number[], vendas: [] as number[] };
  let accL = 0;
  let accF = 0;
  let accV = 0;
  for (const dia of dias) {
    for (const v of noPeriodo) {
      if (v.dataVenda === dia) {
        accF += v.valor;
        accL += v.valor - v.custo;
        accV += 1;
      }
    }
    serie.faturamento.push(accF);
    serie.lucro.push(accL);
    serie.vendas.push(accV);
  }

  return {
    faturamento,
    lucro,
    vendas,
    ticketMedio: vendas ? Math.round(faturamento / vendas) : 0,
    margem: faturamento ? lucro / faturamento : 0,
    serie,
  };
}

export interface ResumoMeta {
  alvo: number;
  feito: number;
  progresso: number; // fração 0..1 (pode passar de 1)
  restam: number;
  /** Dias corridos que ainda faltam no mês. */
  diasRestantes: number;
  /** Projeção de fechamento no ritmo atual (arredondada). */
  projecao: number;
  mesLabel: string;
}

/** Progresso da meta do mês corrente (ancorado em HOJE_ISO). */
export function resumoMeta(ref: string = HOJE_ISO): ResumoMeta {
  const feito = resumoVendas("mes").vendas;
  const alvo = META_VENDAS_MES;

  const hoje = isoParaData(ref);
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const diaAtual = hoje.getDate();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const diasRestantes = diasNoMes - diaAtual;

  const ritmoDiario = feito / diaAtual;
  const projecao = Math.round(ritmoDiario * diasNoMes);

  return {
    alvo,
    feito,
    progresso: alvo ? feito / alvo : 0,
    restam: Math.max(0, alvo - feito),
    diasRestantes,
    projecao,
    mesLabel: MESES[mes],
  };
}
