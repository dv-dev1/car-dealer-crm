// ─── FUNIL DE CLIENTES (Fase 2 — interno) ────────────────────
// Leads do funil de vendas do gestor. MOCK plausível pra o Kanban ficar vivo —
// quando o Supabase entrar, `src/lib/clientes.ts` troca esta fonte por queries
// (tabela `leads`). Sem persistência ainda: mover card / novo cliente vale só
// na sessão. As telas não mudam quando o banco chegar.

import type { Lead } from "@/features/leads/types";

export { ETAPAS, ETAPA_POR_ID, type EstagioFunil, type Etapa, type Lead } from "@/features/leads/types";

// Hoje: 2026-07-21. Fechamentos em julho aparecem no mês corrente por padrão.
export const leadsMock: Lead[] = [
  {
    id: "l1",
    nome: "Kauan Ribeiro",
    telefone: "5511948660000",
    telefoneLabel: "(11) 94866-0000",
    carro: "Volkswagen Jetta 2.0 Comfortline Flex 4p",
    origem: "Entrou no site da loja",
    estagio: "lead-novo",
    conversaEm: "2026-06-25",
    visitaEm: "2026-06-27",
  },
  {
    id: "l2",
    nome: "Marina Alves",
    telefone: "5583991110000",
    telefoneLabel: "(83) 99111-0000",
    carro: "GAC GS3 Premium 1.5 Turbo",
    origem: "Chegou pelo Instagram",
    estagio: "visita-marcada",
    conversaEm: "2026-07-18",
    visitaEm: "2026-07-22",
  },
  {
    id: "l3",
    nome: "Vagner Mazzeo",
    telefone: "5511911110000",
    telefoneLabel: "(11) 91111-0000",
    carro: "Toyota Corolla XEI",
    nota: "Cliente chegou pelo WhatsApp querendo esse carro.",
    origem: "WhatsApp",
    estagio: "negociando",
    conversaEm: "2026-07-16",
  },
  {
    id: "l4",
    nome: "Roberto Lima",
    telefone: "5583988880000",
    telefoneLabel: "(83) 98888-0000",
    carro: "Toyota SW4 Diamond",
    origem: "Pediu pra retornar segunda",
    estagio: "ligar-volta",
    conversaEm: "2026-07-14",
    retornarEm: "2026-07-18",
  },
  {
    id: "l5",
    nome: "Jessica Nascimento Fagundes",
    telefone: "5511989099169",
    telefoneLabel: "(11) 98909-9169",
    carro: "GAC GS3 Premium",
    origem: "Lead Mercado Livre",
    estagio: "vendeu",
    valorVenda: 47890,
    formaPagamento: "Financiamento bancário",
    visitaEm: "2026-06-20",
    veioEm: "2026-06-20",
    fechadoEm: "2026-07-05",
  },
  {
    id: "l6",
    nome: "Thiago da Silva",
    telefone: "5513997000000",
    telefoneLabel: "(13) 99700-0000",
    carro: "RAM Rampage Laramie",
    origem: "Seguidor Instagram · Praia Grande SP",
    estagio: "vendeu",
    valorVenda: 145000,
    formaPagamento: "Troca + diferença",
    conversaEm: "2026-06-13",
    visitaEm: "2026-06-20",
    veioEm: "2026-06-20",
    fechadoEm: "2026-07-12",
  },
  {
    id: "l7",
    nome: "Carlos Menezes",
    telefone: "5583970000000",
    telefoneLabel: "(83) 97000-0000",
    carro: "Mercedes-Benz GLA 200",
    origem: "Achou o valor acima do orçamento",
    estagio: "nao-comprou",
    motivoPerda: "Foi de outro modelo",
    conversaEm: "2026-07-02",
    fechadoEm: "2026-07-08",
  },
  {
    // 3ª venda de julho — casa a contagem do funil com o histórico de vendas
    // (vendas-mock), pra a meta bater igual no Painel e nos Relatórios.
    id: "l8",
    nome: "Letícia Ferraz",
    telefone: "5511970000000",
    telefoneLabel: "(11) 97000-0000",
    carro: "Jeep Compass Longitude",
    origem: "Indicação de cliente",
    estagio: "vendeu",
    valorVenda: 152000,
    formaPagamento: "Financiamento",
    visitaEm: "2026-07-18",
    veioEm: "2026-07-19",
    fechadoEm: "2026-07-20",
  },
];
