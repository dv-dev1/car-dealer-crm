// Funnel stages and the lead as the screens see it.

export type EstagioFunil =
  | "lead-novo"
  | "visita-marcada"
  | "negociando"
  | "ligar-volta"
  | "vendeu"
  | "nao-comprou";

export interface Etapa {
  id: EstagioFunil;
  label: string;
  /** Stage color: a theme token (CSS var), so the funnel follows the store theme. */
  cor: string;
  /** Etapa ativa (aparece sempre) ou fechada (filtrada por mês). */
  fechada?: boolean;
}

// Sober progression from theme tokens: neutral, primary, warning, strong gray;
// success for the win, strong gray for the loss. No color shouts.
export const ETAPAS: Etapa[] = [
  { id: "lead-novo", label: "Lead novo", cor: "var(--neutral)" },
  { id: "visita-marcada", label: "Visita marcada", cor: "var(--primary)" },
  { id: "negociando", label: "Negociando", cor: "var(--warning)" },
  { id: "ligar-volta", label: "Ligar de volta", cor: "var(--muted-strong)" },
  { id: "vendeu", label: "Vendeu", cor: "var(--success)", fechada: true },
  { id: "nao-comprou", label: "Não comprou", cor: "var(--muted-strong)", fechada: true },
];

export const ETAPA_POR_ID: Record<EstagioFunil, Etapa> = Object.fromEntries(
  ETAPAS.map((e) => [e.id, e]),
) as Record<EstagioFunil, Etapa>;

export interface Lead {
  id: string;
  nome: string;
  telefone: string; // só dígitos com DDI (55...) — pro link do WhatsApp
  telefoneLabel: string;
  carro?: string; // modelo de interesse, texto livre (como na referência)
  origem?: string; // "Entrou no site da loja", "Lead Mercado Livre"…
  nota?: string;
  estagio: EstagioFunil;
  // Relacionamento — datas ISO (YYYY-MM-DD). O card formata pra dd/mm; a
  // agenda usa a data cheia. Fonte única pros dois.
  conversaEm?: string;
  visitaEm?: string;
  horaVisita?: string; // HH:MM — horário da visita agendada, se informado
  veioEm?: string;
  // Fechamento (vendeu / não comprou)
  valorVenda?: number;
  formaPagamento?: string;
  fechadoEm?: string; // ISO YYYY-MM-DD — filtro por mês
  motivoPerda?: string;
  // Retorno agendado (ligar de volta) — ISO; se no passado, conta como atrasado
  retornarEm?: string;
  // From the database (absent in the mock): who owns the lead and whether this member may change it.
  sellerId?: string | null;
  sellerName?: string | null;
  vehicleId?: string | null;
  channelId?: string | null;
  canEdit?: boolean;
}

/** How a sale's payment reads on screen. */
export const PAYMENT_LABEL = { cash: "À vista", financing: "Financiamento" } as const;
export type Payment = keyof typeof PAYMENT_LABEL;

export type DbStage = "new" | "visit_scheduled" | "negotiating" | "call_back" | "won" | "lost";
export type ActiveStage = Exclude<DbStage, "won" | "lost">;
export const ACTIVE_STAGES: readonly ActiveStage[] = ["new", "visit_scheduled", "negotiating", "call_back"];
export const STAGE_UI: Record<DbStage, EstagioFunil> = {
  new: "lead-novo",
  visit_scheduled: "visita-marcada",
  negotiating: "negociando",
  call_back: "ligar-volta",
  won: "vendeu",
  lost: "nao-comprou",
};
/** Funnel column → database stage. */
export const UI_STAGE = Object.fromEntries(Object.entries(STAGE_UI).map(([db, ui]) => [ui, db])) as Record<EstagioFunil, DbStage>;
