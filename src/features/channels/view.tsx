"use client";

import { useActionState } from "react";

import { addChannelAction, setChannelActiveAction, setChannelCostAction, type ChannelState } from "./actions";
import type { ChannelSetting } from "./model";

const INITIAL: ChannelState = { error: null };
const campo = "rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary";
const botao =
  "rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm font-semibold text-secondary hover:bg-sand disabled:opacity-60";

function ChannelLine({ channel }: { channel: ChannelSetting }) {
  const [cost, costAction, savingCost] = useActionState(setChannelCostAction, INITIAL);
  const [active, activeAction, savingActive] = useActionState(setChannelActiveAction, INITIAL);
  const error = cost.error ?? active.error;
  return (
    <li className="flex flex-wrap items-center gap-2 py-2.5">
      <span className={`min-w-32 flex-1 text-sm font-medium ${channel.active ? "text-secondary" : "text-muted line-through"}`}>
        {channel.name}
      </span>
      <form action={costAction} className="flex items-center gap-2">
        <input type="hidden" name="id" value={channel.id} />
        <input name="amount" inputMode="numeric" defaultValue={channel.cost || ""} placeholder="R$ 0"
          aria-label={`Custo de ${channel.name} no mês`} className={`${campo} w-28 tabular-nums`} />
        <button type="submit" disabled={savingCost} className={botao}>
          {savingCost ? "Salvando…" : "Salvar"}
        </button>
      </form>
      <form action={activeAction}>
        <input type="hidden" name="id" value={channel.id} />
        <input type="hidden" name="active" value={channel.active ? "0" : "1"} />
        <button type="submit" disabled={savingActive} className={botao}>
          {channel.active ? "Desativar" : "Reativar"}
        </button>
      </form>
      {error && <p role="alert" className="w-full text-sm text-danger-ink">{error}</p>}
      {cost.saved && !error && <p role="status" className="w-full text-sm text-success-ink">Custo salvo.</p>}
    </li>
  );
}

/** The owner's channels: this month's cost of each, turning one off, adding one. */
export function ChannelsSettings({ channels, mesLabel }: { channels: ChannelSetting[]; mesLabel: string }) {
  const [state, action, pending] = useActionState(addChannelAction, INITIAL);
  return (
    <section className="max-w-xl space-y-3 rounded-[var(--radius)] border border-line bg-surface p-5">
      <h2 className="font-semibold text-secondary">Canais e custo de {mesLabel}</h2>
      <p className="text-sm text-muted-strong">
        De onde vêm os clientes e quanto cada canal custa por mês. Um canal desativado sai do cadastro de cliente e fica nos relatórios.
      </p>
      <ul className="divide-y divide-line">
        {channels.map((channel) => (
          <ChannelLine key={channel.id} channel={channel} />
        ))}
      </ul>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input name="name" required maxLength={40} placeholder="Novo canal" aria-label="Novo canal" className={`${campo} flex-1`} />
        <button type="submit" disabled={pending}
          className="rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60">
          {pending ? "Salvando…" : "Adicionar canal"}
        </button>
        {state.error && <p role="alert" className="w-full text-sm text-danger-ink">{state.error}</p>}
      </form>
    </section>
  );
}
