"use client";

import { BadgeCheck, XCircle } from "lucide-react";
import type { Alvo, PropsDrop } from "./BoardFunil";

/**
 * Zonas de fechamento do funil. Ficam abaixo das colunas ativas: arrastar um
 * card pra cá registra a venda (abre o diálogo de valor/forma) ou marca a perda.
 * Quietas em repouso; acendem quando há um card sendo arrastado e destacam
 * quando ele passa por cima. O contador dá o retorno do mês.
 *
 * Os handlers de drop vêm prontos do board (arraste nativo do HTML5) — aqui só
 * mora o visual.
 */
export function ZonaFechamento({
  vendasMes,
  perdasMes,
  arrastando,
  sobre,
  dropVendeu,
  dropNaoComprou,
}: {
  vendasMes: number;
  perdasMes: number;
  arrastando: boolean;
  sobre: Alvo | null;
  dropVendeu: PropsDrop;
  dropNaoComprou: PropsDrop;
}) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Zona
        icone={<BadgeCheck size={20} strokeWidth={1.9} />}
        titulo="Vendeu"
        legenda={`${vendasMes} ${vendasMes === 1 ? "venda" : "vendas"} em julho`}
        tom="success"
        arrastando={arrastando}
        sobre={sobre === "vendeu"}
        drop={dropVendeu}
      />
      <Zona
        icone={<XCircle size={20} strokeWidth={1.9} />}
        titulo="Não comprou"
        legenda={`${perdasMes} ${perdasMes === 1 ? "perdido" : "perdidos"} em julho`}
        tom="neutro"
        arrastando={arrastando}
        sobre={sobre === "nao-comprou"}
        drop={dropNaoComprou}
      />
    </div>
  );
}

function Zona({
  icone,
  titulo,
  legenda,
  tom,
  arrastando,
  sobre,
  drop,
}: {
  icone: React.ReactNode;
  titulo: string;
  legenda: string;
  tom: "success" | "neutro";
  arrastando: boolean;
  sobre: boolean;
  drop: PropsDrop;
}) {
  const sucesso = tom === "success";

  // Estado visual: repouso → tracejado discreto; arrastando → convida; sobre →
  // acende sólido (cor + borda, nunca só cor).
  const base =
    "flex items-center gap-3 rounded-[var(--radius)] border-2 px-4 py-3.5 transition-colors duration-200";
  const estado = sobre
    ? sucesso
      ? "border-success bg-success-bg"
      : "border-secondary/40 bg-sand"
    : arrastando
      ? "border-dashed " + (sucesso ? "border-success/60 bg-success-bg/40" : "border-line bg-sand/50")
      : "border-dashed border-line bg-surface";

  return (
    <div {...drop} className={`${base} ${estado}`} aria-label={`Zona ${titulo}`}>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          sucesso ? "bg-success-bg text-success" : "bg-sand text-secondary/60"
        }`}
      >
        {icone}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-secondary">
          {sobre ? `Soltar em ${titulo}` : titulo}
        </p>
        <p className="text-xs text-muted-strong">{arrastando && !sobre ? "arraste pra cá" : legenda}</p>
      </div>
    </div>
  );
}
