import Link from "next/link";
import Image from "next/image";
import { formatPreco } from "@/lib/format";
import type { StockVehicle } from "@/features/stock/model";
import { STATUS_LABEL, staleLevel } from "@/features/stock/rules";

// Tom do selo de "N dias" no pátio: verde fresco, âmbar a partir de 60 dias,
// vermelho parado (+90d). Sinal de giro, não decoração.
const TOM_DOS_DIAS = {
  ok: "bg-success-bg text-success-ink",
  attention: "bg-warning-bg text-warning-ink",
  stale: "bg-danger-bg text-danger-ink",
} as const;

export function diasNoPatio(dias: number) {
  return dias === 0 ? "entrou hoje" : `${dias} dias`;
}

/** Primeira foto do carro, ou um bloco neutro quando ainda não tem foto. */
export function CarThumb({ v, sizes, className = "" }: { v: StockVehicle; sizes: string; className?: string }) {
  const foto = v.photos[0];
  if (!foto) {
    return (
      <span className="absolute inset-0 grid place-items-center bg-sand text-xs font-medium text-muted">
        Sem foto
      </span>
    );
  }
  return <Image src={foto.url} alt={v.title} fill sizes={sizes} className={`object-cover ${className}`} />;
}

/**
 * Card do veículo na lista do gestor. Diferente do card público (que vende):
 * aqui o foco é a saúde financeira — tabela, e ou "definir margem" ou o bloco
 * de mínimo à vista, com custo e lucro só para dono e gerente. O card inteiro
 * leva ao detalhe; a definição da margem acontece lá.
 */
export function GestaoCarCard({ v, canManage }: { v: StockVehicle; canManage: boolean }) {
  const semMargem = v.minCashPrice === null;
  const meta = [v.modelYear, `${v.km.toLocaleString("pt-BR")} km`, v.color].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/gestao/estoque/${v.slug}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow-soft)] transition-[border-color,box-shadow,scale] duration-200 ease-[var(--ease-brand)] hover:border-primary/40 hover:shadow-[var(--shadow-hover)] active:scale-[0.99] motion-reduce:active:scale-100"
    >
      {/* Foto + selo de dias */}
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        <CarThumb
          v={v}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 260px"
          className="transition-transform duration-[250ms] ease-[var(--ease-brand)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span
          className={`absolute left-2.5 top-2.5 rounded-[var(--radius-control)] px-2.5 py-1 text-[0.7rem] font-semibold ${
            TOM_DOS_DIAS[staleLevel(v.daysInStock)]
          }`}
        >
          {diasNoPatio(v.daysInStock)}
        </span>
        {v.status !== "available" && (
          <span className="absolute right-2.5 top-2.5 rounded-[var(--radius-control)] bg-surface px-2.5 py-1 text-[0.7rem] font-semibold text-secondary">
            {STATUS_LABEL[v.status]}
          </span>
        )}
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-secondary">{v.title}</h3>
          <p className="mt-1 text-xs text-muted-strong">{meta}</p>
        </div>

        <div className="flex items-end justify-between">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">Tabela</span>
          <span className="text-base font-semibold tabular-nums text-secondary">{formatPreco(v.price)}</span>
        </div>

        {/* Rodapé financeiro: pede margem, ou mostra o mínimo à vista */}
        <div className="mt-auto">
          {semMargem ? (
            <span className="flex w-full items-center justify-center rounded-[var(--radius-control)] bg-warning-bg px-3 py-2.5 text-sm font-semibold text-warning-ink transition-colors duration-200 group-hover:bg-warning group-hover:text-on-primary">
              {canManage ? "Definir margem" : "Sem desconto liberado"}
            </span>
          ) : (
            <div className="rounded-[calc(var(--radius)-4px)] bg-success-bg p-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-success-ink/80">
                  Mínimo à vista
                </span>
                <span className="rounded-[var(--radius-control)] bg-success/12 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-success-ink">
                  −{formatPreco(v.price - v.minCashPrice!)}
                </span>
              </div>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-success-ink">{formatPreco(v.minCashPrice!)}</p>
              {v.money && (
                <div className="mt-1.5 flex items-center justify-between border-t border-success/15 pt-1.5 text-[0.7rem] tabular-nums text-success-ink/80">
                  <span>Custo {formatPreco(v.money.cost)}</span>
                  <span className="font-semibold">Lucro {formatPreco(v.money.profit)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
