"use client";

import { useActionState } from "react";

import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";

import { formatPreco } from "@/lib/format";

import {
  addStoreExpenseAction, removeStoreExpenseAction, setMoneyRateAction, setStaleLeadDaysAction, type StoreSettingsState,
} from "./actions";
import type { StoreExpense, StoreExpenseCategory } from "./expenses";

const INITIAL: StoreSettingsState = { error: null };
const field =
  "w-32 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-secondary tabular-nums focus:border-primary focus:outline-none";
const pctBr = (rate: number) => String(Number((rate * 100).toFixed(2))).replace(".", ",");

/** Store settings for owner and manager: the monthly cost of money and when a client counts as stale. */
export function StoreSettingsView({ moneyRate, staleLeadDays }: { moneyRate: number; staleLeadDays: number }) {
  const [state, formAction, pending] = useActionState(setMoneyRateAction, INITIAL);
  const [stale, staleAction, savingStale] = useActionState(setStaleLeadDaysAction, INITIAL);

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
      <form action={staleAction} className="max-w-xl space-y-3 rounded-[var(--radius)] border border-line bg-surface p-5">
        <label htmlFor="stale-lead-days" className="block font-semibold text-secondary">
          Cliente parado depois de quantos dias
        </label>
        <p className="text-sm text-muted-strong">
          Cliente aberto sem contato há mais dias do que isto aparece como parado no Painel. Padrão: 3 dias.
        </p>
        <div className="flex items-center gap-2">
          <input id="stale-lead-days" name="staleLeadDays" inputMode="numeric" required defaultValue={staleLeadDays} className={field} />
          <button
            type="submit"
            disabled={savingStale}
            className="rounded-[var(--radius-control)] bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {savingStale ? "Salvando…" : "Salvar"}
          </button>
        </div>
        {stale.error && (
          <p role="alert" className="text-sm text-danger-ink">
            {stale.error}
          </p>
        )}
        {stale.saved && !stale.error && (
          <p role="status" className="text-sm text-success-ink">
            Dias salvos.
          </p>
        )}
      </form>
    </div>
  );
}

const CATEGORY_LABEL: Record<StoreExpenseCategory, string> = {
  rent: "Aluguel",
  payroll: "Salários",
  accountant: "Contador",
  utilities: "Energia, água e internet",
  other: "Outra",
};
const input = "rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary";

function ExpenseLine({ expense }: { expense: StoreExpense }) {
  const [state, action, pending] = useActionState(removeStoreExpenseAction, INITIAL);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="text-secondary">
        {CATEGORY_LABEL[expense.category]}
        {expense.description && <span className="text-muted-strong"> · {expense.description}</span>}
      </span>
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="id" value={expense.id} />
        <span className="font-semibold tabular-nums text-secondary">{formatPreco(expense.amount)}</span>
        <button type="submit" disabled={pending} className="font-medium text-danger-ink hover:underline disabled:opacity-60">
          Remover
        </button>
      </form>
      {state.error && <p role="alert" className="w-full text-sm text-danger-ink">{state.error}</p>}
    </li>
  );
}

/** The owner's fixed expenses of the month; they feed "faltam X carros para pagar o mês" on the Painel. */
export function StoreExpensesSettings({ expenses, mesLabel }: { expenses: StoreExpense[]; mesLabel: string }) {
  const [state, action, pending] = useActionState(addStoreExpenseAction, INITIAL);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  return (
    <section className="max-w-xl space-y-3 rounded-[var(--radius)] border border-line bg-surface p-5">
      <h2 className="font-semibold text-secondary">Despesas fixas de {mesLabel}</h2>
      <p className="text-sm text-muted-strong">
        Aluguel, salários, contador e o resto que a loja paga todo mês. Só o dono vê. O Painel usa este total para dizer quantos
        carros faltam para pagar o mês.
      </p>
      {expenses.length === 0 ? (
        <p className="text-sm text-muted-strong">Nenhuma despesa lançada neste mês.</p>
      ) : (
        <ul className="divide-y divide-line">
          {expenses.map((expense) => (
            <ExpenseLine key={expense.id} expense={expense} />
          ))}
          <li className="flex justify-between py-2 text-sm font-semibold text-secondary">
            <span>Total</span>
            <span className="tabular-nums">{formatPreco(total)}</span>
          </li>
        </ul>
      )}
      <form action={action} className="flex flex-wrap items-center gap-2">
        <select name="category" defaultValue="rent" aria-label="Categoria" className={input}>
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input name="description" maxLength={200} placeholder="Descrição (opcional)" aria-label="Descrição" className={`${input} flex-1`} />
        <input name="amount" inputMode="numeric" required placeholder="R$ 0" aria-label="Valor" className={`${input} w-28 tabular-nums`} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Lançar despesa"}
        </button>
        {state.error && <p role="alert" className="w-full text-sm text-danger-ink">{state.error}</p>}
      </form>
    </section>
  );
}
