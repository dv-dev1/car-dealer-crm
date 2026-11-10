import Image from "next/image";
import { loja, imagens } from "@/lib/loja";
import { InstagramIcon } from "@/components/InstagramIcon";
import { Reveal } from "@/components/Reveal";

/**
 * Seção do dono — logo abaixo do hero. Composição fiel à referência (Belloni):
 * o recorte do Cassiano SEM moldura, emergindo direto de um fundo escuro, com
 * o glow caramelo atrás (a assinatura de luz da marca, no lugar do vermelho da
 * referência). Nada de card: é só ele.
 *
 * Fundo mais fundo que o hero (#1d1f22) pra ser um momento próprio e se separar
 * da seção "Equipe" lá embaixo — lá é a foto do TIME emoldurada; aqui é ELE
 * sozinho, recorte. O ângulo é o diferencial: ele é ativo e responde no
 * Instagram PESSOAL (@cassiano.of, não o perfil da loja).
 */
export function Fundador() {
  return (
    <section
      id="fundador"
      className="relative overflow-hidden bg-[#1d1f22] py-16 sm:py-24"
    >
      {/* Glow caramelo de ambiente (assinatura da marca no escuro). */}
      <div
        aria-hidden="true"
        className="glow-caramelo pointer-events-none absolute inset-0"
      />

      <div className="relative mx-auto grid max-w-[1280px] items-center gap-4 px-5 sm:px-8 lg:grid-cols-[0.9fr_1fr] lg:gap-12">
        {/* Retrato SEM moldura: o recorte direto no fundo, aterrado, com halo
            caramelo atrás pra descolar do grafite (como no hero original). */}
        <Reveal className="order-1">
          <div className="relative mx-auto h-[540px] w-full max-w-sm sm:h-[560px] lg:h-[580px] lg:max-w-none">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(50% 52% at 50% 62%, rgba(181,110,53,0.30), transparent 72%)",
              }}
            />
            <Image
              src={imagens.cassiano}
              alt="Cassiano, fundador da Cassiano Veículos"
              fill
              quality={90}
              sizes="(max-width: 1024px) 24rem, 34rem"
              className="object-contain object-bottom"
            />
            {/* Piso: escurece a base pra aterrar a figura no fundo, sem corte seco. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#1d1f22] to-transparent"
            />
          </div>
        </Reveal>

        {/* Texto: o dono se apresenta. A frase é o centro. */}
        <div className="order-2">
          <Reveal
            as="p"
            className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary-on-dark"
          >
            <span className="h-px w-7 bg-primary-on-dark" />
            O dono na linha de frente
          </Reveal>

          <Reveal>
            <p className="mt-5 text-[clamp(1.5rem,3.2vw,2.15rem)] font-semibold leading-[1.28] text-white text-balance">
              O nome na fachada é o meu, e faço questão de estar presente. Você
              me encontra no salão e no Instagram, todos os dias.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="mt-8 flex items-center gap-3">
            <span className="h-8 w-1 rounded bg-primary" />
            <p className="text-lg font-semibold text-white">Cassiano</p>
          </Reveal>

          <Reveal delay={0.14} className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={loja.instagramCassiano}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram do Cassiano, ${loja.instagramCassianoHandle}`}
              className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-[transform,border-color,background-color] duration-300 ease-[var(--ease-brand)] hover:-translate-y-0.5 hover:border-primary/50 hover:bg-white/10 motion-reduce:hover:translate-y-0"
            >
              <InstagramIcon size={18} className="text-primary" />
              {loja.instagramCassianoHandle}
            </a>
            <p className="text-sm text-white/60">Me acompanha no dia a dia.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
