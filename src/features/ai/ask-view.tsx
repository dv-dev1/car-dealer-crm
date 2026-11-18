"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { askStoreAction } from "./actions";
import { ASK_EXAMPLES, type AskState } from "./rules";

const INITIAL: AskState = { error: null };

/** A question about the store in plain words, the answer, and three examples to tap. Every role. */
export function AskView() {
  const [state, formAction, pending] = useActionState(askStoreAction, INITIAL);
  return (
    <section className="max-w-2xl rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <form action={formAction}>
        <label htmlFor="pergunta" className="text-sm font-medium text-secondary">
          Sua pergunta
        </label>
        <textarea
          id="pergunta"
          name="question"
          rows={2}
          maxLength={300}
          defaultValue={state.error ? state.question ?? "" : ""}
          placeholder="Ex.: quanto vendemos este mês?"
          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          <Sparkles size={16} strokeWidth={1.8} />
          {pending ? "Consultando…" : "Perguntar"}
        </button>
        <div className="mt-4 flex flex-wrap gap-2">
          {ASK_EXAMPLES.map((example) => (
            <button
              key={example}
              type="submit"
              name="example"
              value={example}
              disabled={pending}
              className="rounded-[var(--radius-control)] border border-line px-3 py-1.5 text-sm text-secondary hover:border-primary disabled:opacity-60"
            >
              {example}
            </button>
          ))}
        </div>
      </form>
      {state.error && <p role="alert" className="mt-4 text-sm text-danger-ink">{state.error}</p>}
      {state.answer && (
        <div role="status" className="mt-5 border-t border-line pt-4">
          <p className="text-sm text-muted-strong">{state.question}</p>
          <p className="mt-1.5 whitespace-pre-line text-sm text-secondary">{state.answer}</p>
          <p className="mt-3 text-xs text-muted-strong">Os números vêm do painel, com o seu acesso. O texto é da IA: confira antes de decidir.</p>
        </div>
      )}
    </section>
  );
}
