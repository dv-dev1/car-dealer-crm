import type { ResponseTime } from "@/features/leads/contacts";

const tempo = (min: number | null) =>
  min === null ? "—" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;

/** Quanto cada vendedor demora a dar a primeira resposta aos clientes que entraram no período. */
export function TempoResposta({ rows, own }: { rows: ResponseTime[]; own: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8 rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-semibold text-secondary">{own ? "Seu tempo de primeira resposta" : "Tempo de primeira resposta"}</h2>
      <p className="mt-1 text-xs text-muted-strong">
        Do cadastro do cliente até o primeiro WhatsApp, ligação ou "falei com o cliente", nos clientes que entraram no período.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-semibold">Vendedor</th>
              <th className="py-2 pr-3 text-right font-semibold">Clientes</th>
              <th className="py-2 pr-3 text-right font-semibold">Respondidos</th>
              <th className="py-2 text-right font-semibold">Tempo médio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums text-secondary">
            {rows.map((r) => (
              <tr key={r.sellerName}>
                <th scope="row" className="py-2 pr-3 text-left font-medium">{r.sellerName}</th>
                <td className="py-2 pr-3 text-right">{r.leads}</td>
                <td className="py-2 pr-3 text-right">{r.answered}</td>
                <td className="py-2 text-right font-semibold">{tempo(r.avgMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
