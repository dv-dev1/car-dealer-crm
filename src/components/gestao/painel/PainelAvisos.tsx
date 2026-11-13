"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy, TriangleAlert, ArrowRight } from "lucide-react";
import type { ResumoMeta } from "@/data/vendas-mock";
import { fraseRitmo } from "@/lib/metas";
import { NumeroAnimado } from "@/components/gestao/motion/NumeroAnimado";

// ── Aviso de meta — fita compacta em grafite (cor de contraste da marca).
// O % na cor da marca (primary-on-dark) é o único destaque de cor; barra fina de progresso.
export function AvisoMeta({ meta }: { meta: ResumoMeta }) {
  const reduzir = useReducedMotion();
  const pct = Math.round(meta.progresso * 100);
  const largura = Math.min(100, pct);
  const batido = meta.feito >= meta.alvo;

  // Mesma redação do bloco de meta dos Relatórios — fonte única da frase.
  const ritmo = fraseRitmo({
    feito: meta.feito,
    alvo: meta.alvo,
    restam: meta.restam,
    diasRestantes: meta.diasRestantes,
    projecao: meta.projecao,
  });

  return (
    <section
      className="flex items-center gap-4 rounded-[var(--radius)] bg-inverso px-4 py-3 text-white shadow-[var(--shadow-soft)] sm:px-5"
      aria-label={`Meta de ${meta.mesLabel}: ${meta.feito} de ${meta.alvo} vendas`}
    >
      <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-primary-on-dark sm:grid">
        <Trophy size={18} strokeWidth={1.9} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-white/55">
            Meta de {meta.mesLabel}
          </span>
          <span className="text-sm font-semibold text-white">
            {meta.feito} <span className="text-white/60">de {meta.alvo} vendas</span>
          </span>
        </div>

        <div
          className="mt-2 h-1.5 overflow-hidden rounded-[var(--radius-control)] bg-white/15"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Preenche em vez de nascer pronta — é o ponteiro subindo. */}
          <motion.div
            className="h-full rounded-[var(--radius-control)] bg-primary-on-dark"
            initial={reduzir ? false : { width: 0 }}
            animate={{ width: `${largura}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
        </div>

        <p className="mt-1.5 text-xs text-white/55">{ritmo}</p>
      </div>

      <div className="shrink-0 text-right leading-none">
        <span className="text-2xl font-semibold text-primary-on-dark">
          <NumeroAnimado valor={pct} formato="porcento" />
        </span>
        <span className="mt-1 block text-[0.7rem] text-white/50">da meta</span>
      </div>
    </section>
  );
}

// ── Aviso de veículos sem margem — mesmo padrão âmbar do Estoque.
// Some quando não há nenhum. Leva pro Estoque pra definir a margem.
export function AvisoSemMargem({ quantidade }: { quantidade: number }) {
  if (quantidade <= 0) return null;

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-warning/25 bg-warning-bg px-4 py-3 shadow-[var(--shadow-soft)] sm:px-5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning text-white">
        <TriangleAlert size={16} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-warning-ink">
          {quantidade === 1
            ? "1 veículo sem desconto liberado"
            : `${quantidade} veículos sem desconto liberado`}
        </p>
        <p className="text-xs text-warning-ink/80">
          O vendedor não consegue oferecer desconto até você definir a margem.
        </p>
      </div>
      <Link
        href="/gestao/estoque"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius)] bg-surface px-3.5 py-2 text-sm font-semibold text-warning-ink transition-colors duration-200 hover:bg-surface-2"
      >
        Resolver
        <ArrowRight size={15} strokeWidth={2.25} />
      </Link>
    </section>
  );
}
