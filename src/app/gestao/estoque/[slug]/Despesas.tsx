"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addExpenseAction, removeExpenseAction } from "@/features/stock/actions";
import { EXPENSE_LABEL, type Expense, type ExpenseCategory } from "@/features/stock/rules";
import { formatPreco } from "@/lib/format";

const campo =
  "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary focus:border-primary focus:outline-none";
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** The car's expenses for owner and manager: what was spent, and a form to add one. */
export function Despesas({ vehicleId, expenses, today }: { vehicleId: string; expenses: Expense[]; today: string }) {
  const [abrindo, setAbrindo] = useState(false);
  const [estado, acao, enviando] = useActionState(addExpenseAction, { error: null });

  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">Despesas do carro</p>
        {!abrindo && (
          <button
            type="button"
            onClick={() => setAbrindo(true)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover"
          >
            <Plus size={15} />
            Lançar despesa
          </button>
        )}
      </div>

      {abrindo && (
        <form action={acao} className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <label className="text-sm font-medium text-secondary">
            Categoria
            <select name="category" defaultValue={"mechanical" satisfies ExpenseCategory} className={`${campo} mt-1`}>
              {Object.entries(EXPENSE_LABEL).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-secondary">
            Data
            <input type="date" name="spentOn" defaultValue={today} max={today} required className={`${campo} mt-1`} />
          </label>
          <label className="text-sm font-medium text-secondary">
            Valor (R$)
            <input name="amount" inputMode="decimal" required placeholder="1.200" className={`${campo} mt-1 tabular-nums`} />
            <span className="mt-1 block text-xs font-normal text-muted">Centavos não entram.</span>
          </label>
          <label className="text-sm font-medium text-secondary">
            Descrição
            <input name="description" maxLength={200} placeholder="Opcional" className={`${campo} mt-1`} />
          </label>
          {estado.error && (
            <p role="alert" className="text-sm text-danger-ink sm:col-span-2">
              {estado.error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
            >
              {enviando ? "Lançando…" : "Lançar"}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => setAbrindo(false)}
              className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:bg-sand disabled:opacity-60"
            >
              Fechar
            </button>
          </div>
        </form>
      )}

      {expenses.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhuma despesa lançada.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {expenses.map((despesa) => (
            <LinhaDespesa key={despesa.id} despesa={despesa} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaDespesa({ despesa }: { despesa: Expense }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, acao, enviando] = useActionState(removeExpenseAction, { error: null });

  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-secondary">{EXPENSE_LABEL[despesa.category]}</p>
          <p className="truncate text-xs text-muted">
            {dataBr(despesa.spentOn)}
            {despesa.description && ` · ${despesa.description}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-semibold tabular-nums text-secondary">{formatPreco(despesa.amount)}</span>
          {!confirmando && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              aria-label={`Remover despesa de ${EXPENSE_LABEL[despesa.category]}`}
              className="rounded-[var(--radius-control)] p-1.5 text-muted hover:bg-danger-bg hover:text-danger-ink"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
      {confirmando && (
        <form action={acao} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="expenseId" value={despesa.id} />
          <span className="text-sm text-danger-ink">Remover esta despesa?</span>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-[var(--radius-control)] bg-danger px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-60"
          >
            {enviando ? "Removendo…" : "Remover"}
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => setConfirmando(false)}
            className="rounded-[var(--radius-control)] border border-line px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-sand"
          >
            Cancelar
          </button>
          {estado.error && (
            <p role="alert" className="w-full text-sm text-danger-ink">
              {estado.error}
            </p>
          )}
        </form>
      )}
    </li>
  );
}
