import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { formatPreco } from "@/lib/format";

import type { BuyingReport } from "./model";
import type { BuyingRow } from "./rules";

const VERDICT = {
  buy: { label: "Comprar mais", tone: "text-success-ink" },
  avoid: { label: "Evitar", tone: "text-danger-ink" },
} as const;
const dias = (n: number) => `${Math.round(n)} ${Math.round(n) === 1 ? "dia" : "dias"}`;

function Tabela({ titulo, rows }: { titulo: string; rows: BuyingRow[] }) {
  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-semibold text-secondary">{titulo}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-semibold">{titulo === "Por modelo" ? "Modelo" : "Faixa"}</th>
              <th className="py-2 pr-3 text-right font-semibold">Vendidos</th>
              <th className="py-2 pr-3 text-right font-semibold">Para vender</th>
              <th className="py-2 pr-3 text-right font-semibold">Lucro médio</th>
              <th className="py-2 pr-3 text-right font-semibold">Lucro por dia</th>
              <th className="py-2 text-right font-semibold">O que fazer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums text-secondary">
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="py-2 pr-3 text-left font-medium">{r.label}</th>
                <td className="py-2 pr-3 text-right">{r.sold}</td>
                <td className="py-2 pr-3 text-right">{dias(r.avgDays)}</td>
                <td className="py-2 pr-3 text-right">{formatPreco(Math.round(r.avgProfit))}</td>
                <td className="py-2 pr-3 text-right">{formatPreco(Math.round(r.profitPerDay))}</td>
                <td className={`py-2 text-right font-semibold ${r.verdict ? VERDICT[r.verdict].tone : "text-muted"}`}>
                  {r.verdict ? VERDICT[r.verdict].label : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** What the store's own sales say to buy more of and to avoid. Owner and manager only. */
export function BuyingView({ report, children }: { report: BuyingReport; children?: React.ReactNode }) {
  return (
    <div>
      <CabecalhoGestao eyebrow="Central de gestão" titulo="Compras" apoio="O que as vendas da loja dizem sobre o que comprar." />
      <div className="space-y-6">
        {children}
        {report.store === null ? (
          <p className="rounded-[var(--radius)] border border-line bg-surface p-5 text-sm text-muted-strong">
            Sem vendas ainda. O relatório aparece depois da primeira venda.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-strong">
              Últimos 12 meses: {report.store.sold} vendidos, {dias(report.store.avgDays)} em média para vender,{" "}
              {formatPreco(Math.round(report.store.avgProfit))} de lucro médio e {formatPreco(Math.round(report.store.profitPerDay))} de lucro
              por dia de pátio. "Comprar mais" rende pelo menos 25% acima disso por dia; "Evitar" dá prejuízo ou rende menos de 60%.
              Com uma venda só, ainda não há o que dizer.
            </p>
            <Tabela titulo="Por modelo" rows={report.byModel} />
            <Tabela titulo="Por faixa de preço" rows={report.byBand} />
          </>
        )}
      </div>
    </div>
  );
}
