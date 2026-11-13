"use client";

import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import {
  resumoVendas,
  janelaDoPeriodo,
  rotuloPeriodo,
  PERIODOS,
  type Periodo,
  type Janela,
} from "@/data/vendas-mock";
import { HOJE_ISO } from "@/lib/hoje";
import { MetaBloco } from "@/components/gestao/relatorios/MetaBloco";
import { KpiGrid } from "@/components/gestao/relatorios/KpiGrid";
import { BarrasMes } from "@/components/gestao/relatorios/BarrasMes";
import { RankingVeiculos } from "@/components/gestao/relatorios/RankingVeiculos";
import { FunilConversao } from "@/components/gestao/relatorios/FunilConversao";
import { VendasTabela } from "@/components/gestao/relatorios/VendasTabela";
import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { AoEntrar } from "@/components/gestao/motion/AoEntrar";

const [ANO_ATUAL, MES_ATUAL] = (() => {
  const [a, m] = HOJE_ISO.split("-").map(Number);
  return [a, m - 1] as const;
})();

/**
 * Relatórios do gestor. KPIs, ranking e a lista de vendas seguem o seletor de
 * período; o gráfico do ano e o funil do mês são visões fixas (ano inteiro /
 * mês corrente) — o rótulo de cada bloco deixa claro o recorte. Toda a conta
 * vem de `lib/relatorios` + `resumoVendas`; nada de número inventado na tela.
 */
export function RelatoriosView() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const inicial = janelaDoPeriodo("mes");
  const [custom, setCustom] = useState<Janela>({ de: inicial.de, ate: inicial.ate });

  const janela = useMemo(
    () => janelaDoPeriodo(periodo, custom),
    [periodo, custom],
  );
  const resumo = useMemo(() => resumoVendas(periodo, custom), [periodo, custom]);
  const rotulo = rotuloPeriodo(periodo, custom);

  return (
    <div>
      <CabecalhoGestao
        eyebrow="Central de gestão"
        titulo="Relatórios"
        apoio="O resultado da loja — vendas, lucro e como o funil converte."
        acoes={
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface px-3.5 py-2 text-sm font-medium text-secondary transition-[background-color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] hover:bg-sand active:scale-[0.97]"
          >
            <FileDown size={16} strokeWidth={1.9} />
            Exportar PDF
          </button>
        }
      />

      {/* Meta do mês (antiga tela Metas, enxugada) */}
      <MetaBloco />

      {/* Seletor de período */}
      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Período">
        {PERIODOS.map((p) => {
          const ativo = periodo === p.valor;
          return (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPeriodo(p.valor)}
              aria-pressed={ativo}
              className={`rounded-[var(--radius-control)] px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] active:scale-[0.96] ${
                ativo
                  ? "bg-primary text-on-primary"
                  : "border border-line bg-surface text-secondary/80 hover:bg-sand"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {periodo === "custom" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-line bg-surface px-4 py-3">
          <label className="flex items-center gap-2 text-sm text-secondary">
            De
            <input
              type="date"
              value={custom.de}
              max={custom.ate}
              onChange={(e) => setCustom((c) => ({ ...c, de: e.target.value }))}
              className="rounded-[calc(var(--radius)-4px)] border border-line bg-background px-2.5 py-1.5 text-sm text-secondary focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-secondary">
            até
            <input
              type="date"
              value={custom.ate}
              min={custom.de}
              onChange={(e) => setCustom((c) => ({ ...c, ate: e.target.value }))}
              className="rounded-[calc(var(--radius)-4px)] border border-line bg-background px-2.5 py-1.5 text-sm text-secondary focus:border-primary focus:outline-none"
            />
          </label>
        </div>
      )}

      {/* KPIs do período */}
      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-strong">
        Números de {rotulo}
      </p>
      <div className="mt-3">
        <KpiGrid resumo={resumo} />
      </div>

      {/* Gráfico do ano */}
      <AoEntrar className="mt-8">
        <BarrasMes ano={ANO_ATUAL} mesCorrente={MES_ATUAL} />
      </AoEntrar>

      {/* Ranking + Funil */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AoEntrar ordem={0}>
          <RankingVeiculos janela={janela} />
        </AoEntrar>
        <AoEntrar ordem={1}>
          <FunilConversao />
        </AoEntrar>
      </div>

      {/* Registro de vendas */}
      <AoEntrar className="mt-6">
        <VendasTabela janela={janela} rotulo={rotulo} />
      </AoEntrar>
    </div>
  );
}
