"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { formatPreco } from "@/lib/format";

import { appraiseAction } from "./actions";
import { CONDITION, keepAppraisalForSale, type Appraisal, type AppraisalInput, type AppraisalState, type Condition } from "./rules";

const INITIAL: AppraisalState = { error: null };
const field =
  "mt-1 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-secondary focus:border-primary focus:outline-none";
const reais = (n: number) => formatPreco(Math.round(n));

/** The answer: how much to offer, or that the trade is not worth it. */
export function AppraisalResult({ result, input, modelSales = 0 }: { result: Appraisal | null; input: AppraisalInput; modelSales?: number }) {
  const [kept, setKept] = useState<boolean | null>(null);
  if (!result) {
    return (
      <p role="status" className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-4 text-sm text-secondary">
        <strong className="font-semibold">Não vale a troca.</strong> Com a preparação e a margem de {input.marginPct}%, não sobra valor para oferecer
        por este {input.brand} {input.model}.
      </p>
    );
  }
  return (
    <div role="status" className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-4">
      <p className="text-secondary">
        <strong className="text-xl font-semibold">Ofereça até {reais(result.offer)}</strong>; vendendo a {reais(result.salePrice)}, o lucro esperado é{" "}
        {reais(result.profit)} em cerca de {result.days} {result.days === 1 ? "dia" : "dias"}.
      </p>
      <p className="mt-2 text-xs text-muted-strong">
        Referência {reais(input.reference)}, preparação {reais(result.prep)}, custo do dinheiro parado {reais(result.moneyCost)}, margem de{" "}
        {input.marginPct}%. Prazo: {modelSales > 0 ? `média de ${modelSales} ${modelSales === 1 ? "venda" : "vendas"} deste modelo na loja` : "média da loja"}.
      </p>
      {kept === null ? (
        <button
          type="button"
          onClick={() => setKept(keepAppraisalForSale({ brand: input.brand, model: input.model, year: input.year, km: input.km, value: result.offer }))}
          className="mt-3 rounded-[var(--radius-control)] border border-line px-3 py-1.5 text-sm font-semibold text-secondary hover:border-primary"
        >
          Usar na venda
        </button>
      ) : (
        <p className="mt-3 text-sm text-secondary">
          {kept ? (
            <>
              Guardado. Ao registrar a venda em <Link href="/gestao/clientes" className="font-semibold underline">Clientes</Link> ou na página do
              carro, a troca já vem preenchida.
            </>
          ) : (
            "Não deu para guardar neste navegador. Preencha a troca na hora da venda."
          )}
        </p>
      )}
    </div>
  );
}

/** Appraise a car offered in a trade. Nothing is saved: the answer is a conversation aid. */
export function AppraisalForm() {
  const [state, formAction, pending] = useActionState(appraiseAction, INITIAL);
  const typed = state.typed ?? {};
  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm font-medium text-secondary">
      {label}
      <input name={name} defaultValue={typed[name] ?? ""} className={field} {...props} />
    </label>
  );
  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-semibold text-secondary">Avaliar um carro na troca</h2>
      <p className="mt-1 text-sm text-muted-strong">
        A conta usa o prazo e a margem das vendas da loja e a taxa do dinheiro parado. A referência é uma tabela de exemplo: se tiver a FIPE, digite.
      </p>
      <form action={formAction} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {input("brand", "Marca", { required: true, maxLength: 40 })}
          {input("model", "Modelo", { required: true, maxLength: 40 })}
          {input("year", "Ano", { required: true, inputMode: "numeric", maxLength: 4 })}
          {input("km", "Quilometragem", { required: true, inputMode: "numeric" })}
          <label className="block text-sm font-medium text-secondary">
            Estado
            <select name="condition" defaultValue={typed.condition ?? "good"} className={field}>
              {(Object.keys(CONDITION) as Condition[]).map((key) => (
                <option key={key} value={key}>{CONDITION[key].label}</option>
              ))}
            </select>
          </label>
          {input("reference", "FIPE em R$ (opcional)", { inputMode: "numeric" })}
          {input("marginPct", "Margem em % (opcional)", { inputMode: "numeric" })}
        </div>
        {state.error && <p role="alert" className="text-sm font-medium text-danger-ink">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-control)] bg-primary px-4 py-2 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Avaliando…" : "Avaliar"}
        </button>
      </form>
      {state.input && (
        <div className="mt-4">
          {/* A new answer starts with "Usar na venda" again. */}
          <AppraisalResult key={JSON.stringify(state.input)} result={state.result ?? null} input={state.input} modelSales={state.modelSales} />
        </div>
      )}
    </section>
  );
}
