import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";
import { Reveal } from "@/components/Reveal";
import { getVeiculos } from "@/lib/veiculos";
import { ListaVeiculos } from "./ListaVeiculos";

export const metadata: Metadata = {
  title: "Nossos carros",
  description:
    "Estoque de seminovos premium da Cassiano Veículos — SUVs, sedãs e hatches com procedência verificada.",
};

export default async function NossosCarrosPage() {
  const veiculos = await getVeiculos();

  return (
    <SiteChrome>
      {/* Cabeçalho da página, sobre o grafite pra caber sob o header fixo */}
      <section className="bg-secondary pb-14 pt-32">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
          <Reveal
            as="p"
            className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary"
          >
            Estoque atual
          </Reveal>
          <Reveal>
            <h1 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold text-white">
              Nossos carros
            </h1>
          </Reveal>
          <Reveal
            as="p"
            delay={0.08}
            className="mt-4 max-w-xl text-base leading-relaxed text-white/70"
          >
            Seminovos selecionados, com procedência verificada e documentação em
            dia. Encontre o seu e fale com a gente.
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-14 sm:px-8">
        <ListaVeiculos veiculos={veiculos} />
      </section>
    </SiteChrome>
  );
}
