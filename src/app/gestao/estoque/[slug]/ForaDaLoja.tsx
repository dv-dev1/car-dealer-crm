"use client";

import { useActionState, useState } from "react";
import { LogOut, Undo2 } from "lucide-react";
import { returnToStoreAction, setAwayAction } from "@/features/stock/actions";
import type { StockVehicle } from "@/features/stock/model";
import { AWAY_LABEL } from "@/features/stock/rules";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const campo = "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary";

/** Where an away car is and when it should be back; owner and manager bring it back. */
export function AvisoForaDaLoja({ veiculo, today, canManage }: { veiculo: StockVehicle; today: string; canManage: boolean }) {
  const [estado, acao, enviando] = useActionState(returnToStoreAction, { error: null });
  if (!veiculo.away) return null;
  const { reason, until } = veiculo.away;
  const atrasado = until !== null && until < today;

  return (
    <div className="rounded-[var(--radius)] border border-warning/30 bg-warning-bg p-4">
      <p className="text-sm font-semibold text-warning-ink">Fora da loja · {AWAY_LABEL[reason]}</p>
      {until && (
        <p className="mt-1 text-sm text-warning-ink/85">
          {atrasado ? `Volta prevista passou (${dataBr(until)}).` : `Volta prevista: ${dataBr(until)}.`}
        </p>
      )}
      {canManage && (
        <form action={acao} className="mt-3">
          <input type="hidden" name="vehicleId" value={veiculo.id} />
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            <Undo2 size={15} />
            {enviando ? "Salvando…" : "Voltou para a loja"}
          </button>
          {estado.error && (
            <p role="alert" className="mt-2 text-sm text-danger-ink">
              {estado.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/** "Tirar da loja" asks for the reason and the expected return on the page itself. */
export function TirarDaLoja({ veiculo, today, className }: { veiculo: StockVehicle; today: string; className: string }) {
  const [abrindo, setAbrindo] = useState(false);
  const [estado, acao, enviando] = useActionState(setAwayAction, { error: null });

  if (!abrindo) {
    return (
      <button type="button" onClick={() => setAbrindo(true)} className={className}>
        <LogOut size={16} />
        Tirar da loja
      </button>
    );
  }

  return (
    <form action={acao} className="space-y-3 rounded-[var(--radius)] border border-line bg-surface p-4 sm:col-span-2">
      <input type="hidden" name="vehicleId" value={veiculo.id} />
      <p className="text-sm font-semibold text-secondary">Tirar da loja por um tempo</p>
      <p className="text-sm text-muted-strong">O carro continua no estoque, no dinheiro investido e nos dias de pátio.</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="text-sm font-medium text-secondary">
          Motivo
          <select name="reason" defaultValue="service" className={`${campo} mt-1`}>
            {Object.entries(AWAY_LABEL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-secondary">
          Volta prevista
          <input type="date" name="until" min={today} className={`${campo} mt-1`} />
          <span className="mt-1 block text-xs font-normal text-muted">Opcional.</span>
        </label>
      </div>
      {estado.error && (
        <p role="alert" className="text-sm text-danger-ink">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-[var(--radius-control)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {enviando ? "Salvando…" : "Tirar da loja"}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => setAbrindo(false)}
          className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:bg-sand disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
