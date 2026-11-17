import Link from "next/link";
import { TrendingDown } from "lucide-react";

import type { StockVehicle } from "@/features/stock/model";
import { MIN_MARGIN, priceSuggestion } from "@/features/stock/rules";
import { formatPreco } from "@/lib/format";

/** For a car parked 60 days or more: what waiting costs and the price that gives it up now. Owner and manager only. */
export function SugestaoPreco({ veiculo }: { veiculo: StockVehicle }) {
  const s = priceSuggestion(veiculo);
  if (!s || !veiculo.money) return null;
  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h2 className="flex items-center gap-2 text-base font-semibold text-secondary">
        <TrendingDown size={18} strokeWidth={1.8} className="shrink-0 text-warning-ink" />
        Parado há {veiculo.daysInStock} dias
      </h2>
      <p className="mt-2 text-sm text-secondary">
        Esperar mais 30 dias custa {formatPreco(s.waitCost)}: {formatPreco(s.moneyCost)} do dinheiro parado e {formatPreco(s.depreciation)} que o
        carro perde de preço.
      </p>
      {s.suggested === null ? (
        <p className="mt-2 text-sm text-secondary">
          <strong className="font-semibold">O preço já está no limite.</strong> O piso deste carro é {formatPreco(s.floor)}: o custo com despesas
          mais {MIN_MARGIN * 100}%, ou o mínimo à vista.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-secondary">
            <strong className="font-semibold">Baixar para {formatPreco(s.suggested)}</strong> ainda deixa{" "}
            {formatPreco(s.suggested - veiculo.money.cost)} de lucro. O piso é {formatPreco(s.floor)}.
          </p>
          <Link
            href={`/gestao/estoque/${veiculo.slug}/editar`}
            className="mt-3 inline-flex rounded-[var(--radius-control)] border border-line px-3 py-1.5 text-sm font-semibold text-secondary hover:border-primary"
          >
            Mudar o preço
          </Link>
        </>
      )}
    </section>
  );
}
