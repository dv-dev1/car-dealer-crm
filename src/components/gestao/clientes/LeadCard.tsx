"use client";

import type { ReactNode } from "react";
import { Car, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { WhatsappIcon } from "@/components/WhatsappIcon";
import { formatPreco } from "@/lib/format";
import { ddmm, HOJE_ISO } from "@/lib/hoje";
import { whatsappLinkPara } from "@/lib/loja";
import { ETAPAS, type Etapa, type Lead } from "@/data/clientes-mock";

const ATIVAS: Etapa[] = ETAPAS.filter((e) => !e.fechada);

function primeiroNome(nome: string) {
  return nome.split(" ")[0];
}

function estaAtrasado(retornarEm?: string) {
  return !!retornarEm && retornarEm < HOJE_ISO;
}

/**
 * Card de um lead no funil. Só presentação + ações. O arraste é nativo do
 * navegador e vive no wrapper do board; aqui os controles apenas se declaram
 * `draggable={false}` pra não disputar o gesto — o `<a>` do WhatsApp é
 * arrastável por padrão no HTML, então nele isso é obrigatório.
 */
export function LeadCard({
  lead,
  onEditar,
  onMoverEtapa,
  slotMover,
  elevado = false,
}: {
  lead: Lead;
  onEditar?: (lead: Lead) => void;
  /** Setas ◀ ▶ do board: empurram o lead uma etapa pra trás/frente. */
  onMoverEtapa?: (lead: Lead, direcao: -1 | 1) => void;
  /** Controle de mover injetado pelo modo mobile (bottom sheet). */
  slotMover?: ReactNode;
  elevado?: boolean;
}) {
  const vendeu = lead.estagio === "vendeu";
  const naoComprou = lead.estagio === "nao-comprou";
  const atrasado = lead.estagio === "ligar-volta" && estaAtrasado(lead.retornarEm);

  const indice = ATIVAS.findIndex((e) => e.id === lead.estagio);
  const anterior = indice > 0 ? ATIVAS[indice - 1] : null;
  const seguinte = indice >= 0 && indice < ATIVAS.length - 1 ? ATIVAS[indice + 1] : null;

  const datas = [
    lead.conversaEm && { rotulo: "Conversa", valor: ddmm(lead.conversaEm), tom: "muted" },
    lead.visitaEm && {
      rotulo: "Visita",
      valor: ddmm(lead.visitaEm) + (lead.horaVisita ? ` · ${lead.horaVisita}` : ""),
      tom: "primary",
    },
    lead.veioEm && { rotulo: "Veio", valor: ddmm(lead.veioEm), tom: "success" },
  ].filter(Boolean) as { rotulo: string; valor: string; tom: string }[];

  const mensagem = `Olá ${primeiroNome(lead.nome)}, aqui é da Cassiano Veículos 👋`;

  return (
    // flex-col + h-full: cards da mesma coluna terminam alinhados, mesmo quando
    // um tem observação e o outro não.
    <div
      className={`flex h-full flex-col rounded-[calc(var(--radius)-2px)] border bg-surface p-3 transition-shadow duration-200 ${
        elevado
          ? "rotate-[1.5deg] border-primary/40 shadow-[var(--shadow-hover)]"
          : "border-line shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[var(--shadow-soft)]"
      }`}
    >
      {/* Nome + telefone */}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-secondary">{lead.nome}</p>
        <p className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-muted-strong">
          {lead.telefoneLabel}
        </p>
      </div>

      {/* Linha de fechamento (vendeu / não comprou) */}
      {vendeu && lead.valorVenda != null && (
        <p className="mt-2 text-sm font-semibold text-success-ink">
          Vendido por {formatPreco(lead.valorVenda)}
          {lead.formaPagamento && (
            <span className="font-normal text-success-ink/80"> · {lead.formaPagamento}</span>
          )}
        </p>
      )}
      {naoComprou && lead.motivoPerda && (
        <p className="mt-2 text-sm font-medium text-secondary/70">{lead.motivoPerda}</p>
      )}

      {/* Carro de interesse */}
      {lead.carro && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-secondary/85">
          <Car size={13} strokeWidth={1.8} className="shrink-0 text-muted" />
          <span className="truncate">{lead.carro}</span>
        </p>
      )}

      {/* Origem */}
      {lead.origem && (
        <p className="mt-1.5 text-xs leading-snug text-muted-strong">{lead.origem}</p>
      )}

      {/* Nota — 2 linhas no máximo, pra um card não ficar o dobro do vizinho.
          O clamp fica no <span> interno, não na caixa: `overflow-hidden` corta
          no padding-box, então com o padding na mesma caixa a 3ª linha vazava
          por baixo do corte. */}
      {lead.nota && (
        <div
          title={lead.nota}
          className="mt-2 rounded-[calc(var(--radius)-6px)] bg-sand/60 px-2.5 py-1.5"
        >
          <span className="line-clamp-2 text-xs leading-snug text-secondary/80">{lead.nota}</span>
        </div>
      )}

      {/* Datas (com o selo de atraso junto — é sobre prazo, pertence aqui) */}
      {(datas.length > 0 || atrasado) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {atrasado && (
            <span className="rounded-[var(--radius-control)] bg-danger-bg px-2 py-0.5 text-[0.65rem] font-semibold text-danger-ink">
              atrasado
            </span>
          )}
          {datas.map((d) => (
            <span
              key={d.rotulo}
              className={
                d.tom === "primary"
                  ? "text-primary"
                  : d.tom === "success"
                    ? "text-success-ink"
                    : "text-muted-strong"
              }
            >
              {d.rotulo} {d.valor}
            </span>
          ))}
        </div>
      )}

      {/* Ações — mt-auto encosta no rodapé; alvo de 44px no celular */}
      <div className="mt-auto flex items-center gap-2 pt-3 lg:gap-1.5">
        <a
          href={whatsappLinkPara(lead.telefone, mensagem)}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          aria-label={`Chamar ${primeiroNome(lead.nome)} no WhatsApp`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-whatsapp text-white transition-colors duration-200 hover:bg-whatsapp-hover lg:h-8 lg:w-8"
        >
          <WhatsappIcon className="h-4 w-4" />
        </a>

        {onEditar && (
          <button
            type="button"
            draggable={false}
            onClick={() => onEditar(lead)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-line px-3 text-xs font-medium text-secondary transition-colors duration-200 hover:bg-sand lg:min-h-0 lg:px-2.5 lg:py-1.5"
          >
            <Pencil size={13} />
            Editar
          </button>
        )}

        {/* Setas: o caminho por clique. Faz a mesma coisa que arrastar — quem
            preferir o mouse, o teclado, ou estiver com pressa, usa daqui. */}
        {onMoverEtapa && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <SetaEtapa
              direcao={-1}
              destino={anterior}
              nome={lead.nome}
              onMover={() => onMoverEtapa(lead, -1)}
            />
            <SetaEtapa
              direcao={1}
              destino={seguinte}
              nome={lead.nome}
              onMover={() => onMoverEtapa(lead, 1)}
            />
          </div>
        )}

        {slotMover && <div className="ml-auto">{slotMover}</div>}
      </div>
    </div>
  );
}

function SetaEtapa({
  direcao,
  destino,
  nome,
  onMover,
}: {
  direcao: -1 | 1;
  destino: Etapa | null;
  nome: string;
  onMover: () => void;
}) {
  const Icone = direcao === -1 ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      draggable={false}
      onClick={onMover}
      disabled={!destino}
      title={destino ? `Mover para ${destino.label}` : undefined}
      aria-label={
        destino
          ? `Mover ${nome} para ${destino.label}`
          : `${nome} já está na ${direcao === -1 ? "primeira" : "última"} etapa`
      }
      className="grid h-8 w-8 place-items-center rounded-[var(--radius-control)] border border-line text-secondary/70 transition-colors duration-200 hover:bg-sand hover:text-secondary disabled:cursor-not-allowed disabled:border-line/50 disabled:text-muted/40 disabled:hover:bg-transparent"
    >
      <Icone size={16} strokeWidth={2} />
    </button>
  );
}
