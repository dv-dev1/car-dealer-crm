"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Trophy, Pencil, Check, X, ArrowRight } from "lucide-react";
import { setGoalAction } from "@/features/reports/actions";
import { fraseRitmo, type ResumoMetaMes } from "@/lib/metas";

/**
 * Meta do mês no topo dos Relatórios (a antiga tela "Metas", enxugada). Fita
 * grafite — a assinatura da meta, a mesma do resumo no Painel — mas aqui ela é a
 * versão gerenciável: dono e gerente editam o alvo, e ela sugere a próxima ação.
 * `meta` nulo: o mês ainda não tem meta.
 */
export function MetaBloco({
  meta,
  mesLabel,
  podeEditar,
}: {
  meta: ResumoMetaMes | null;
  mesLabel: string;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [state, salvar, salvando] = useActionState(
    async (prev: { error: string | null }, form: FormData) => {
      const result = await setGoalAction(prev, form);
      if (!result.error) setEditando(false);
      return result;
    },
    { error: null },
  );
  const mes = mesLabel.toLowerCase();

  const editor = podeEditar && (
    !editando ? (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex items-center gap-1 rounded-[var(--radius-control)] px-1.5 py-0.5 text-[0.7rem] text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white"
      >
        <Pencil size={11} />
        {meta ? "Editar meta" : "Definir meta"}
      </button>
    ) : (
      <form action={salvar} className="inline-flex items-center gap-1">
        <input
          autoFocus
          name="cars"
          defaultValue={meta?.alvo ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditando(false);
          }}
          inputMode="numeric"
          maxLength={2}
          aria-label="Nova meta de vendas do mês"
          className="w-14 rounded-[var(--radius-control)] border border-white/25 bg-white/10 px-2 py-0.5 text-sm font-semibold text-white focus:border-primary-on-dark focus:outline-none"
        />
        <button
          type="submit"
          disabled={salvando}
          aria-label="Salvar meta"
          className="grid h-6 w-6 place-items-center rounded-full bg-primary-on-dark text-inverso hover:bg-primary-on-dark/85 disabled:opacity-60"
        >
          <Check size={13} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          aria-label="Cancelar"
          className="grid h-6 w-6 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X size={13} />
        </button>
      </form>
    )
  );
  const erro = editando && state.error && (
    <p role="alert" className="mt-1 text-xs text-white">
      {state.error}
    </p>
  );

  if (!meta) {
    return (
      <section
        className="overflow-hidden rounded-[var(--radius)] bg-inverso px-5 py-4 text-white shadow-[var(--shadow-soft)]"
        aria-label={`Meta de ${mes}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-white/55">Meta de {mes}</span>
          {editor}
        </div>
        <p className="mt-1 text-sm text-white/70">
          {podeEditar ? `Sem meta para ${mes}. Defina quantos carros a loja quer vender.` : `A meta de ${mes} ainda não foi definida.`}
        </p>
        {erro}
      </section>
    );
  }

  // Mesma frase da fita do Painel (fonte única) — só a batida ganha um floreio,
  // porque aqui é a tela onde o gestor vem comemorar o resultado.
  const ritmo = meta.batido
    ? "Meta batida no mês. Cada venda a mais já é recorde."
    : fraseRitmo({
        feito: meta.feito,
        alvo: meta.alvo,
        restam: meta.restam,
        diasRestantes: meta.diasRestantes,
        projecao: meta.projecao,
        unidadeDias: "dias úteis",
      });

  const acao = meta.batido
    ? { texto: "Segue fechando", href: "/gestao/clientes", cta: "Ver funil" }
    : meta.emNegociacao > 0
      ? {
          texto: `${meta.emNegociacao} em negociação — feche quem já está quente.`,
          href: "/gestao/clientes",
          cta: "Abrir negociações",
        }
      : meta.aguardandoRetorno > 0
        ? {
            texto: `${meta.aguardandoRetorno} aguardando retorno — ligue antes de esfriar.`,
            href: "/gestao/clientes",
            cta: "Ver retornos",
          }
        : {
            texto: "Funil precisa de gente — cadastre e agende visitas.",
            href: "/gestao/clientes?novo=1",
            cta: "Cadastrar cliente",
          };

  return (
    <section
      className="overflow-hidden rounded-[var(--radius)] bg-inverso text-white shadow-[var(--shadow-soft)]"
      aria-label={`Meta de ${meta.mesLabel}: ${meta.feito} de ${meta.alvo} vendas`}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-primary-on-dark sm:grid">
          <Trophy size={20} strokeWidth={1.9} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-white/55">
              Meta de {meta.mesLabel} {meta.ano}
            </span>
            {editor}
          </div>
          {erro}

          <p className="mt-1 text-lg font-semibold">
            {meta.feito} <span className="text-white/55">de {meta.alvo} vendas</span>
          </p>

          <div
            className="mt-2 h-1.5 max-w-md overflow-hidden rounded-[var(--radius-control)] bg-white/15"
            role="progressbar"
            aria-valuenow={meta.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-[var(--radius-control)] bg-primary-on-dark transition-[width] duration-500 ease-[var(--ease-brand)]"
              style={{ width: `${meta.pct}%` }}
            />
          </div>

          <p className="mt-1.5 text-xs text-white/55">{ritmo}</p>
        </div>

        <div className="shrink-0 text-right leading-none">
          <span data-kpi className="text-3xl font-semibold tabular-nums text-primary-on-dark">{meta.pct}%</span>
          <span className="mt-1 block text-[0.7rem] text-white/50">da meta</span>
        </div>
      </div>

      {/* Próxima ação — a régua útil que a tela Metas trazia, em uma linha */}
      <Link
        href={acao.href}
        className="flex items-center gap-2 border-t border-white/10 px-5 py-2.5 text-xs text-white/70 transition-colors duration-200 hover:bg-white/5 hover:text-white"
      >
        <span className="min-w-0 flex-1 truncate">{acao.texto}</span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary-on-dark">
          {acao.cta}
          <ArrowRight size={13} strokeWidth={2.25} />
        </span>
      </Link>
    </section>
  );
}
