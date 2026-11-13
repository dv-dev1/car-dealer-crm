"use client";

import { formatPreco } from "@/lib/format";
import { vendasPorMes, type MesResumo } from "@/lib/relatorios";

const ALTURA = 190; // px — área útil das barras

function pct(fracao: number): string {
  return `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Vendas mês a mês do ano — o gráfico "grande" da tela. Cada barra é o
 * faturamento do mês, empilhado: lucro (verde) na base, custo (caramelo) em
 * cima. Lê de relance quanto entrou e quanto virou lucro. SVG não; divs, pra o
 * tooltip e o realce do mês corrente saírem baratos. Sem lib.
 */
export function BarrasMes({ ano, mesCorrente }: { ano: number; mesCorrente: number }) {
  const meses = vendasPorMes(ano);
  const maxFat = Math.max(...meses.map((m) => m.faturamento), 1);

  return (
    <section
      aria-label={`Vendas mês a mês de ${ano}`}
      className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-secondary">Vendas mês a mês</h2>
          <p className="mt-0.5 text-sm text-muted-strong">
            Faturamento de cada mês de {ano}, com o lucro dentro.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-strong">
          <Legenda cor="var(--success)" texto="Lucro" />
          <Legenda cor="var(--primary)" texto="Custo" />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="flex min-w-[560px] items-end gap-2" style={{ height: ALTURA }}>
          {meses.map((m) => (
            <Coluna key={m.mes} m={m} maxFat={maxFat} corrente={m.mes === mesCorrente} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Coluna({ m, maxFat, corrente }: { m: MesResumo; maxFat: number; corrente: boolean }) {
  const hCusto = ((m.faturamento - m.lucro) / maxFat) * 100;
  const hLucro = (m.lucro / maxFat) * 100;
  const vazio = m.vendas === 0;

  return (
    <div className="group/col relative flex h-full flex-1 flex-col items-center justify-end">
      {/* Tooltip */}
      {!vazio && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-10 w-40 -translate-x-1/2 rounded-[calc(var(--radius)-4px)] border border-line bg-surface px-3 py-2 text-left opacity-0 shadow-[var(--shadow-hover)] transition-opacity duration-150 group-hover/col:opacity-100"
        >
          <p className="text-xs font-semibold text-secondary">{m.label}</p>
          <p className="mt-1 text-xs text-muted-strong">
            Faturou{" "}
            <span className="font-medium tabular-nums text-secondary">
              {formatPreco(m.faturamento)}
            </span>
          </p>
          <p className="text-xs text-muted-strong">
            Lucro{" "}
            <span className="font-medium tabular-nums text-success-ink">
              {formatPreco(m.lucro)}
            </span>
          </p>
          <p className="text-xs text-muted-strong">
            {m.vendas} {m.vendas === 1 ? "venda" : "vendas"} · margem{" "}
            {pct(m.faturamento ? m.lucro / m.faturamento : 0)}
          </p>
        </div>
      )}

      {/* Barra empilhada */}
      <div
        className={`relative flex w-full max-w-[38px] flex-col justify-end rounded-t-[5px] ${
          corrente ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-surface" : ""
        }`}
        style={{ height: "100%" }}
      >
        {vazio ? (
          <div className="h-[3px] w-full rounded-[var(--radius-control)] bg-line" aria-hidden="true" />
        ) : (
          <>
            <div
              className="w-full rounded-t-[5px] bg-primary/85 transition-[height] duration-500 ease-[var(--ease-brand)]"
              style={{ height: `${hCusto}%` }}
            />
            <div
              className="w-full bg-success transition-[height] duration-500 ease-[var(--ease-brand)]"
              style={{ height: `${hLucro}%` }}
            />
          </>
        )}
      </div>

      {/* Rótulo do mês */}
      <span
        className={`mt-2 text-[0.7rem] tabular-nums ${
          corrente ? "font-semibold text-primary" : "text-muted-strong"
        }`}
      >
        {m.label}
      </span>
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: cor }} />
      {texto}
    </span>
  );
}
