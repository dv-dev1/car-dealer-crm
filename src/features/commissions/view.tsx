"use client";

import { useActionState } from "react";

import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { formatPreco } from "@/lib/format";

import { removeRuleAction, setRuleAction, type RuleState } from "./actions";
import type { CommissionKind, CommissionRule, Commissions } from "./model";

const INITIAL: RuleState = { error: null };
const KIND_LABEL: Record<CommissionKind, string> = {
  fixed: "Valor fixo por carro",
  sale_pct: "% do valor da venda",
  profit_pct: "% do lucro",
};
const campo = "rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary";
const cartao = "rounded-[var(--radius)] border border-line bg-surface p-5";
const pct = (value: number) => `${String(value).replace(".", ",")}%`;
const ruleText = ({ kind, value }: CommissionRule) =>
  kind === "fixed" ? `${formatPreco(value)} por carro` : `${pct(value)} ${kind === "sale_pct" ? "do valor da venda" : "do lucro"}`;
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** One rule's form: the store's (memberId null) or a seller's exception. */
function RuleForm({ rule, sellers }: { rule?: CommissionRule; sellers?: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(setRuleAction, INITIAL);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {sellers ? (
        <select name="memberId" required defaultValue="" className={campo} aria-label="Vendedor">
          <option value="" disabled>
            Vendedor
          </option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ) : (
        <input type="hidden" name="memberId" value={rule?.memberId ?? ""} />
      )}
      <select name="kind" defaultValue={rule?.kind ?? "fixed"} className={campo} aria-label="Tipo">
        {Object.entries(KIND_LABEL).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </select>
      <input name="value" inputMode="decimal" required defaultValue={rule ? String(rule.value).replace(".", ",") : ""}
        placeholder="350 ou 10" aria-label="Valor" className={`${campo} w-28`} />
      <button type="submit" disabled={pending}
        className="rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60">
        {pending ? "Salvando…" : "Salvar regra"}
      </button>
      {state.error && <p role="alert" className="w-full text-sm text-danger-ink">{state.error}</p>}
      {state.saved && !state.error && <p role="status" className="w-full text-sm text-success-ink">Regra salva.</p>}
    </form>
  );
}

function RemoveException({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(removeRuleAction, INITIAL);
  return (
    <form action={action}>
      <input type="hidden" name="memberId" value={memberId} />
      <button type="submit" disabled={pending} className="text-sm font-medium text-danger-ink hover:underline disabled:opacity-60">
        Tirar exceção
      </button>
      {state.error && <p role="alert" className="text-sm text-danger-ink">{state.error}</p>}
    </form>
  );
}

/**
 * Commissions of the period. The owner sees every seller and sets the rules; the manager sees every seller and
 * the rules; a seller sees only their own commissions, never a rule.
 */
export function CommissionsView({
  role,
  data,
  rules,
  sellers,
  rotulo,
}: {
  role: "owner" | "manager" | "seller";
  data: Commissions;
  rules: CommissionRule[] | null;
  sellers: { id: string; name: string }[];
  rotulo: string;
}) {
  const own = role === "seller";
  const storeRule = rules?.find((r) => r.memberId === null);
  const exceptions = rules?.filter((r) => r.memberId !== null) ?? [];
  const nameOf = (id: string | null) => sellers.find((s) => s.id === id)?.name ?? "Ex-membro";
  const total = data.bySeller.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-6">
      <CabecalhoGestao eyebrow="Central de gestão" titulo="Comissões" apoio={rotulo} />

      <section className={cartao}>
        <h2 className="font-semibold text-secondary">{own ? "Suas comissões" : "Por vendedor"}</h2>
        {data.bySeller.length === 0 ? (
          <p className="mt-2 text-sm text-muted-strong">Nenhuma venda no período.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {data.bySeller.map((s) => (
              <li key={s.sellerName} className="flex justify-between gap-3 py-2 text-sm">
                <span className="text-secondary">
                  {s.sellerName} · {s.sales} {s.sales === 1 ? "venda" : "vendas"}
                </span>
                <span className="font-semibold tabular-nums text-secondary">{formatPreco(s.total)}</span>
              </li>
            ))}
            {!own && data.bySeller.length > 1 && (
              <li className="flex justify-between gap-3 py-2 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatPreco(total)}</span>
              </li>
            )}
          </ul>
        )}
      </section>

      {data.sales.length > 0 && (
        <section className={cartao}>
          <h2 className="font-semibold text-secondary">Vendas</h2>
          <ul className="mt-3 divide-y divide-line">
            {data.sales.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-x-3 py-2 text-sm">
                <span className="text-secondary">
                  {dataBr(s.soldOn)} · {s.model}
                  {!own && ` · ${s.sellerName}`}
                </span>
                <span className="tabular-nums text-muted-strong">
                  {formatPreco(s.price)} → <span className="font-semibold text-secondary">{formatPreco(s.commission)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rules && (
        <section className={`${cartao} space-y-4`}>
          <div>
            <h2 className="font-semibold text-secondary">Regra da loja</h2>
            <p className="mt-1 text-sm text-muted-strong">{storeRule ? ruleText(storeRule) : "Sem regra: a comissão fica em R$ 0."}</p>
            {role === "owner" && <div className="mt-3"><RuleForm rule={storeRule ?? { memberId: null, kind: "fixed", value: 0 }} /></div>}
          </div>
          <div>
            <h3 className="font-semibold text-secondary">Exceções</h3>
            {exceptions.length === 0 && <p className="mt-1 text-sm text-muted-strong">Todos seguem a regra da loja.</p>}
            <ul className="mt-2 space-y-2">
              {exceptions.map((r) => (
                <li key={r.memberId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-secondary">
                    {nameOf(r.memberId)}: {ruleText(r)}
                  </span>
                  {role === "owner" && <RemoveException memberId={r.memberId!} />}
                </li>
              ))}
            </ul>
            {role === "owner" && <div className="mt-3"><RuleForm sellers={sellers} /></div>}
          </div>
        </section>
      )}
    </div>
  );
}
