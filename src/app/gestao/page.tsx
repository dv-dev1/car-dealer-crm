import Link from "next/link";
import { BarChart3, ArrowRight } from "lucide-react";
import {
  estoqueGestao,
  resumoEstoque,
  resumoLoja,
  giroEstoque,
  nivelGiro,
} from "@/data/gestao-mock";
import { resumoMeta } from "@/data/vendas-mock";
import { HOJE_ISO, diaPorExtenso } from "@/lib/hoje";
import { AvisoMeta, AvisoSemMargem } from "@/components/gestao/painel/PainelAvisos";
import { LojaAgora } from "@/components/gestao/painel/LojaAgora";
import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { AoEntrar } from "@/components/gestao/motion/AoEntrar";
import { requireMember } from "@/features/auth/guard";

export default async function PainelPage() {
  await requireMember();
  const estoque = estoqueGestao;
  const resumo = resumoEstoque(estoque);
  const loja = resumoLoja(estoque);
  const giro = giroEstoque(estoque, 3);
  const meta = resumoMeta();

  const pedemAtencao = estoque.filter(
    (v) => v.statusGestao !== "vendido" && nivelGiro(v.diasEstoque) !== "ok",
  ).length;

  const dia = diaPorExtenso(HOJE_ISO);

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
          <AvisoSemMargem quantidade={resumo.semMargem} />
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
