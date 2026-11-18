"use client";

import { useActionState } from "react";

import { sendInterestAction } from "@/features/site/actions";
import type { InterestState } from "@/features/site/rules";
import { Turnstile } from "@/shared/Turnstile";

const INITIAL: InterestState = { status: "idle" };
const field =
  "mt-1.5 w-full rounded-[var(--radius)] border border-line bg-surface px-3.5 py-2.5 text-sm text-secondary focus:border-primary focus:outline-none";

/** "Tenho interesse": the visitor leaves a name and a WhatsApp, and the store finds them in its funnel. */
export function Interesse({ slug, siteKey }: { slug: string; siteKey: string }) {
  const [state, formAction, pending] = useActionState(sendInterestAction, INITIAL);
  if (state.status === "sent") {
    return (
      <p role="status" className="mt-6 rounded-[var(--radius)] border border-line bg-sand/40 px-4 py-3 text-sm font-medium text-secondary">
        Recebemos seu contato. A loja chama você no WhatsApp.
      </p>
    );
  }
  return (
    <form action={formAction} className="mt-6 border-t border-line pt-5">
      <p className="text-sm font-semibold text-secondary">Prefere que a loja chame você?</p>
      <input type="hidden" name="vehicle" value={slug} />
      <label className="mt-3 block text-xs font-medium uppercase tracking-wider text-muted">
        Nome
        <input name="name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={state.typed?.name ?? ""} className={field} />
      </label>
      <label className="mt-3 block text-xs font-medium uppercase tracking-wider text-muted">
        WhatsApp com DDD
        <input name="phone" required type="tel" inputMode="tel" maxLength={20} autoComplete="tel" placeholder="(83) 90000-0000" defaultValue={state.typed?.phone ?? ""} className={field} />
      </label>
      <div className="mt-3">
        <Turnstile siteKey={siteKey} renewOn={state} />
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-danger-ink">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 w-full rounded-[var(--radius)] bg-secondary px-6 py-3 text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Tenho interesse"}
      </button>
      <p className="mt-2 text-xs text-muted">Seu nome e WhatsApp vão só para a loja, para ela falar com você sobre este carro.</p>
    </form>
  );
}
