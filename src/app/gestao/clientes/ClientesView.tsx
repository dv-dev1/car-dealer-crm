"use client";

import { useEffect, useMemo, useState } from "react";
import { EVENTO_NOVO_CLIENTE } from "@/components/gestao/secoes";
import { Plus, X } from "lucide-react";
import { NovoClienteModal } from "@/components/gestao/NovoClienteModal";
import type { EstagioFunil, Lead } from "@/data/clientes-mock";
import {
  useLeads,
  adicionarLead,
  moverLead,
  fecharLead,
  atualizarLead,
  criarLead,
  type NovoClienteDados,
  type DadosFechamento,
} from "@/lib/clientes-store";
import { HOJE_ISO } from "@/lib/hoje";
import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { BoardFunil } from "@/components/gestao/clientes/BoardFunil";
import { FunilMobile } from "@/components/gestao/clientes/FunilMobile";
import {
  FecharNegocioDialog,
  type Fechamento,
} from "@/components/gestao/clientes/FecharNegocioDialog";

const ATIVAS: EstagioFunil[] = ["lead-novo", "visita-marcada", "negociando", "ligar-volta"];
const MES_ATUAL = HOJE_ISO.slice(0, 7); // "2026-07"

function noMesAtual(iso?: string) {
  return !!iso && iso.startsWith(MES_ATUAL);
}

export function ClientesView({
  veiculos,
}: {
  veiculos: { id: string; titulo: string; preco: number }[];
}) {
  const leads = useLeads();
  const [modalAberto, setModalAberto] = useState(false);
  const [leadEditando, setLeadEditando] = useState<Lead | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);

  // Duas portas pro "Novo cliente" da sidebar, porque são dois casos:
  //
  // 1. Vindo de OUTRA tela: o link navega pra cá com ?novo=1 e este efeito de
  //    montagem abre o formulário.
  // 2. Já NESTA tela: a navegação é client-side e o componente não remonta —
  //    o efeito acima nunca rodaria de novo e o botão parecia morto. Aí a
  //    sidebar dispara este evento em vez de navegar.
  //
  // (Ler a query com useSearchParams resolveria os dois de uma vez, mas exige
  // fronteira de Suspense e derrubou a renderização da tela inteira.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("novo") === "1") {
      setModalAberto(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
    const abrir = () => setModalAberto(true);
    window.addEventListener(EVENTO_NOVO_CLIENTE, abrir);
    return () => window.removeEventListener(EVENTO_NOVO_CLIENTE, abrir);
  }, []);

  // Contagens do mês pras zonas de fechamento (o board já mostra as contagens
  // ativas no topo de cada coluna — sem cards de estatística repetindo isso).
  const fechados = useMemo(
    () => ({
      vendasMes: leads.filter((l) => l.estagio === "vendeu" && noMesAtual(l.fechadoEm)).length,
      perdasMes: leads.filter((l) => l.estagio === "nao-comprou" && noMesAtual(l.fechadoEm)).length,
    }),
    [leads],
  );

  // Só as etapas ativas aparecem no board; fechados vivem nos Relatórios.
  const ativos = useMemo(() => leads.filter((l) => ATIVAS.includes(l.estagio)), [leads]);

  function toast(msg: string) {
    setAviso(msg);
    window.clearTimeout((toast as unknown as { t?: number }).t);
    (toast as unknown as { t?: number }).t = window.setTimeout(() => setAviso(null), 3200);
  }

  function mover(id: string, destino: EstagioFunil) {
    moverLead(id, destino);
  }

  function abrirFechamento(lead: Lead, tipo: "vendeu" | "nao-comprou") {
    setFechamento({ lead, tipo });
  }

  function confirmarFechamento(dados: DadosFechamento) {
    if (!fechamento) return;
    fecharLead(fechamento.lead.id, fechamento.tipo, dados);
    const nome = fechamento.lead.nome.split(" ")[0];
    toast(
      fechamento.tipo === "vendeu"
        ? `Venda de ${nome} registrada. Já conta na Meta e nos Relatórios.`
        : `${nome} marcado como não comprou.`,
    );
    setFechamento(null);
  }

  function editar(lead: Lead) {
    setLeadEditando(lead);
  }

  function salvarEdicao(dados: Partial<Lead>) {
    if (!leadEditando) return;
    atualizarLead(leadEditando.id, dados);
    const mudouEtapa = dados.estagio && dados.estagio !== leadEditando.estagio;
    toast(
      mudouEtapa
        ? `${dados.nome?.split(" ")[0] ?? "Cliente"} atualizado e movido de etapa.`
        : `${dados.nome?.split(" ")[0] ?? "Cliente"} atualizado.`,
    );
    setLeadEditando(null);
  }

  function salvarCliente(dados: NovoClienteDados) {
    const carro = veiculos.find((v) => v.id === dados.veiculoId)?.titulo;
    adicionarLead(criarLead(dados, carro));
  }

  return (
    <div>
      <CabecalhoGestao
        eyebrow="Central de gestão"
        titulo="Clientes"
        apoio="Acompanhe cada cliente da chegada ao fechamento. Arraste o card entre as colunas — ou use as setas."
        acoes={
          // Só abaixo de lg: no desktop a sidebar já traz o mesmo "Novo cliente"
          // fixo na tela — dois botões idênticos a 40px um do outro é ruído.
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-primary px-3.5 py-2.5 text-sm font-semibold text-on-primary transition-[background-color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] hover:bg-primary-hover active:scale-[0.97] lg:hidden"
          >
            <Plus size={17} strokeWidth={2.25} />
            Novo cliente
          </button>
        }
      />

      {/* Board (desktop) / lista por etapa (mobile) */}
      <div className="hidden lg:block">
        <BoardFunil
          leads={ativos}
          vendasMes={fechados.vendasMes}
          perdasMes={fechados.perdasMes}
          onMover={mover}
          onFechar={abrirFechamento}
          onEditar={editar}
        />
      </div>
      <div className="lg:hidden">
        <FunilMobile leads={ativos} onMover={mover} onFechar={abrirFechamento} onEditar={editar} />
      </div>

      <NovoClienteModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        veiculos={veiculos}
        onSalvar={salvarCliente}
      />

      {/* Mesmo formulário, carregado com o lead — não há tela de edição separada */}
      <NovoClienteModal
        aberto={!!leadEditando}
        onFechar={() => setLeadEditando(null)}
        veiculos={veiculos}
        leadEmEdicao={leadEditando}
        onAtualizar={salvarEdicao}
      />

      <FecharNegocioDialog
        fechamento={fechamento}
        onConfirmar={confirmarFechamento}
        onCancelar={() => setFechamento(null)}
      />

      {aviso && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-[70] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-[var(--radius)] bg-inverso px-4 py-3 text-sm text-white shadow-[var(--shadow-hover)]"
        >
          <span>{aviso}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Fechar aviso"
            className="text-white/70 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
