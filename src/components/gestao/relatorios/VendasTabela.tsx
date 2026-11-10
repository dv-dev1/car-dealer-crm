import { Car } from "lucide-react";
import { formatPreco } from "@/lib/format";
import { vendasMock, type Janela } from "@/data/vendas-mock";

function dataBonita(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Registro de vendas do período — o histórico que antes vivia na aba
 * "Compradores", agora dentro dos Relatórios e alimentado pela fonte completa
 * (todas as vendas, não só os leads marcados). Lista, não tabela: encolhe bem no
 * celular sem rolagem lateral.
 */
export function VendasTabela({ janela, rotulo }: { janela: Janela; rotulo: string }) {
  const vendas = vendasMock
    .filter((v) => v.dataVenda >= janela.de && v.dataVenda <= janela.ate)
    .sort((a, b) => b.dataVenda.localeCompare(a.dataVenda));

  const total = vendas.reduce((s, v) => s + v.valor, 0);

  return (
    <section className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-secondary">Vendas de {rotulo}</h2>
          <p className="text-xs text-muted-strong">
            {vendas.length} {vendas.length === 1 ? "venda" : "vendas"} no período
          </p>
        </div>
        {vendas.length > 0 && (
          <p className="text-sm text-muted">
            Total{" "}
            <span className="font-semibold tabular-nums text-success-ink">{formatPreco(total)}</span>
          </p>
        )}
      </div>

      {vendas.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-muted">
          Nenhuma venda registrada nesse período.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {vendas.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-secondary">{v.clienteNome}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <Car size={13} strokeWidth={1.8} className="shrink-0" />
                  <span className="truncate">{v.modelo}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-secondary">
                  {formatPreco(v.valor)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {v.formaPagamento} · {dataBonita(v.dataVenda)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
