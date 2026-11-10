import { somaDias } from "@/lib/hoje";
import type { Lead } from "./clientes-mock";

// ─── AGENDA (Fase 2 — interno) ───────────────────────────────
// A agenda não tem dados próprios: ela DERIVA dos leads do funil. Toda visita
// agendada (lead.visitaEm) e todo retorno marcado (lead.retornarEm) viram
// eventos no calendário. Fonte única com o funil — mexeu no lead, mudou a
// agenda. Quando o Supabase entrar, os campos vêm da mesma tabela `leads`.

export type TipoEvento = "visita" | "retorno";

export interface EventoAgenda {
  id: string;
  data: string; // ISO YYYY-MM-DD
  tipo: TipoEvento;
  lead: Lead;
}

// Cores dos tipos — sistema Cassiano (contido), NÃO o azul/laranja da
// referência: ardósia pra visita (informativo, = "Lead novo" do funil),
// âmbar pra retorno (pede ação). `cor` é o ponto/legenda; `tinta` é o texto
// da pílula (mais escuro, pra passar contraste no tamanho pequeno).
export const TIPO_EVENTO: Record<
  TipoEvento,
  { label: string; cor: string; tinta: string }
> = {
  visita: { label: "Visita agendada", cor: "#5E7186", tinta: "#3E4A57" },
  retorno: { label: "Retornar", cor: "#B7791F", tinta: "#8A5A15" },
};

/** Deriva os eventos do calendário a partir dos leads. */
export function eventosDeLeads(leads: Lead[]): EventoAgenda[] {
  const evs: EventoAgenda[] = [];
  for (const l of leads) {
    if (l.visitaEm) evs.push({ id: `v-${l.id}`, data: l.visitaEm, tipo: "visita", lead: l });
    if (l.retornarEm) evs.push({ id: `r-${l.id}`, data: l.retornarEm, tipo: "retorno", lead: l });
  }
  return evs.sort((a, b) => a.data.localeCompare(b.data));
}

/** Números do topo da agenda (os 4 stat cards). */
export function resumoAgenda(eventos: EventoAgenda[], hojeIso: string) {
  const em7 = somaDias(hojeIso, 7);
  return {
    visitasHoje: eventos.filter((e) => e.tipo === "visita" && e.data === hojeIso).length,
    retornosHoje: eventos.filter((e) => e.tipo === "retorno" && e.data === hojeIso).length,
    proximos7: eventos.filter((e) => e.data >= hojeIso && e.data <= em7).length,
    retornosAtrasados: eventos.filter((e) => e.tipo === "retorno" && e.data < hojeIso).length,
  };
}
