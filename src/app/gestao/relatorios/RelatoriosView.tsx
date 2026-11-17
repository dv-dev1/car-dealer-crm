import Link from "next/link";
import {
  PERIODOS,
  type EtapaFunil,
  type FormaResumo,
  type Janela,
  type MesResumo,
  type ModeloResumo,
  type Periodo,
  type ResumoVendas,
  type VendaRelatorio,
} from "@/features/reports/rules";
import type { ResumoMetaMes } from "@/lib/metas";
import { MetaBloco } from "@/components/gestao/relatorios/MetaBloco";
import { KpiGrid } from "@/components/gestao/relatorios/KpiGrid";
import { BarrasMes } from "@/components/gestao/relatorios/BarrasMes";
import { RankingVeiculos } from "@/components/gestao/relatorios/RankingVeiculos";
import { FunilConversao } from "@/components/gestao/relatorios/FunilConversao";
import { VendasTabela } from "@/components/gestao/relatorios/VendasTabela";
import { CanaisTabela } from "@/components/gestao/relatorios/CanaisTabela";
import type { ChannelRow } from "@/features/channels/model";
import { ExportarPdf } from "@/components/gestao/relatorios/ExportarPdf";
import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { AoEntrar } from "@/components/gestao/motion/AoEntrar";

/**
 * Relatórios do gestor. KPIs, ranking, funil e a lista de vendas seguem o período
 * da URL; o gráfico do ano é a visão fixa do ano corrente. Toda a conta vem pronta
 * do servidor (`features/reports`); sem lucro, a tela não fala em lucro, margem
 * nem custo.
 */
export function RelatoriosView({
  periodo,
  janela,
  rotulo,
  resumo,
  meses,
  ano,
  mesCorrente,
  ranking,
  formas,
  funil,
  vendas,
  canais = null,
  meta,
  mesLabel,
  podeEditarMeta,
}: {
  periodo: Periodo;
  janela: Janela;
  rotulo: string;
  resumo: ResumoVendas;
  meses: MesResumo[];
  ano: number;
  mesCorrente: number;
  ranking: ModeloResumo[];
  formas: FormaResumo[];
  funil: { etapas: EtapaFunil[]; conversaoGeral: number };
  vendas: VendaRelatorio[];
  /** Null for a seller: channels are for owner and manager. */
  canais?: ChannelRow[] | null;
  meta: ResumoMetaMes | null;
  mesLabel: string;
  podeEditarMeta: boolean;
}) {
  const comLucro = resumo.lucro !== null;
  return (
    <div>
      <CabecalhoGestao
        eyebrow="Central de gestão"
        titulo="Relatórios"
        apoio={
          comLucro
            ? "O resultado da loja — vendas, lucro e como o funil converte."
            : "O resultado da loja — vendas e como o funil converte."
        }
        acoes={<ExportarPdf />}
      />

      {/* Meta do mês (antiga tela Metas, enxugada) */}
      <MetaBloco meta={meta} mesLabel={mesLabel} podeEditar={podeEditarMeta} />

      {/* Seletor de período */}
      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Período">
        {PERIODOS.map((p) => {
          const ativo = periodo === p.valor;
          const href = p.valor === "custom" ? `?periodo=custom&de=${janela.de}&ate=${janela.ate}` : `?periodo=${p.valor}`;
          return (
            <Link
              key={p.valor}
              href={href}
              aria-current={ativo ? "page" : undefined}
              className={`rounded-[var(--radius-control)] px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] active:scale-[0.96] ${
                ativo
                  ? "bg-primary text-on-primary"
                  : "border border-line bg-surface text-secondary/80 hover:bg-sand"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {periodo === "custom" && (
        <form
          method="get"
          className="mt-3 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-line bg-surface px-4 py-3"
        >
          <input type="hidden" name="periodo" value="custom" />
          <label className="flex items-center gap-2 text-sm text-secondary">
            De
            <input
              type="date"
              name="de"
              defaultValue={janela.de}
              required
              className="rounded-[var(--radius-control)] border border-line bg-background px-2.5 py-1.5 text-sm text-secondary focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-secondary">
            até
            <input
              type="date"
              name="ate"
              defaultValue={janela.ate}
              required
              className="rounded-[var(--radius-control)] border border-line bg-background px-2.5 py-1.5 text-sm text-secondary focus:border-primary focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius-control)] bg-primary px-3.5 py-1.5 text-sm font-medium text-on-primary"
          >
            Ver período
          </button>
          <span className="text-xs text-muted">Até um ano por vez.</span>
        </form>
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
        <BarrasMes meses={meses} ano={ano} mesCorrente={mesCorrente} />
      </AoEntrar>

      {/* Ranking + Funil */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AoEntrar ordem={0}>
          <RankingVeiculos ranking={ranking} formas={formas} />
        </AoEntrar>
        <AoEntrar ordem={1}>
          <FunilConversao etapas={funil.etapas} conversaoGeral={funil.conversaoGeral} rotulo={rotulo} />
        </AoEntrar>
      </div>

      {canais && <CanaisTabela canais={canais} />}

      {/* Registro de vendas */}
      <AoEntrar className="mt-6">
        <VendasTabela vendas={vendas} rotulo={rotulo} />
      </AoEntrar>
    </div>
  );
}
