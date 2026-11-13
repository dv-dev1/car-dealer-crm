import { formatPreco } from "@/lib/format";
import {
  rankingModelos,
  porFormaPagamento,
  type FormaResumo,
} from "@/lib/relatorios";
import type { Janela, FormaPagamento } from "@/data/vendas-mock";

// Three distinct tokens: a theme may give primary and secondary the same ink.
const COR_FORMA: Record<FormaPagamento, string> = {
  Financiamento: "var(--primary)",
  "Troca + diferença": "var(--neutral)",
  "À vista": "var(--success)",
};

function pct(fracao: number): string {
  return `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}

/**
 * O que girou no período: ranking de modelos (barra por número de vendas) e como
 * os clientes pagaram (barra segmentada). Junta as duas leituras que o gestor faz
 * junto — "o que vende" e "como entra o dinheiro".
 */
export function RankingVeiculos({ janela }: { janela: Janela }) {
  const ranking = rankingModelos(janela);
  const formas = porFormaPagamento(janela);
  // A barra mede FATURAMENTO, não contagem: num mês típico cada modelo vende 1,
  // e barras de contagem sairiam todas cheias e iguais — decoração sem leitura.
  // Pelo faturamento a barra diferencia de fato o que pesa no caixa.
  const maxFaturamento = Math.max(...ranking.map((r) => r.faturamento), 1);

  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-secondary">Ranking de veículos</h2>
      <p className="mt-0.5 text-sm text-muted-strong">Modelos mais vendidos no período.</p>

      {ranking.length === 0 ? (
        <p className="mt-6 rounded-[calc(var(--radius)-4px)] border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          Nenhuma venda no período.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {ranking.map((r, i) => (
            <li key={r.modelo} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-strong">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-secondary">{r.modelo}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-strong">
                    {r.vendas} {r.vendas === 1 ? "venda" : "vendas"} ·{" "}
                    <span className="text-secondary/80">{formatPreco(r.faturamento)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-[var(--radius-control)] bg-sand">
                  <div
                    className="h-full rounded-[var(--radius-control)] bg-primary transition-[width] duration-500 ease-[var(--ease-brand)]"
                    style={{ width: `${(r.faturamento / maxFaturamento) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {formas.length > 0 && <ComoPagaram formas={formas} />}
    </section>
  );
}

function ComoPagaram({ formas }: { formas: FormaResumo[] }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-semibold text-secondary">Como pagaram</h3>
      {/* Barra segmentada */}
      <div className="mt-3 flex h-3 w-full gap-px overflow-hidden rounded-[var(--radius-control)]">
        {formas.map((f) => (
          <div
            key={f.forma}
            className="h-full"
            style={{ width: `${f.fatia * 100}%`, backgroundColor: COR_FORMA[f.forma] }}
            title={`${f.forma}: ${f.vendas}`}
          />
        ))}
      </div>
      {/* Legenda — chips inline que não quebram no meio do rótulo */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {formas.map((f) => (
          <li key={f.forma} className="flex items-center gap-2 whitespace-nowrap text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: COR_FORMA[f.forma] }}
            />
            <span className="text-secondary/85">{f.forma}</span>
            <span className="font-medium tabular-nums text-muted-strong">{pct(f.fatia)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
