// ─── SELETOR DA META DO MÊS ──────────────────────────────────────
// Deriva os números do painel de Metas a partir do FUNIL (leads) + a meta
// definida. Fonte única: as vendas são os leads em "vendeu" fechados no mês
// corrente — o mesmo que a tela Clientes conta em "Vendas no mês". Sem isso, o
// painel de Metas e o kanban mostrariam números diferentes.

import type { Lead } from "@/data/clientes-mock";
import { HOJE_ISO, MESES, isoParaData } from "@/lib/hoje";

/**
 * Dias em que a loja ainda pode vender neste mês, contando hoje. A Cassiano
 * abre de segunda a sábado (domingo fechado), então "dia de venda" é qualquer
 * dia que não seja domingo. É o divisor do ritmo ("precisa de X/dia").
 */
export function diasDeVendaRestantes(ref: string = HOJE_ISO): number {
  const d = isoParaData(ref);
  const ano = d.getFullYear();
  const mes = d.getMonth();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  let conta = 0;
  for (let dia = d.getDate(); dia <= ultimoDia; dia++) {
    if (new Date(ano, mes, dia).getDay() !== 0) conta++; // pula domingo
  }
  return conta;
}

/**
 * A frase de ritmo da meta, em português de gente. Vive aqui porque a fita do
 * Painel e o bloco dos Relatórios mostram o MESMO fato — antes cada uma
 * inventava sua redação ("fecha em ~4" x "precisa de ~0,2/dia") e o mesmo mês
 * parecia duas coisas diferentes.
 *
 * O ritmo sai como "1 venda a cada N dias" quando falta menos de uma por dia:
 * "0,2 venda/dia" não é uma instrução que um vendedor consegue seguir.
 */
export function fraseRitmo({
  feito,
  alvo,
  restam,
  diasRestantes,
  projecao,
  unidadeDias = "dias",
}: {
  feito: number;
  alvo: number;
  restam: number;
  diasRestantes: number;
  projecao: number;
  /** "dias" (corridos) ou "dias úteis" — cada tela conta do seu jeito. */
  unidadeDias?: string;
}): string {
  if (feito >= alvo) return "Meta batida no mês.";
  if (diasRestantes <= 0) return `Faltam ${restam} e o mês acabou.`;
  if (projecao >= alvo) return `Faltam ${restam} · no ritmo atual, você fecha a meta.`;

  const diasPorVenda = diasRestantes / restam;
  const passo =
    diasPorVenda >= 1.5
      ? `1 venda a cada ${Math.round(diasPorVenda)} dias`
      : `${(restam / diasRestantes).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por dia`;

  return `Faltam ${restam} em ${diasRestantes} ${unidadeDias} · ${passo}.`;
}

export interface ResumoMetaMes {
  alvo: number;
  feito: number;
  restam: number;
  progresso: number; // fração 0..1+ (pode passar de 1)
  pct: number; // progresso arredondado, travado em 100 pra barra
  batido: boolean;
  emNegociacao: number;
  aguardandoRetorno: number;
  /** Dias de venda (não-domingo) restantes no mês, contando hoje. */
  diasRestantes: number;
  /** Vendas/dia necessárias pra bater (restam / diasRestantes). */
  ritmoNecessario: number;
  /** Projeção de fechamento no ritmo atual do mês (arredondada). */
  projecao: number;
  mesLabel: string;
  ano: number;
}

function fechadoNoMes(iso: string | undefined, mesRef: string) {
  return !!iso && iso.startsWith(mesRef);
}

/** Números do painel de Metas pro mês corrente (ancorado em HOJE_ISO). */
export function resumoMetaMes(
  leads: Lead[],
  alvo: number,
  ref: string = HOJE_ISO,
): ResumoMetaMes {
  const d = isoParaData(ref);
  const ano = d.getFullYear();
  const mes = d.getMonth();
  const diaAtual = d.getDate();
  const mesRef = `${ano}-${String(mes + 1).padStart(2, "0")}`;

  const feito = leads.filter(
    (l) => l.estagio === "vendeu" && fechadoNoMes(l.fechadoEm, mesRef),
  ).length;
  const emNegociacao = leads.filter((l) => l.estagio === "negociando").length;
  const aguardandoRetorno = leads.filter((l) => l.estagio === "ligar-volta").length;

  const restam = Math.max(0, alvo - feito);
  const diasRestantes = diasDeVendaRestantes(ref);
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const projecao = Math.round((feito / diaAtual) * diasNoMes);
  const progresso = alvo ? feito / alvo : 0;

  return {
    alvo,
    feito,
    restam,
    progresso,
    pct: Math.min(100, Math.round(progresso * 100)),
    batido: feito >= alvo,
    emNegociacao,
    aguardandoRetorno,
    diasRestantes,
    ritmoNecessario: diasRestantes > 0 ? restam / diasRestantes : restam,
    projecao,
    mesLabel: MESES[mes],
    ano,
  };
}
