"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { dailySummaryAction } from "@/features/ai/actions";
import type { DailyFacts } from "@/features/ai/rules";

type Tom = "urgente" | "atencao" | "neutro";

const TOM: Record<Tom, string> = {
  urgente: "text-danger-ink",
  atencao: "text-warning-ink",
  neutro: "text-secondary",
};

// Most urgent first. Each card opens the list where the problem is solved.
const CARTOES: { chave: Exclude<keyof DailyFacts, "salesToday">; um: string; varios: string; href: string; tom: Tom }[] = [
  { chave: "carsOver90", um: "carro passou de 90 dias", varios: "carros passaram de 90 dias", href: "/gestao/estoque?filtro=girar", tom: "urgente" },
  { chave: "newLeadsNoResponse", um: "cliente novo sem resposta", varios: "clientes novos sem resposta", href: "/gestao/clientes", tom: "atencao" },
  { chave: "reservationsExpiring", um: "reserva vence até amanhã", varios: "reservas vencem até amanhã", href: "/gestao/estoque?filtro=reservados", tom: "atencao" },
  { chave: "carsOver60", um: "carro entre 60 e 90 dias", varios: "carros entre 60 e 90 dias", href: "/gestao/estoque?ordem=patio-desc", tom: "atencao" },
  { chave: "priceSuggestions", um: "carro para baixar o preço", varios: "carros para baixar o preço", href: "/gestao/estoque?filtro=baixar-preco", tom: "neutro" },
  { chave: "pendingDocs", um: "carro com documento pendente", varios: "carros com documento pendente", href: "/gestao/estoque?filtro=documento", tom: "neutro" },
];

/**
 * The day's to-do for owner and manager. The numbers are computed by the server and always show; the AI only
 * rewords them on request, so the panel never waits for it. Its wording goes above the cards and never in their
 * place: a text that skips an alert or swaps two numbers is read next to the numbers themselves.
 */
export function ResumoDia({ facts, inicial }: { facts: DailyFacts; inicial?: string }) {
  const [texto, setTexto] = useState<string | null>(inicial ?? null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [escrevendo, iniciar] = useTransition();

  function escrever() {
    setAviso(null);
    iniciar(async () => {
      try {
        const result = await dailySummaryAction();
        if ("error" in result) return setAviso(result.error);
        if (result.byAi) return setTexto(result.text);
        setAviso(result.aviso ?? "A IA não respondeu agora. O resumo acima segue valendo.");
      } catch {
        setAviso("Não deu para falar com a IA. Confira a internet e tente de novo.");
      }
    });
  }

  const cartoes = CARTOES.filter((cartao) => facts[cartao.chave] > 0);
  const vendas = facts.salesToday;

  return (
    <section aria-labelledby="resumo-dia">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5">
          <h2 id="resumo-dia" className="text-lg font-semibold text-secondary">
            Pra resolver hoje
          </h2>
          <span className="text-xs text-muted-strong">
            {vendas === 0 ? "Nenhuma venda ainda hoje" : vendas === 1 ? "1 venda hoje" : `${vendas} vendas hoje`}
          </span>
        </div>
        <button
          type="button"
          onClick={escrever}
          disabled={escrevendo}
          className="-mr-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-sm font-medium text-secondary/75 transition-colors duration-[var(--dur-rapida)] hover:bg-sand hover:text-secondary disabled:opacity-60"
        >
          <Sparkles size={15} strokeWidth={1.8} />
          {escrevendo ? "Escrevendo…" : texto ? "Escrever de novo" : "Escrever com IA"}
        </button>
      </div>

      {texto && (
        <div className="mt-4 rounded-[var(--radius)] bg-sand px-4 py-3 sm:px-5">
          <p className="max-w-[70ch] text-sm leading-relaxed text-secondary">{texto}</p>
          <p className="mt-1.5 text-xs text-muted-strong">Texto da IA. Os números do painel são os dos cartões abaixo.</p>
        </div>
      )}

      {cartoes.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {cartoes.map((cartao) => {
            const n = facts[cartao.chave];
            return (
              <li key={cartao.chave}>
                <Link
                  href={cartao.href}
                  className="group flex h-full flex-col rounded-[var(--radius)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)] transition-colors duration-[var(--dur-rapida)] hover:bg-sand"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className={`text-[1.75rem] font-semibold leading-none tabular-nums ${TOM[cartao.tom]}`}>{n}</span>
                    <ArrowRight
                      size={16}
                      aria-hidden
                      className="mt-1 shrink-0 text-muted transition-[color,translate] duration-[var(--dur-rapida)] group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  </span>
                  <span className="mt-2 text-sm leading-snug text-secondary">{n === 1 ? cartao.um : cartao.varios}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface px-5 py-4 text-sm text-secondary shadow-[var(--shadow-soft)]">
          <CheckCircle2 size={18} strokeWidth={1.9} className="shrink-0 text-success-ink" />
          Nada pedindo atenção hoje.
        </p>
      )}

      {aviso && <p role="status" className="mt-3 text-sm text-muted-strong">{aviso}</p>}
    </section>
  );
}
