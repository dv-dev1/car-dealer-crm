import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { WhatsappIcon } from "@/components/WhatsappIcon";
import { whatsappLinkPara } from "@/lib/loja";

import { setTransferDoneAction } from "./actions";
import type { AfterSaleRow, FollowUp } from "./after-sale";

const brDate = (iso: string) => iso.split("-").reverse().join("/");
const card = "rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]";

function Transfer({ sale }: { sale: AfterSaleRow }) {
  const done = sale.transferDoneOn !== null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <span className={done ? "text-muted-strong" : sale.transferLate ? "font-semibold text-warning-ink" : "text-secondary"}>
        {done ? `Feita em ${brDate(sale.transferDoneOn!)}` : "Pendente"}
      </span>
      {sale.canMarkTransfer && (
        <form action={setTransferDoneAction}>
          <input type="hidden" name="saleId" value={sale.saleId} />
          <input type="hidden" name="done" value={done ? "0" : "1"} />
          <button type="submit" className="text-sm font-semibold text-primary hover:text-primary-hover">
            {done ? "Desfazer" : "Marcar transferência feita"}
          </button>
        </form>
      )}
    </div>
  );
}

/** After-sale: today's reminders with the WhatsApp message ready, and the last year's sales with warranty and transfer. */
export function AfterSaleView({ data }: { data: { today: FollowUp[]; sales: AfterSaleRow[] } }) {
  return (
    <div>
      <CabecalhoGestao eyebrow="Central de gestão" titulo="Pós-venda" apoio="Garantia, transferência e os lembretes de quem já comprou." />
      <div className="space-y-6">
        <section className={card}>
          <h2 className="text-base font-semibold text-secondary">Pós-venda de hoje</h2>
          {data.today.length === 0 ? (
            <p className="mt-2 text-sm text-muted-strong">Nada para hoje.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.today.map((f) => (
                <li key={`${f.saleId}-${f.kind}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-secondary">{f.label}</p>
                    <p className="text-sm text-muted-strong">
                      {f.customer ?? "Venda sem cliente no funil"} · {f.car}
                    </p>
                  </div>
                  {f.phone && (
                    <a
                      href={whatsappLinkPara(f.phone, f.message)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-whatsapp px-3 text-sm font-semibold text-white hover:bg-whatsapp-hover lg:min-h-0 lg:py-2"
                    >
                      <WhatsappIcon className="h-4 w-4" />
                      Enviar mensagem
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className="text-base font-semibold text-secondary">Vendas dos últimos 12 meses</h2>
          {data.sales.length === 0 ? (
            <p className="mt-2 text-sm text-muted-strong">Nenhuma venda no período.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-semibold">Venda</th>
                    <th className="py-2 pr-3 font-semibold">Cliente</th>
                    <th className="py-2 pr-3 font-semibold">Carro</th>
                    <th className="py-2 pr-3 font-semibold">Vendedor</th>
                    <th className="py-2 pr-3 font-semibold">Garantia até</th>
                    <th className="py-2 text-right font-semibold">Transferência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-secondary">
                  {data.sales.map((s) => (
                    <tr key={s.saleId}>
                      <td className="py-2 pr-3 tabular-nums">{brDate(s.soldOn)}</td>
                      <td className="py-2 pr-3">{s.customer ?? "—"}</td>
                      <td className="py-2 pr-3">{s.car}</td>
                      <td className="py-2 pr-3">{s.sellerName}</td>
                      <td className="py-2 pr-3 tabular-nums">{brDate(s.warrantyUntil)}</td>
                      <td className="py-2">
                        <Transfer sale={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
