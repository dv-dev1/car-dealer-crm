"use client";

import { useActionState } from "react";

import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";

import { setMoneyRateAction, type StoreSettingsState } from "./actions";

const INITIAL: StoreSettingsState = { error: null };
const field =
  "w-32 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-secondary tabular-nums focus:border-primary focus:outline-none";
const pctBr = (rate: number) => String(Number((rate * 100).toFixed(2))).replace(".", ",");

/** Store settings for owner and manager: today only the monthly cost of money. */
export function StoreSettingsView({ moneyRate }: { moneyRate: number }) {
  const [state, formAction, pending] = useActionState(setMoneyRateAction, INITIAL);

  return (
    <div className="space-y-6">
      <CabecalhoGestao eyebrow="Central de gestão" titulo="Ajustes da loja" />
      <form action={formAction} className="max-w-xl space-y-3 rounded-[var(--radius)] border border-line bg-surface p-5">
        <label htmlFor="money-rate" className="block font-semibold text-secondary">
          Custo do dinheiro (% ao mês)
        </label>
        <p className="text-sm text-muted-strong">
          Quanto o dinheiro parado no carro deixa de render. Padrão: 1% ao mês. Entra no custo por dia de cada carro e no
          Painel.
        </p>
        <div className="flex items-center gap-2">
          <input id="money-rate" name="moneyRate" inputMode="decimal" required defaultValue={pctBr(moneyRate)} className={field} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-[var(--radius-control)] bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-danger-ink">
            {state.error}
          </p>
        )}
        {state.saved && !state.error && (
          <p role="status" className="text-sm text-success-ink">
            Taxa salva.
          </p>
        )}
      </form>
    </div>
  );
}
