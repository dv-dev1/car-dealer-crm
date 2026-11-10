import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { loja, imagens } from "@/lib/loja";
import { WhatsappIcon } from "@/components/WhatsappIcon";
import { WhatsappTrigger } from "@/components/whatsapp/WhatsappTrigger";
import { Reveal } from "@/components/Reveal";

/**
 * Hero com o Cassiano — o dono é a cara da marca, e a maioria dos clientes
 * compra pela confiança nele. Composição: ambiente real da loja (concessionária)
 * escurecido e desfocado ao fundo, texto e CTAs à esquerda, Cassiano recortado
 * (PNG transparente) grande à direita, com glow caramelo atrás pra a figura
 * (de polo escuro) descolar do fundo grafite.
 *
 * Mobile: o texto e os CTAs mandam (ficam acima da dobra). O Cassiano vira uma
 * presença atrás, com opacidade menor, pra não empurrar a ação pra baixo.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[88svh] items-center overflow-hidden bg-secondary sm:min-h-[92svh]">
      {/* Ambiente: concessionária ao fundo, escurecida (sem blur — a foto tem
          resolução boa; o overlay grafite já garante a legibilidade do texto). */}
      <Image
        src={imagens.hero}
        alt=""
        aria-hidden="true"
        fill
        priority
        quality={90}
        sizes="100vw"
        className="object-cover object-center opacity-55"
      />
      {/* Overlays grafite: forte à esquerda (texto), o salão respira à direita
          agora que o Cassiano saiu (ele ganhou seção própria logo abaixo). */}
      <div className="absolute inset-0 bg-gradient-to-r from-secondary via-secondary/85 to-secondary/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-secondary via-transparent to-secondary/60" />

      {/* Luz de ambiente caramelo (assinatura da marca) — sutil, não mais um
          holofote sobre uma figura; só calor no canto do salão. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 60% at 88% 68%, rgba(181,110,53,0.16), transparent 70%)",
        }}
      />

      {/* Conteúdo */}
      <div className="relative mx-auto w-full max-w-[1280px] px-5 pt-24 sm:px-8 sm:pt-28">
        <div className="max-w-xl">
          <Reveal
            as="p"
            className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-primary"
          >
            {loja.nome} • Seminovos premium
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="hero-title max-w-[16ch] text-[clamp(2.25rem,5.5vw,4rem)] font-bold text-white">
              Seu próximo carro, com a{" "}
              <span className="text-primary">procedência</span> que você merece.
            </h1>
          </Reveal>

          <Reveal
            as="p"
            delay={0.16}
            className="mt-6 max-w-lg text-base leading-relaxed text-white/80 sm:text-lg"
          >
            Seminovos selecionados, multimarcas, com avaliação justa do seu usado
            e financiamento aprovado nos principais bancos. Tudo num só lugar, do
            jeito certo.
          </Reveal>

          <Reveal delay={0.24} className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/nossos-carros"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-[transform,box-shadow,background-color] duration-300 ease-[var(--ease-brand)] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_10px_28px_rgba(181,110,53,0.4)] motion-reduce:hover:translate-y-0"
            >
              Ver veículos
              <ChevronRight size={18} />
            </Link>
            <WhatsappTrigger
              mensagem={`Olá! Vim pelo site da ${loja.nome} e quero atendimento.`}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-[transform,background-color] duration-300 ease-[var(--ease-brand)] hover:-translate-y-0.5 hover:bg-white/10 motion-reduce:hover:translate-y-0"
            >
              <WhatsappIcon size={18} />
              WhatsApp
            </WhatsappTrigger>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
