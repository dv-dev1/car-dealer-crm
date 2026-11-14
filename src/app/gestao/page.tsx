import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";
import { resumoMeta } from "@/data/vendas-mock";
import { diaPorExtenso } from "@/lib/hoje";
import { listStock } from "@/features/stock/model";
import { oldestInStock, staleLevel, stockSummary } from "@/features/stock/rules";
import { todayIso } from "@/shared/today";
import { AvisoMeta, AvisoSemMargem } from "@/components/gestao/painel/PainelAvisos";
import { LojaAgora } from "@/components/gestao/painel/LojaAgora";
import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { AoEntrar } from "@/components/gestao/motion/AoEntrar";
import { requireMember } from "@/features/auth/guard";

export default async function PainelPage() {
  const member = await requireMember();
  const today = todayIso();
  const estoque = await listStock(member, today);
  const loja = stockSummary(estoque);
  const giro = oldestInStock(estoque, 3);
  const meta = resumoMeta();

  const pedemAtencao = estoque.filter((v) => staleLevel(v.daysInStock) !== "ok").length;

  const dia = diaPorExtenso(today);

  return (
    <div>
      <CabecalhoGestao
        eyebrow="Central de gestão"
        titulo="Painel"
        apoio={dia.charAt(0).toUpperCase() + dia.slice(1)}
      />

      <div className="space-y-8">
        {/* Avisos */}
        <div className="grid gap-3">
          <AvisoMeta meta={meta} />
          {member.role !== "seller" && <AvisoSemMargem quantidade={loja.noMargin} />}
        </div>

        <LojaAgora resumo={loja} giro={giro} pedemAtencao={pedemAtencao} />

        {/* Ponte pros Relatórios — os números de vendas moram lá agora */}
        <AoEntrar ordem={2}>
        <Link
          href="/gestao/relatorios"
          className="flex items-center gap-4 rounded-[var(--radius)] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-soft)] transition-[background-color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] hover:bg-sand active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sand text-secondary/70">
            <BarChart3 size={20} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-secondary">Vendas, lucro e metas</p>
            <p className="text-xs text-muted-strong">
              O resultado completo do mês está nos Relatórios.
            </p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-primary" />
        </Link>
        </AoEntrar>
      </div>
    </div>
  );
}
