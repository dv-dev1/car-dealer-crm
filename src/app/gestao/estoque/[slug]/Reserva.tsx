"use client";

import { useActionState, useState } from "react";
import { BookmarkCheck } from "lucide-react";
import type { Lead } from "@/features/leads/types";
import { cancelReservationAction, createReservationAction } from "@/features/stock/actions";
import type { StockVehicle } from "@/features/stock/model";
import { formatPreco } from "@/lib/format";
import { addDays } from "@/shared/today";

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
const campo = "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary";

/** The open reservation; who made it, owner and manager cancel it. */
export function AvisoReserva({ veiculo, canManage }: { veiculo: StockVehicle; canManage: boolean }) {
  const [estado, acao, enviando] = useActionState(cancelReservationAction, { error: null });
  const reserva = veiculo.reservation;
  if (!reserva) return null;

  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-secondary">
        {reserva.leadName ? `Reservado para ${reserva.leadName}` : "Reservado"} até {dataBr(reserva.expiresOn)}
      </p>
      <p className="mt-1 text-sm text-muted-strong">Sinal {formatPreco(reserva.deposit)}</p>
      {(canManage || reserva.mine) && (
        <form action={acao} className="mt-3">
          <input type="hidden" name="reservationId" value={reserva.id} />
          <button
            type="submit"
            disabled={enviando}
            className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:bg-sand disabled:opacity-60"
          >
            {enviando ? "Salvando…" : "Cancelar reserva"}
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

/** "Reservar" asks for the client (optional), the deposit and how long it holds, 3 days by default. */
export function Reservar({ veiculo, leads, today, className }: { veiculo: StockVehicle; leads: Lead[]; today: string; className: string }) {
  const [abrindo, setAbrindo] = useState(false);
  const [estado, acao, enviando] = useActionState(createReservationAction, { error: null });

  if (!abrindo) {
    return (
      <button type="button" onClick={() => setAbrindo(true)} className={className}>
        <BookmarkCheck size={16} />
        Reservar
      </button>
    );
  }

  return (
    <form action={acao} className="space-y-3 rounded-[var(--radius)] border border-line bg-surface p-4 sm:col-span-2">
      <input type="hidden" name="vehicleId" value={veiculo.id} />
      <p className="text-sm font-semibold text-secondary">Reservar com sinal</p>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <label className="text-sm font-medium text-secondary">
          Cliente
          <select name="leadId" defaultValue="" className={`${campo} mt-1`}>
            <option value="">Sem cliente no funil</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-secondary">
          Sinal (R$)
          <input name="deposit" inputMode="numeric" placeholder="R$ 0" className={`${campo} mt-1`} />
        </label>
        <label className="text-sm font-medium text-secondary">
          Vale até
          <input type="date" name="expiresOn" defaultValue={addDays(today, 3)} min={today} max={addDays(today, 30)} className={`${campo} mt-1`} />
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
          {enviando ? "Salvando…" : "Reservar"}
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
