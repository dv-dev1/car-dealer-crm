import type { ResumoVendas } from "@/data/vendas-mock";
import { Sparkline } from "@/components/gestao/painel/Sparkline";
import {
  NumeroAnimado,
  type FormatoNumero,
} from "@/components/gestao/motion/NumeroAnimado";

/**
 * Banda de KPIs do período. Cinco números que respondem ao seletor de período:
 * três com curva (faturamento, lucro, vendas) e dois estáticos (margem, ticket).
 * Mesma linguagem dos cards do Painel — só mais denso, porque aqui é a tela de
 * relatório de fato.
 */
export function KpiGrid({ resumo }: { resumo: ResumoVendas }) {
  const semVendas = resumo.vendas === 0;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Tile
        label="Faturamento"
        valor={resumo.faturamento}
        formato="preco"
        cor="var(--primary)"
        serie={resumo.serie.faturamento}
      />
      <Tile
        label="Lucro"
        valor={resumo.lucro}
        formato="preco"
        cor="var(--success)"
        serie={resumo.serie.lucro}
        acento="success"
      />
      <Tile
        label="Vendas"
        valor={resumo.vendas}
        formato="inteiro"
        cor="var(--secondary)"
        serie={resumo.serie.vendas}
      />
      <Tile
        label="Margem"
        valor={semVendas ? null : resumo.margem * 100}
        formato="decimal1"
        sufixo="%"
        nota="lucro sobre o faturamento"
      />
      <Tile
        label="Ticket médio"
        valor={semVendas ? null : resumo.ticketMedio}
        formato="preco"
        nota="por carro vendido"
      />
    </div>
  );
}

function Tile({
  label,
  valor,
  formato,
  sufixo,
  cor,
  serie,
  acento,
  nota,
}: {
  label: string;
  /** `null` = sem dado no período; mostra travessão em vez de contar até zero. */
  valor: number | null;
  formato: FormatoNumero;
  sufixo?: string;
  cor?: string;
  serie?: number[];
  acento?: "success";
  /** Legenda dos tiles sem curva — explica o número em vez de fingir gráfico. */
  nota?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-[var(--radius)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
      <p className="text-[0.8rem] font-medium text-muted-strong">{label}</p>
      <p
        className={`mt-2 text-[1.55rem] font-semibold leading-none tabular-nums ${
          acento === "success" ? "text-success-ink" : "text-secondary"
        }`}
      >
        {valor === null ? (
          "—"
        ) : (
          <NumeroAnimado valor={valor} formato={formato} sufixo={sufixo} />
        )}
      </p>
      {serie ? (
        <Sparkline valores={serie} cor={cor} className="mt-3 h-7 w-full" />
      ) : (
        // Sem série: em vez de um bloco do tamanho de um gráfico (que lê como
        // skeleton travado), uma legenda que explica o número. Mesma altura dos
        // tiles com curva, então a banda continua alinhada.
        <p className="mt-3 flex h-7 items-end text-[0.7rem] leading-tight text-muted">{nota}</p>
      )}
    </div>
  );
}
