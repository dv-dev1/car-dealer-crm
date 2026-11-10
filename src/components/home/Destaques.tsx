import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Veiculo } from "@/types/veiculo";
import { VeiculoCard } from "@/components/VeiculoCard";
import { Reveal } from "@/components/Reveal";

export function Destaques({
  veiculos,
  total,
}: {
  veiculos: Veiculo[];
  total: number;
}) {
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 sm:py-24">
      <Reveal className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {/* Eyebrow com traço, igual à referência. */}
          <p className="mb-2 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <span className="h-px w-7 bg-primary" />
            Estoque atual
          </p>
          <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold text-secondary">
            Destaques do estoque
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted sm:text-right">
          Uma seleção do que temos hoje no pátio. Todos com procedência
          verificada e prontos pra test drive.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {veiculos.map((veiculo, i) => (
          <Reveal key={veiculo.id} delay={Math.min(i, 4) * 0.06}>
            <VeiculoCard veiculo={veiculo} />
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-12 flex justify-center">
        <Link
          href="/nossos-carros"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-primary px-7 py-3.5 text-sm font-semibold text-white transition-[transform,box-shadow,background-color] duration-300 ease-[var(--ease-brand)] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_10px_28px_rgba(181,110,53,0.4)] motion-reduce:hover:translate-y-0"
        >
          Ver todos os carros ({total} veículos)
          <ChevronRight size={18} />
        </Link>
      </Reveal>
    </section>
  );
}
