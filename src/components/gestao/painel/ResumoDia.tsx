"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { dailySummaryAction } from "@/features/ai/actions";

/**
 * The day's summary for owner and manager. The lines are computed and written by the server and always show;
 * the AI only rewords them on request, so the panel never waits for it.
 */
export function ResumoDia({ linhas }: { linhas: string[] }) {
  const [texto, setTexto] = useState<string | null>(null);
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

  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-semibold text-secondary">Resumo do dia</h2>
      {texto ? (
        <p className="mt-2 text-sm text-secondary">{texto}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-secondary">
          {linhas.map((linha) => (
            <li key={linha}>{linha}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={escrever}
        disabled={escrevendo}
        className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-1.5 text-sm font-semibold text-secondary hover:border-primary disabled:opacity-60"
      >
        <Sparkles size={16} strokeWidth={1.8} />
        {escrevendo ? "Escrevendo…" : texto ? "Escrever de novo" : "Escrever com IA"}
      </button>
      {aviso && <p role="status" className="mt-2 text-sm text-muted-strong">{aviso}</p>}
    </section>
  );
}
