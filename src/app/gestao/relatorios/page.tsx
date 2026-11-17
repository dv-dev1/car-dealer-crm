import { RelatoriosView } from "./RelatoriosView";
import { requireMember } from "@/features/auth/guard";
import { channelReport } from "@/features/channels/model";
import { loadGoal, loadReport } from "@/features/reports/model";
import {
  funilConversao,
  lerPeriodo,
  porFormaPagamento,
  rankingModelos,
  resumoVendas,
  rotuloPeriodo,
  vendasPorMes,
} from "@/features/reports/rules";
import { MESES } from "@/lib/hoje";
import { resumoMetaMes } from "@/lib/metas";
import { todayIso } from "@/shared/today";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const member = await requireMember();
  const params = await searchParams;
  const today = todayIso();
  const { periodo, janela } = lerPeriodo(
    { periodo: first(params.periodo), de: first(params.de), ate: first(params.ate) },
    today,
  );
  const [report, goal, canais] = await Promise.all([
    loadReport(member, janela, today),
    loadGoal(member, today),
    channelReport(member, janela),
  ]);
  const comLucro = member.role !== "seller";
  const ano = Number(today.slice(0, 4));
  const mes = Number(today.slice(5, 7)) - 1;

  return (
    <RelatoriosView
      periodo={periodo}
      janela={janela}
      rotulo={rotuloPeriodo(periodo, janela)}
      resumo={resumoVendas(report.vendas, janela, comLucro)}
      meses={vendasPorMes(report.vendasDoAno, ano, comLucro)}
      ano={ano}
      mesCorrente={mes}
      ranking={rankingModelos(report.vendas)}
      formas={porFormaPagamento(report.vendas)}
      funil={funilConversao(report.funil)}
      vendas={report.vendas}
      canais={canais}
      meta={goal.alvo === null ? null : resumoMetaMes({ ...goal, alvo: goal.alvo }, today)}
      mesLabel={MESES[mes]}
      podeEditarMeta={comLucro}
    />
  );
}
