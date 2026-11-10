import Link from "next/link";
import Image from "next/image";
import { formatPreco } from "@/lib/format";
import type { VeiculoGestao } from "@/data/gestao-mock";

// Tom do selo de "N dias" no pátio: verde fresco, vira âmbar passando de 45d,
// vira vermelho parado (+90d). Sinal de giro, não decoração.
function tomDosDias(dias: number) {
  if (dias > 90) return "bg-danger-bg text-danger-ink";
  if (dias > 45) return "bg-warning-bg text-warning-ink";
  return "bg-success-bg text-success-ink";
}

/**
 * Card do veículo na lista do gestor. Diferente do card público (que vende):
 * aqui o foco é a saúde financeira — tabela, e ou "definir margem" ou o bloco
 * de mínimo à vista com custo e lucro. O card inteiro leva ao detalhe; a
 * definição da margem acontece lá (uma tela, uma responsabilidade).
 */
export function GestaoCarCard({ v }: { v: VeiculoGestao }) {
  const semMargem = v.statusGestao === "sem-margem";
  const meta = [v.ano, `${v.km.toLocaleString("pt-BR")} km`, v.cor]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/gestao/estoque/${v.slug}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow-soft)] transition-[border-color,box-shadow,scale] duration-200 ease-[var(--ease-brand)] hover:border-primary/40 hover:shadow-[var(--shadow-hover)] active:scale-[0.99] motion-reduce:active:scale-100"
    >
      {/* Foto + selo de dias */}
      <div className="relative aspect-[4/3] overflow-hidden bg-sand">
        <Image
          src={v.fotos[0]}
          alt={v.titulo}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 260px"
          className="object-cover transition-transform duration-[250ms] ease-[var(--ease-brand)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span
          className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${tomDosDias(
            v.diasEstoque,
          )}`}
        >
          {v.diasEstoque === 0 ? "entrou hoje" : `${v.diasEstoque} dias`}
        </span>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-secondary">
            {v.titulo}
          </h3>
          <p className="mt-1 text-xs text-muted-strong">{meta}</p>
        </div>

        <div className="flex items-end justify-between">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
            Tabela
          </span>
          <span className="text-base font-semibold tabular-nums text-secondary">
            {formatPreco(v.preco)}
          </span>
        </div>

        {/* Rodapé financeiro: pede margem, ou mostra o mínimo à vista */}
        <div className="mt-auto">
          {semMargem ? (
            <span className="flex w-full items-center justify-center rounded-[calc(var(--radius)-4px)] bg-warning-bg px-3 py-2.5 text-sm font-semibold text-warning-ink transition-colors duration-200 group-hover:bg-warning group-hover:text-white">
              Definir margem
            </span>
          ) : (
            <div className="rounded-[calc(var(--radius)-4px)] bg-success-bg p-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-success-ink/80">
                  Mínimo à vista
                </span>
                <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-success-ink">
                  −{formatPreco(v.descontoMax)}
                </span>
              </div>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-success-ink">
                {formatPreco(v.minimoAVista)}
              </p>
              <div className="mt-1.5 flex items-center justify-between border-t border-success/15 pt-1.5 text-[0.7rem] tabular-nums text-success-ink/80">
                <span>Custo {formatPreco(v.custo)}</span>
                <span className="font-semibold">Lucro {formatPreco(v.lucro)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
