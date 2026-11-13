import Link from "next/link";
import Image from "next/image";
import { PiggyBank, Timer, ArrowRight } from "lucide-react";
import { formatPreco } from "@/lib/format";
import { nivelGiro, type VeiculoGestao } from "@/data/gestao-mock";
import { NumeroAnimado } from "@/components/gestao/motion/NumeroAnimado";
import { AoEntrar } from "@/components/gestao/motion/AoEntrar";

interface ResumoLoja {
  total: number;
  investido: number;
  valeNaVenda: number;
  lucroEsperado: number;
  semMargem: number;
}

const SELO: Record<"ok" | "atencao" | "parado", string> = {
  ok: "bg-sand text-muted-strong",
  atencao: "bg-warning-bg text-warning-ink",
  parado: "bg-danger-bg text-danger-ink",
};

export function LojaAgora({
  resumo,
  giro,
  pedemAtencao,
}: {
  resumo: ResumoLoja;
  giro: VeiculoGestao[];
  pedemAtencao: number;
}) {
  return (
    <section aria-labelledby="loja-agora">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5">
        <h2 id="loja-agora" className="text-lg font-semibold text-secondary">
          Sua loja agora
        </h2>
        <span className="text-xs text-muted-strong">foto do momento · não muda com o período</span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* ── Investido no estoque ── */}
        <AoEntrar ordem={0} className="flex">
        <div className="flex w-full flex-col rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-strong">Investido no estoque</p>
              <p data-kpi className="mt-1.5 text-[2rem] font-semibold leading-none text-secondary">
                <NumeroAnimado valor={resumo.investido} formato="preco" />
              </p>
              <p className="mt-2 text-xs text-muted-strong">
                custo de aquisição dos {resumo.total} carros no pátio
              </p>
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sand text-secondary/55">
              <PiggyBank size={22} strokeWidth={1.7} />
            </span>
          </div>

          {/* mt-auto no desktop: o card vizinho (giro) é mais alto, e sem isso
              sobrava um vão morto embaixo deste. Encosta o rodapé na base. */}
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 lg:mt-auto">
            <div>
              <p className="text-xs font-medium text-muted-strong">Vale na venda</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-secondary">
                {formatPreco(resumo.valeNaVenda)}
              </p>
              <p className="mt-0.5 text-[0.7rem] text-muted-strong">preço de tabela do pátio</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-strong">Lucro esperado</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-success-ink">
                {formatPreco(resumo.lucroEsperado)}
              </p>
              <p className="mt-0.5 text-[0.7rem] text-muted-strong">se vender na margem atual</p>
            </div>
          </div>
        </div>
        </AoEntrar>

        {/* ── Giro de estoque ── */}
        <AoEntrar ordem={1} className="flex">
        <div className="flex w-full flex-col rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-strong">Giro de estoque</p>
              <p className="mt-1 text-sm text-secondary">
                {pedemAtencao === 0
                  ? "Estoque girando bem — nada parado demais."
                  : pedemAtencao === 1
                    ? "1 carro segurando o dinheiro há tempo demais."
                    : `${pedemAtencao} carros segurando o dinheiro há tempo demais.`}
              </p>
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sand text-secondary/55">
              <Timer size={22} strokeWidth={1.7} />
            </span>
          </div>

          <ul className="mt-4 flex flex-1 flex-col gap-1">
            {giro.map((v) => {
              const nivel = nivelGiro(v.diasEstoque);
              return (
                <li key={v.id}>
                  <Link
                    href={`/gestao/estoque/${v.slug}`}
                    className="group -mx-2 flex items-center gap-3 rounded-[calc(var(--radius)-4px)] px-2 py-2 transition-colors duration-200 hover:bg-sand/50"
                  >
                    <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-[calc(var(--radius)-6px)] bg-sand">
                      <Image
                        src={v.fotos[0]}
                        alt={v.titulo}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-secondary">
                        {v.marca} {v.modelo}
                      </p>
                      <p className="text-[0.7rem] text-muted-strong">
                        {formatPreco(v.custo)} parados aqui
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-semibold tabular-nums ${SELO[nivel]}`}
                    >
                      {v.diasEstoque === 0 ? "hoje" : `${v.diasEstoque} dias`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link
            href="/gestao/estoque"
            className="mt-3 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary transition-opacity duration-200 hover:opacity-80"
          >
            Ver estoque por tempo de pátio
            <ArrowRight size={15} strokeWidth={2.25} />
          </Link>
        </div>
        </AoEntrar>
      </div>
    </section>
  );
}
