import Link from "next/link";
import type { MonthBreakEven } from "@/features/store/expenses";
import { formatPreco } from "@/lib/format";

/** Só para o dono: quantos carros faltam para o lucro do mês cobrir as despesas fixas e os canais. */
export function AvisoMes({ mes }: { mes: MonthBreakEven | null }) {
  if (!mes) return null;
  if (mes.fixed + mes.channels === 0) {
    return (
      <Link
        href="/gestao/loja"
        className="block rounded-[var(--radius)] border border-line bg-surface px-4 py-3 text-sm font-semibold text-secondary shadow-[var(--shadow-soft)] hover:bg-sand sm:px-5"
      >
        Lance as despesas fixas do mês para saber quantos carros faltam para pagá-lo
      </Link>
    );
  }
  if (mes.carsLeft === null) return null;
  const pago = mes.carsLeft === 0;
  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-soft)] sm:px-5">
      <p className="text-sm font-semibold text-secondary">
        {pago
          ? "O mês já está pago"
          : `${mes.carsLeft === 1 ? "Falta 1 carro" : `Faltam ${mes.carsLeft} carros`} para pagar o mês`}
      </p>
      <p className="mt-1 text-xs text-muted-strong">
        Despesas fixas {formatPreco(mes.fixed)} + canais {formatPreco(mes.channels)}; lucro do mês até aqui {formatPreco(mes.profit)}.
        {!pago && ` Conta com ${formatPreco(mes.avgProfitPerCar!)} de lucro por carro, a média dos últimos três meses.`}{" "}
        <Link href="/gestao/loja" className="font-medium text-primary hover:underline">
          Ver despesas
        </Link>
      </p>
    </section>
  );
}
