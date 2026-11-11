"use client";

import Script from "next/script";
import { useActionState, useEffect, useRef, useState } from "react";

import { requestCodeAction, verifyCodeAction, type LoginState } from "./actions";

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: { sitekey: string }): string;
      remove(widgetId: string): void;
    };
  }
}

const ERRORS: Record<string, string> = {
  invalid_email: "Digite um e-mail válido.",
  rate_limited: "Muitas tentativas. Espere um minuto e tente de novo.",
  captcha_failed: "Não foi possível confirmar que você é uma pessoa. Recarregue a página.",
  invalid_code: "Código incorreto ou vencido. Peça um novo.",
};
const GOOGLE_ERROR = "Não foi possível entrar com o Google. Tente de novo.";
const INITIAL: LoginState = { step: "email", email: "", error: null };

const field = "w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2 text-secondary";
const button = "w-full rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-surface disabled:opacity-60";

function submit(prev: LoginState, form: FormData): Promise<LoginState> {
  return prev.step === "email" ? requestCodeAction(prev, form) : verifyCodeAction(prev, form);
}

// A Turnstile token is single use, so a fresh widget is rendered for every new form state.
function Turnstile({ siteKey, renewOn }: { siteKey: string; renewOn: LoginState }) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded || !container.current || !window.turnstile) return;
    const widgetId = window.turnstile.render(container.current, { sitekey: siteKey });
    return () => window.turnstile?.remove(widgetId);
  }, [loaded, siteKey, renewOn]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setLoaded(true)}
      />
      <div ref={container} />
    </>
  );
}

export function LoginView({ turnstileSiteKey, googleFailed }: { turnstileSiteKey: string; googleFailed: boolean }) {
  const [state, formAction, pending] = useActionState(submit, INITIAL);
  const error = state.error ? ERRORS[state.error] : googleFailed && state === INITIAL ? GOOGLE_ERROR : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-[var(--radius)] border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold text-secondary">Entrar na Central de Gestão</h1>

        {error && <p role="alert">{error}</p>}

        {state.step === "email" ? (
          <>
            <form action={formAction} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="email" className="block text-secondary">
                  Seu e-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={state.email}
                  className={field}
                />
              </div>
              <Turnstile siteKey={turnstileSiteKey} renewOn={state} />
              <button type="submit" disabled={pending} className={button}>
                Receber código
              </button>
            </form>
            {/* A link, not a form: the route sets the state cookie and redirects to WorkOS. */}
            <a
              href="/entrar/google"
              className="block w-full rounded-[var(--radius)] border border-line bg-surface px-4 py-2 text-center font-semibold text-secondary"
            >
              Entrar com Google
            </a>
          </>
        ) : (
          <form action={formAction} className="space-y-4">
            <p role="status">Se este e-mail tiver acesso, enviamos um código de 6 dígitos.</p>
            <input type="hidden" name="email" value={state.email} />
            <div className="space-y-1">
              <label htmlFor="code" className="block text-secondary">
                Código de 6 dígitos
              </label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                className={field}
              />
            </div>
            <button type="submit" disabled={pending} className={button}>
              Entrar
            </button>
            {/* A full page load starts the flow over with a clean state. */}
            <a href="/entrar" className="block text-center text-secondary underline">
              Usar outro e-mail
            </a>
          </form>
        )}
      </div>
    </main>
  );
}
