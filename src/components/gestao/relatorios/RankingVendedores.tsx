"use client";

import { useActionState } from "react";
import { setSellerGoalAction } from "@/features/reports/actions";
import type { SellerRank } from "@/features/reports/seller-goals";
import { fraseRitmo, resumoMetaMes } from "@/lib/metas";

function Linha({ row, posicao, canEdit, today }: { row: SellerRank; posicao: number; canEdit: boolean; today: string }) {
  const [estado, acao, enviando] = useActionState(setSellerGoalAction, { error: null });
  const meta = row.goal === null ? null : resumoMetaMes({ alvo: row.goal, feito: row.sold, emNegociacao: 0, aguardandoRetorno: 0 }, today);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-secondary">
          <span className="mr-2 font-semibold tabular-nums text-muted">{posicao}º</span>
          <span className="font-medium">{row.name}</span>
          {row.mine && <span className="ml-2 text-xs text-muted-strong">você</span>}
        </p>
        <p className="text-sm font-semibold tabular-nums text-secondary">
          {row.goal === null ? `${row.sold} ${row.sold === 1 ? "venda" : "vendas"}` : `${row.sold} de ${row.goal}`}
        </p>
      </div>
      {meta && <p className="mt-0.5 text-xs text-muted-strong">{fraseRitmo({ ...meta, unidadeDias: "dias úteis" })}</p>}
      {canEdit && (
        <form action={acao} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="memberId" value={row.memberId} />
          <input name="cars" inputMode="numeric" defaultValue={row.goal ?? ""} placeholder="Carros" aria-label={`Meta de ${row.name} no mês`}
            className="w-24 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 py-1.5 text-sm text-secondary tabular-nums focus:border-primary focus:outline-none" />
          <button type="submit" disabled={enviando} className="text-sm font-semibold text-primary hover:text-primary-hover disabled:opacity-60">
            {enviando ? "Salvando…" : row.goal === null ? "Definir meta" : "Salvar meta"}
          </button>
          {estado.error && <p role="alert" className="w-full text-sm text-danger-ink">{estado.error}</p>}
        </form>
      )}
    </li>
  );
}

/** O ranking do mês por vendedor, com a meta e o ritmo de quem tem meta. Dono e gerente definem a de cada um. */
export function RankingVendedores({ rows, canEdit, today }: { rows: SellerRank[]; canEdit: boolean; today: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-5 rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-semibold text-secondary">Vendedores no mês</h2>
      <p className="mt-1 text-xs text-muted-strong">
        Carros vendidos por cada um no mês{canEdit ? ". Deixe a meta vazia e salve para tirá-la." : "."}
      </p>
      <ul className="mt-2 divide-y divide-line">
        {rows.map((row, i) => (
          <Linha key={row.memberId} row={row} posicao={i + 1} canEdit={canEdit} today={today} />
        ))}
      </ul>
    </section>
  );
}
