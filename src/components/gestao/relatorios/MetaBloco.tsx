"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trophy, Pencil, Check, X, ArrowRight } from "lucide-react";
import { useLeads } from "@/lib/clientes-store";
import { useMeta, definirMeta } from "@/lib/metas-store";
import { resumoMetaMes, fraseRitmo } from "@/lib/metas";

/**
 * Meta do mês no topo dos Relatórios (a antiga tela "Metas", enxugada). Fita
 * grafite — a assinatura da meta, a mesma do resumo no Painel — mas aqui ela é a
 * versão gerenciável: edita o alvo e sugere a próxima ação. A contagem vem do
 * funil (marca "Vendeu" e sobe aqui), sem número paralelo.
 */
export function MetaBloco() {
  const leads = useLeads();
  const alvo = useMeta();
  const meta = useMemo(() => resumoMetaMes(leads, alvo), [leads, alvo]);

  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(String(alvo));

  function salvar() {
    const n = Number(rascunho);
    if (Number.isFinite(n) && n > 0) definirMeta(n);
    setEditando(false);
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
        <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-primary sm:grid">
          <Trophy size={20} strokeWidth={1.9} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-white/55">
              Meta de {meta.mesLabel} {meta.ano}
            </span>
            {!editando ? (
              <button
                type="button"
                onClick={() => {
                  setRascunho(String(alvo));
                  setEditando(true);
                }}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.7rem] text-white/60 transition-colors duration-200 hover:bg-white/10 hover:text-white"
              >
                <Pencil size={11} />
                Editar meta
              </button>
            ) : (
              <span className="inline-flex items-center gap-1">
                <input
                  autoFocus
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") salvar();
                    if (e.key === "Escape") setEditando(false);
                  }}
                  inputMode="numeric"
                  aria-label="Nova meta de vendas do mês"
                  className="w-14 rounded-[calc(var(--radius)-6px)] border border-white/25 bg-white/10 px-2 py-0.5 text-sm font-semibold text-white focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={salvar}
                  aria-label="Salvar meta"
                  className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white hover:bg-primary-hover"
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
              </span>
            )}
          </div>

          <p className="mt-1 text-lg font-semibold">
            {meta.feito} <span className="text-white/55">de {meta.alvo} vendas</span>
          </p>

          <div
            className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            aria-valuenow={meta.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[var(--ease-brand)]"
              style={{ width: `${meta.pct}%` }}
            />
          </div>

          <p className="mt-1.5 text-xs text-white/55">{ritmo}</p>
        </div>

        <div className="shrink-0 text-right leading-none">
          <span className="text-3xl font-semibold tabular-nums text-primary">{meta.pct}%</span>
          <span className="mt-1 block text-[0.7rem] text-white/50">da meta</span>
        </div>
      </div>

      {/* Próxima ação — a régua útil que a tela Metas trazia, em uma linha */}
      <Link
        href={acao.href}
        className="flex items-center gap-2 border-t border-white/10 px-5 py-2.5 text-xs text-white/70 transition-colors duration-200 hover:bg-white/5 hover:text-white"
      >
        <span className="min-w-0 flex-1 truncate">{acao.texto}</span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary">
          {acao.cta}
          <ArrowRight size={13} strokeWidth={2.25} />
        </span>
      </Link>
    </section>
  );
}
