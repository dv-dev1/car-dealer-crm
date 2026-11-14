"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { EVENTO_NOVO_CLIENTE } from "@/components/gestao/secoes";
import { Plus, X } from "lucide-react";
import { NovoClienteModal } from "@/components/gestao/NovoClienteModal";
import { moveLeadAction } from "@/features/leads/actions";
import { UI_STAGE, type EstagioFunil, type Lead } from "@/features/leads/types";
import { formData } from "@/shared/form";
import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { BoardFunil } from "@/components/gestao/clientes/BoardFunil";
import { FunilMobile } from "@/components/gestao/clientes/FunilMobile";
import {
  FecharNegocioDialog,
  type Fechamento,
} from "@/components/gestao/clientes/FecharNegocioDialog";

const ATIVAS: EstagioFunil[] = ["lead-novo", "visita-marcada", "negociando", "ligar-volta"];

type Opcao = { id: string; name: string };

export function ClientesView({
  leads,
  veiculos,
  channels,
  sellers,
  today,
}: {
  /** Open leads and the ones closed this month, from the store's database. */
  leads: Lead[];
  /** Cars for sale. */
  veiculos: { id: string; titulo: string; preco: number }[];
  channels: Opcao[];
  /** Null for a seller. */
  sellers: Opcao[] | null;
  /** The store's day, "YYYY-MM-DD". */
  today: string;
}) {
  // A moved card changes column at once; if the database refuses, it goes back when the transition ends.
  const [visiveis, moverNaTela] = useOptimistic(leads, (atual, mudanca: { id: string; estagio: EstagioFunil }) =>
    atual.map((l) => (l.id === mudanca.id ? { ...l, estagio: mudanca.estagio } : l)),
  );
  const [, iniciar] = useTransition();
  const [modalAberto, setModalAberto] = useState(false);
  const [leadEditando, setLeadEditando] = useState<Lead | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const mesAtual = today.slice(0, 7);

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
      vendasMes: visiveis.filter((l) => l.estagio === "vendeu" && l.fechadoEm?.startsWith(mesAtual)).length,
      perdasMes: visiveis.filter((l) => l.estagio === "nao-comprou" && l.fechadoEm?.startsWith(mesAtual)).length,
    }),
    [visiveis, mesAtual],
  );

  // Só as etapas ativas aparecem no board; fechados vivem nos Relatórios.
  const ativos = useMemo(() => visiveis.filter((l) => ATIVAS.includes(l.estagio)), [visiveis]);

  function toast(msg: string) {
    setAviso(msg);
    window.clearTimeout((toast as unknown as { t?: number }).t);
    (toast as unknown as { t?: number }).t = window.setTimeout(() => setAviso(null), 3200);
  }

  function mover(id: string, destino: EstagioFunil) {
    iniciar(async () => {
      moverNaTela({ id, estagio: destino });
      try {
        const resposta = await moveLeadAction({ error: null }, formData({ id, stage: UI_STAGE[destino] }));
        if (resposta.error) toast(resposta.error);
      } catch {
        toast("Não foi possível mover. Confira a internet e tente de novo.");
      }
    });
  }

  function abrirFechamento(lead: Lead, tipo: "vendeu" | "nao-comprou") {
    setFechamento({ lead, tipo });
  }

  function concluido(msg: string) {
    toast(msg);
    setFechamento(null);
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
          today={today}
          vendasMes={fechados.vendasMes}
          perdasMes={fechados.perdasMes}
          onMover={mover}
          onFechar={abrirFechamento}
          onEditar={setLeadEditando}
        />
      </div>
      <div className="lg:hidden">
        <FunilMobile leads={ativos} today={today} onMover={mover} onFechar={abrirFechamento} onEditar={setLeadEditando} />
      </div>

      <NovoClienteModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        veiculos={veiculos}
        channels={channels}
        sellers={sellers}
      />

      {/* Mesmo formulário, carregado com o lead — não há tela de edição separada */}
      <NovoClienteModal
        aberto={!!leadEditando}
        onFechar={() => setLeadEditando(null)}
        veiculos={veiculos}
        channels={channels}
        sellers={sellers}
        leadEmEdicao={leadEditando}
        onSalvo={toast}
      />

      <FecharNegocioDialog
        fechamento={fechamento}
        veiculos={veiculos}
        sellers={sellers}
        onConfirmar={concluido}
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
