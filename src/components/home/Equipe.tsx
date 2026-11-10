import Image from "next/image";
import { loja, imagens } from "@/lib/loja";
import { Reveal } from "@/components/Reveal";

/**
 * Seção "Nossa equipe" — estética da referência (seção escura do fundador):
 * fundo grafite quase preto, glow radial caramelo atrás, eyebrow com traço,
 * blockquote com borda caramelo à esquerda e palavra em destaque, assinatura
 * com selo CV. Adaptada: no lugar do fundador recortado, a foto real do TIME
 * (prova de estrutura, o argumento de venda de uma revendedora). Texto do
 * fundador, resumido e assinado.
 */
export function Equipe() {
  return (
    <section
      id="equipe"
      className="relative scroll-mt-24 overflow-hidden bg-[#26282c] py-20 sm:py-28"
    >
      {/* Glow caramelo atrás do conteúdo (atmosfera da referência). */}
      <div className="glow-caramelo pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-16">
        {/* Foto real da equipe */}
        <Reveal className="relative order-2 lg:order-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[calc(var(--radius)*1.5)] ring-1 ring-white/10">
            <Image
              src={imagens.equipe}
              alt="Equipe de vendas da Cassiano Veículos na loja"
              fill
              quality={90}
              sizes="(max-width: 1024px) 92vw, 600px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
          {/* Barrinha caramelo embaixo (no lugar da tricolor da referência). */}
          <div className="mx-auto mt-4 h-1 w-40 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        </Reveal>

        {/* Texto do fundador */}
        <div className="order-1 lg:order-2">
          <Reveal
            as="p"
            className="mb-4 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.24em] text-primary"
          >
            <span className="h-px w-7 bg-primary" />
            Nossa equipe
          </Reveal>

          <Reveal>
            <h2 className="text-[clamp(1.9rem,3.8vw,2.8rem)] font-bold leading-[1.1] text-white text-balance">
              Ninguém constrói algo grande{" "}
              <span className="text-primary">sozinho.</span>
            </h2>
          </Reveal>

          <Reveal
            as="blockquote"
            delay={0.1}
            className="mt-7 border-l-2 border-primary pl-5"
          >
            <p className="text-base leading-relaxed text-white/85 sm:text-lg">
              O que sustenta crescimento não é sorte, é cultura, visão e um time
              comprometido. O que mais me orgulha hoje não é só a empresa ter
              crescido, mas ver o time crescer{" "}
              <span className="font-semibold text-primary">junto com ela</span>:
              gente com postura, responsabilidade e mentalidade de dono, que
              carrega o peso e protege a cultura todos os dias.
            </p>
            <p className="mt-4 text-base font-semibold text-white sm:text-lg">
              Resultado é consequência.
            </p>
          </Reveal>

          <Reveal delay={0.18} className="mt-8 flex items-center gap-3">
            {/* Selo CV caramelo (no lugar do brasão da referência). */}
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-bold text-white"
              style={{ letterSpacing: "-0.06em" }}
            >
              CV
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Cassiano</p>
              <p className="text-xs text-primary/80">Fundador da {loja.nome}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
