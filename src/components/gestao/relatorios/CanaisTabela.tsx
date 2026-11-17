import type { ChannelRow } from "@/features/channels/model";
import { formatPreco } from "@/lib/format";

const dinheiro = (valor: number | null) => (valor === null ? "—" : formatPreco(valor));
const pct = (valor: number | null) => (valor === null ? "—" : `${Math.round(valor * 100)}%`);

/** O que cada canal trouxe e custou no período. Só dono e gerente recebem estes números. */
export function CanaisTabela({ canais }: { canais: ChannelRow[] }) {
  return (
    <section className="mt-8 rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-semibold text-secondary">Canais</h2>
      <p className="mt-1 text-xs text-muted-strong">De onde vieram os clientes do período, quanto custaram e quanto renderam.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-semibold">Canal</th>
              <th className="py-2 pr-3 text-right font-semibold">Clientes</th>
              <th className="py-2 pr-3 text-right font-semibold">Vendas</th>
              <th className="py-2 pr-3 text-right font-semibold">Conversão</th>
              <th className="py-2 pr-3 text-right font-semibold">Custo</th>
              <th className="py-2 pr-3 text-right font-semibold">Por cliente</th>
              <th className="py-2 pr-3 text-right font-semibold">Por venda</th>
              <th className="py-2 text-right font-semibold">Lucro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums text-secondary">
            {canais.map((c) => (
              <tr key={c.id}>
                <th scope="row" className="py-2 pr-3 text-left font-medium">{c.name}</th>
                {c.leads === 0 && c.sales === 0 && c.cost === 0 ? (
                  <td colSpan={7} className="py-2 text-right text-muted">—</td>
                ) : (
                  <>
                    <td className="py-2 pr-3 text-right">{c.leads}</td>
                    <td className="py-2 pr-3 text-right">{c.sales}</td>
                    <td className="py-2 pr-3 text-right">{pct(c.conversion)}</td>
                    <td className="py-2 pr-3 text-right">{formatPreco(c.cost)}</td>
                    <td className="py-2 pr-3 text-right">{dinheiro(c.costPerLead)}</td>
                    <td className="py-2 pr-3 text-right">{dinheiro(c.costPerSale)}</td>
                    <td className="py-2 text-right font-semibold">{formatPreco(c.profit)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
