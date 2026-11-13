"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoveRight, BadgeCheck, XCircle, ArrowRight } from "lucide-react";
import {
  ETAPAS,
  ETAPA_POR_ID,
  type Etapa,
  type EstagioFunil,
  type Lead,
} from "@/data/clientes-mock";
import { LeadCard } from "./LeadCard";
import { VEU, EASE_MARCA as EASE } from "@/components/gestao/motion/sobreposicao";

const ATIVAS: Etapa[] = ETAPAS.filter((e) => !e.fechada);

/**
 * Funil no toque (celular/tablet estreito). Nada de board horizontal oco: um
 * seletor de etapa em cima, a lista da etapa embaixo, e "Mover" abre um bottom
 * sheet com os destinos. Toque e teclado de primeira — o arraste fica no
 * desktop, onde faz sentido.
 */
export function FunilMobile({
  leads,
  onMover,
  onFechar,
  onEditar,
}: {
  leads: Lead[];
  onMover: (id: string, destino: EstagioFunil) => void;
  onFechar: (lead: Lead, tipo: "vendeu" | "nao-comprou") => void;
  onEditar: (lead: Lead) => void;
}) {
  const reduzir = useReducedMotion();
  const [etapaSel, setEtapaSel] = useState<EstagioFunil>("lead-novo");
  const [mover, setMover] = useState<Lead | null>(null);

  const daEtapa = leads.filter((l) => l.estagio === etapaSel);
  const etapaAtual = ETAPA_POR_ID[etapaSel];

  function escolher(destino: EstagioFunil | "vendeu" | "nao-comprou") {
    if (!mover) return;
    const lead = mover;
    setMover(null);
    if (destino === "vendeu" || destino === "nao-comprou") {
      onFechar(lead, destino);
    } else {
      onMover(lead.id, destino);
      setEtapaSel(destino);
    }
  }

  return (
    <div>
      {/* Seletor de etapa — quebra em duas linhas em vez de rolar na horizontal:
          são 4 etapas fixas, e etapa escondida atrás de um scroll sem pista
          nenhuma é etapa que o vendedor não acha. */}
      <div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Etapas do funil">
          {ATIVAS.map((etapa) => {
            const ativa = etapa.id === etapaSel;
            const n = leads.filter((l) => l.estagio === etapa.id).length;
            return (
              <button
                key={etapa.id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setEtapaSel(etapa.id)}
                className={`flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-medium transition-colors duration-200 ${
                  ativa ? "text-on-primary" : "border border-line bg-surface text-secondary/80"
                }`}
                style={ativa ? { backgroundColor: etapa.cor } : undefined}
              >
                {etapa.label}
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                    ativa ? "bg-[color-mix(in_srgb,var(--on-primary)_20%,transparent)]" : "bg-sand text-muted-strong"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista da etapa */}
      <div className="mt-4 space-y-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {daEtapa.map((lead) => (
            <motion.div
              key={lead.id}
              layout={!reduzir}
              initial={reduzir ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduzir ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <LeadCard
                lead={lead}
                onEditar={onEditar}
                slotMover={
                  <button
                    type="button"
                    onClick={() => setMover(lead)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-[calc(var(--radius)-5px)] border border-line px-3 text-xs font-medium text-secondary transition-colors duration-200 hover:bg-sand"
                  >
                    <MoveRight size={13} />
                    Mover
                  </button>
                }
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {daEtapa.length === 0 && (
          <div className="grid place-items-center rounded-[var(--radius)] border border-dashed border-line px-4 py-12 text-center">
            <p className="text-sm text-muted">Nenhum cliente em “{etapaAtual.label}”.</p>
          </div>
        )}
      </div>

      {/* Bottom sheet — mover pra… */}
      <AnimatePresence>
        {mover && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center">
            {/* O painel daqui vem de fora da tela (y: 100%), então não pipoca
                — só o véu precisava da curva certa. Ver motion/sobreposicao.ts. */}
            <motion.div
              className="absolute inset-0 bg-veu"
              {...VEU}
              onClick={() => setMover(null)}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Mover ${mover.nome}`}
              className="relative z-[71] w-full max-w-md rounded-t-[calc(var(--radius)*1.4)] border border-line bg-surface p-4 shadow-[var(--shadow-hover)]"
              initial={reduzir ? { opacity: 0 } : { y: "100%" }}
              animate={reduzir ? { opacity: 1 } : { y: 0 }}
              exit={reduzir ? { opacity: 0 } : { y: "100%" }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-[var(--radius-control)] bg-line" aria-hidden="true" />
              <p className="px-1 text-sm text-muted-strong">
                Mover <span className="font-semibold text-secondary">{mover.nome}</span> para
              </p>

              <div className="mt-3 space-y-1.5">
                {ATIVAS.filter((e) => e.id !== mover.estagio).map((etapa) => (
                  <button
                    key={etapa.id}
                    type="button"
                    onClick={() => escolher(etapa.id)}
                    className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-line px-3.5 py-3 text-left text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: etapa.cor }}
                    />
                    {etapa.label}
                    <ArrowRight size={15} className="ml-auto text-muted" />
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => escolher("vendeu")}
                  className="flex items-center justify-center gap-2 rounded-[var(--radius)] bg-success px-3 py-3 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-success-ink"
                >
                  <BadgeCheck size={16} />
                  Vendeu
                </button>
                <button
                  type="button"
                  onClick={() => escolher("nao-comprou")}
                  className="flex items-center justify-center gap-2 rounded-[var(--radius)] border border-line bg-surface px-3 py-3 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-sand"
                >
                  <XCircle size={16} />
                  Não comprou
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
