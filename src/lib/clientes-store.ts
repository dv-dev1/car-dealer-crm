"use client";

// ─── STORE DO FUNIL DE CLIENTES (Fase 2 — interno) ───────────────
// Fonte ÚNICA dos leads enquanto não há Supabase. Vive no módulo (compartilhada
// entre as telas — Clientes, Agenda e a tela do carro no estoque) e persiste no
// localStorage, pra o registro não sumir ao trocar de página nem no refresh.
//
// É isso que faz "Registrar cliente" na tela do carro cair no kanban: as duas
// telas leem o MESMO store, não estados locais separados. Quando o Supabase
// entrar, só o corpo deste arquivo troca (as telas não mudam) — as funções
// viram queries na tabela `leads`.

import { useSyncExternalStore } from "react";
import {
  leadsMock,
  type EstagioFunil,
  type Lead,
} from "@/data/clientes-mock";
import { HOJE_ISO } from "@/lib/hoje";

// v2: reseeda do mock atualizado (3ª venda de julho, pra a meta bater no Painel
// e nos Relatórios) e limpa estados de teste antigos. Bumpar quando o mock-seed
// mudar de forma que o localStorage salvo ficaria desalinhado.
const STORAGE_KEY = "cassiano.leads.v2";

// ─── Estágios do formulário (o que o modal oferece) ──────────────
// Rótulos amigáveis do modal, mapeados pras colunas reais do funil no `criarLead`.
export const ESTAGIOS_FORM = [
  "Lead novo",
  "Em contato",
  "Negociação",
  "Fechamento",
] as const;
export type EstagioForm = (typeof ESTAGIOS_FORM)[number];

export interface NovoClienteDados {
  nome: string;
  telefone: string;
  estagio: EstagioForm;
  veiculoId: string;
  observacoes: string;
  // Datas opcionais (ISO YYYY-MM-DD) + horário da visita (HH:MM).
  conversaEm?: string;
  visitaEm?: string;
  horaVisita?: string;
  veioEm?: string;
}

// ─── Estado do módulo ────────────────────────────────────────────
let leads: Lead[] = leadsMock;
let hidratado = false;
const ouvintes = new Set<() => void>();

function emitir() {
  for (const cb of ouvintes) cb();
}

function persistir() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch {
    /* localStorage indisponível (modo privado) — segue só em memória */
  }
}

function hidratar() {
  if (hidratado) return;
  hidratado = true;
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (bruto) {
      const salvos = JSON.parse(bruto);
      if (Array.isArray(salvos)) leads = salvos as Lead[];
    } else {
      // Primeira visita: grava o mock como ponto de partida.
      persistir();
    }
  } catch {
    /* dado corrompido — mantém o mock */
  }
  // Sincroniza entre abas: registrar na tela do carro reflete no kanban aberto
  // em outra aba (e vice-versa). Registrado uma vez só.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const salvos = JSON.parse(e.newValue);
      if (Array.isArray(salvos)) {
        leads = salvos as Lead[];
        emitir();
      }
    } catch {
      /* ignora payload inválido */
    }
  });
}

function subscribe(cb: () => void) {
  ouvintes.add(cb);
  if (!hidratado) {
    hidratar();
    emitir(); // re-renderiza com os dados persistidos após a 1ª montagem
  }
  return () => {
    ouvintes.delete(cb);
  };
}

// Snapshot estável: `leads` só troca de referência quando algo muda de fato,
// então o React não reclama e não re-renderiza à toa.
function getSnapshot() {
  return leads;
}

// No servidor (e no 1º render do cliente, antes de hidratar) devolve o mock —
// bate com o SSR e evita mismatch de hidratação.
function getServerSnapshot() {
  return leadsMock;
}

