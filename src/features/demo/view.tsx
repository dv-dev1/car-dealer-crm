"use client";

import { useActionState, useState } from "react";

import type { Role } from "@/shared/db/client";

import { restoreDemoAction, viewAsAction, type DemoState } from "./actions";
import type { DemoPanel } from "./model";

export type Viewing = { membershipId: string; name: string; role: Role };
export type DemoPanelProps = DemoPanel & { today: string; selfId: string; viewing: Viewing | null };

const ROLE_LABEL: Record<Role, string> = { owner: "Dono", manager: "Gerente", seller: "Vendedor" };
const INITIAL: DemoState = { error: null, done: false };

const field = "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary";
const primary =
  "rounded-[var(--radius-control)] bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary disabled:opacity-60";
const secondary =
  "rounded-[var(--radius-control)] border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-secondary hover:bg-sand disabled:opacity-60";

/** "Restaurada há N dias", counted in store days (both dates are YYYY-MM-DD). */
export function restoredLabel(restoredOn: string | null, today: string): string {
  if (!restoredOn) return "Ainda não restaurada";
  const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(restoredOn)) / 86_400_000));
  if (days === 0) return "Restaurada hoje";
  return days === 1 ? "Restaurada há 1 dia" : `Restaurada há ${days} dias`;
}

function RestoreDemo({ restoredOn, today }: { restoredOn: string | null; today: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(async (prev: DemoState, form: FormData) => {
    const next = await restoreDemoAction(prev, form);
    if (next.done) setConfirming(false);
    return next;
  }, INITIAL);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-strong">{restoredLabel(restoredOn, today)}</p>
      {confirming ? (
        <form action={formAction} className="space-y-2">
          <p className="text-sm text-secondary">Apaga tudo o que foi feito na demo e gera os dados de novo.</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={primary}>
              {pending ? "Restaurando…" : "Restaurar agora"}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={secondary}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={secondary}>
          Restaurar demo
        </button>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger-ink">
          {state.error}
        </p>
      )}
      {state.done && !confirming && (
        <p role="status" className="text-sm text-secondary">
          Demo restaurada.
        </p>
      )}
    </div>
  );
}

/** Sidebar block for the owner of a demo store: "Ver como" and "Restaurar demo". */
export function DemoControls({ demo }: { demo: DemoPanelProps }) {
  const others = demo.team.filter((member) => member.membershipId !== demo.selfId);

  return (
    <section aria-label="Demonstração" className="space-y-3 border-t border-line px-1.5 pt-4 pb-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-strong">Demonstração</h2>
      <form action={viewAsAction} className="space-y-1">
        <label htmlFor="demo-view-as" className="block text-sm text-secondary">
          Ver como
        </label>
        {/* The key remounts the select when the viewed member changes on the server. */}
        <select
          key={demo.viewing?.membershipId ?? "owner"}
          id="demo-view-as"
          name="membershipId"
          defaultValue={demo.viewing?.membershipId ?? ""}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className={field}
        >
          <option value="">Dono (você)</option>
          {others.map((member) => (
            <option key={member.membershipId} value={member.membershipId}>
              {`${ROLE_LABEL[member.role]}: ${member.name}`}
            </option>
          ))}
        </select>
      </form>
      <RestoreDemo restoredOn={demo.restoredOn} today={demo.today} />
    </section>
  );
}

/** Strip above the content while the owner sees the panel as someone else. */
export function ViewingBanner({ viewing }: { viewing: Viewing }) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-secondary"
    >
      <p>{`Você está vendo o painel como ${viewing.name} (${ROLE_LABEL[viewing.role].toLowerCase()}).`}</p>
      <form action={viewAsAction}>
        <input type="hidden" name="membershipId" value="" />
        <button type="submit" className={secondary}>
          Voltar para dono
        </button>
      </form>
    </div>
  );
}
