import { funilConversao } from "@/lib/relatorios";

// Cores das etapas ecoam as colunas do funil em Clientes — mesma jornada, mesma
// leitura de cor (ardósia → caramelo → âmbar → verde-fechado).
const CORES = ["#5E7186", "var(--primary)", "#B7791F", "var(--success)"];

function pct(fracao: number, casas = 0): string {
  return `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
}

/**
 * Funil de conversão do mês: quantos leads viram visita, negociação e venda.
 * Barra por etapa (largura = fatia dos leads do topo) + taxa de passagem entre
 * etapas. Fecha com a conversão geral — o número que o gestor persegue.
 */
export function FunilConversao() {
  const { etapas, conversaoGeral } = funilConversao();
  const topo = etapas[0]?.valor || 1;

  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-secondary">Funil de conversão</h2>
          <p className="mt-0.5 text-sm text-muted-strong">Do lead à venda, no mês.</p>
        </div>
        <p className="text-sm text-muted-strong">
          Conversão geral{" "}
          <span className="font-semibold tabular-nums text-primary">{pct(conversaoGeral, 1)}</span>
        </p>
      </div>

      <ol className="mt-5 space-y-3">
        {etapas.map((e, i) => (
          <li key={e.nome}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-secondary">{e.nome}</span>
              <span className="tabular-nums text-muted-strong">
                <span className="font-semibold text-secondary">{e.valor}</span>
                {i > 0 && (
                  <span className="ml-2 text-xs">
                    {pct(e.taxa)} da etapa anterior
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-brand)]"
                style={{ width: `${(e.valor / topo) * 100}%`, backgroundColor: CORES[i] }}
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