/** Hook de leitura reativa. Toda tela do funil consome por aqui. */
export function useLeads(): Lead[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function commit(proximos: Lead[]) {
  leads = proximos;
  persistir();
  emitir();
}

function novoId(): string {
  try {
    return `lead-${crypto.randomUUID().slice(0, 8)}`;
  } catch {
    return `lead-${leads.length + 1}-${Date.now().toString(36)}`;
  }
}

// ─── Mutações ────────────────────────────────────────────────────
/** Insere um lead no topo do funil (registro novo aparece primeiro). */
export function adicionarLead(lead: Lead) {
  commit([lead, ...leads]);
}

/** Move um lead de etapa; ao fechar (vendeu/não comprou), carimba `fechadoEm`. */
export function moverLead(id: string, destino: EstagioFunil) {
  const fechada = destino === "vendeu" || destino === "nao-comprou";
  commit(
    leads.map((l) =>
      l.id === id
        ? { ...l, estagio: destino, fechadoEm: fechada ? l.fechadoEm ?? HOJE_ISO : l.fechadoEm }
        : l,
    ),
  );
}

/**
 * Grava a edição de um lead (o botão "Editar" do card). Recebe só os campos que
 * mudaram e preserva o resto — inclusive `id`, que nunca vem do formulário.
 * Mesmo caminho de `moverLead`/`fecharLead`: uma fonte, um commit.
 */
export function atualizarLead(id: string, dados: Partial<Lead>) {
  commit(leads.map((l) => (l.id === id ? { ...l, ...dados, id: l.id } : l)));
}

// ─── Fechamento do negócio (arrastar pra "Vendeu" / "Não comprou") ─
export interface DadosFechamento {
  /** Valor da venda (só "vendeu"). */
  valor?: number;
  /** Forma de pagamento (só "vendeu"). */
  formaPagamento?: string;
  /** Motivo da perda (só "não comprou"). */
  motivo?: string;
}

/**
 * Fecha um lead: move pra "vendeu" ou "não comprou" e carimba os dados do
 * fechamento (valor/forma na venda; motivo na perda). É o que o diálogo de
 * fechamento do funil chama ao soltar o card numa zona de fechamento — a venda
 * entra no mesmo funil e conta na Meta na hora, sem número paralelo.
 */
export function fecharLead(
  id: string,
  destino: "vendeu" | "nao-comprou",
  dados: DadosFechamento = {},
) {
  commit(
    leads.map((l) => {
      if (l.id !== id) return l;
      if (destino === "vendeu") {
        return {
          ...l,
          estagio: "vendeu",
          fechadoEm: l.fechadoEm ?? HOJE_ISO,
          valorVenda: dados.valor ?? l.valorVenda,
          formaPagamento: dados.formaPagamento ?? l.formaPagamento,
        };
      }
      return {
        ...l,
        estagio: "nao-comprou",
        fechadoEm: l.fechadoEm ?? HOJE_ISO,
        motivoPerda: dados.motivo ?? l.motivoPerda,
      };
    }),
  );
}

// ─── Construção de lead a partir do formulário ───────────────────
function mapaEstagio(rotulo: EstagioForm): EstagioFunil {
  // "Negociação"/"Fechamento" já é um lead quente → coluna "Negociando".
  // "Lead novo"/"Em contato" entram como lead ativo (a visita, se houver,
  // promove pra "Visita marcada" no criarLead).
  return rotulo === "Negociação" || rotulo === "Fechamento" ? "negociando" : "lead-novo";
}

/**
 * Traduz o que o modal coletou num `Lead` do funil. Usado igual pelas duas
 * portas de entrada (Clientes e tela do carro) — uma regra só, sem divergência.
 * `carroTitulo` é resolvido pela tela a partir do `veiculoId` selecionado.
 */
export function criarLead(dados: NovoClienteDados, carroTitulo?: string): Lead {
  const digitos = dados.telefone.replace(/\D/g, "");
  const telefone = digitos ? (digitos.startsWith("55") ? digitos : `55${digitos}`) : "";

  let estagio = mapaEstagio(dados.estagio);
  // Marcou visita mas o estágio ainda é frio → é uma "Visita marcada" de fato.
  if (estagio === "lead-novo" && dados.visitaEm) estagio = "visita-marcada";

  return {
    id: novoId(),
    nome: dados.nome.trim(),
    telefone,
    telefoneLabel: dados.telefone.trim() || "—",
    carro: carroTitulo,
    origem: "Cadastrado no painel",
    nota: dados.observacoes.trim() || undefined,
    estagio,
    conversaEm: dados.conversaEm || undefined,
    visitaEm: dados.visitaEm || undefined,
    horaVisita: dados.horaVisita || undefined,
    veioEm: dados.veioEm || undefined,
  };
}

// ─── Registro de venda (a partir do painel de Metas) ─────────────
export interface NovaVenda {
  nome: string;
  valor?: number;
  formaPagamento?: string;
  carroTitulo?: string;
}

/**
 * Cria um lead já fechado em "vendeu", com data de fechamento no dia informado
 * (default hoje). É o que faz "Registrar venda" nas Metas contar na hora: a
 * venda entra no MESMO funil, aparece na coluna "Vendeu" da tela Clientes e
 * soma no progresso da meta — sem um contador paralelo.
 */
export function criarVenda(venda: NovaVenda, fechadoEm: string = HOJE_ISO): Lead {
  return {
    id: novoId(),
    nome: venda.nome.trim(),
    telefone: "",
    telefoneLabel: "—",
    carro: venda.carroTitulo,
    origem: "Venda registrada nas Metas",
    estagio: "vendeu",
    valorVenda: venda.valor,
    formaPagamento: venda.formaPagamento,
    fechadoEm,
  };
}
