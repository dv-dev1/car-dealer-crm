import { BatteryCharging, Disc3, Wrench, ShieldCheck } from "lucide-react";
import { loja } from "@/lib/loja";
import { WhatsappIcon } from "@/components/WhatsappIcon";
import { WhatsappTrigger } from "@/components/whatsapp/WhatsappTrigger";
import { Reveal } from "@/components/Reveal";

/**
 * Garantia de 90 dias "para-choque a para-choque" — diferencial autêntico e
 * forte da Cassiano. Não é a garantia limitada de sempre: pifou a bateria, eles
 * trocam; furou/gastou o pneu, botam pneu de qualidade. Cobertura de verdade.
 *
 * Estética: bloco escuro drenched (a garantia É o produto aqui), o "90 dias"
 * como elemento herói (número grande), e a cobertura provada por itens reais
 * em vez de 3 cards genéricos. Remove o maior medo de comprar seminovo.
 */
const coberturas = [
  { icon: BatteryCharging, label: "Bateria descarregou? A gente troca." },
  { icon: Disc3, label: "Pneu furou ou gastou? Pneu de qualidade, por nossa conta." },
  { icon: Wrench, label: "Deu problema mecânico? A gente resolve." },
];

export function Garantia() {
  return (
    <section
      id="garantia"
      className="relative scroll-mt-24 overflow-hidden bg-primary py-20 text-white sm:py-28"
    >
      {/* Textura sutil: grafite radial nos cantos pra dar profundidade ao caramelo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(120% 90% at 100% 0%, rgba(47,49,54,0.55), transparent 55%), radial-gradient(90% 90% at 0% 100%, rgba(47,49,54,0.4), transparent 55%)",
        }}
      />

      <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        {/* Coluna do número herói (centralizada verticalmente no desktop). */}
        <Reveal className="text-center lg:self-center lg:text-left">
          <p className="flex items-center justify-center gap-2.5 text-xs font-semibold uppercase tracking-[0.24em] text-white/70 lg:justify-start">
            <span className="h-px w-7 bg-white/50" />
            Garantia de verdade
          </p>
          <p className="mt-4 flex items-baseline justify-center gap-3 lg:justify-start">
            <span className="text-[clamp(4.5rem,12vw,8rem)] font-bold leading-none tracking-[-0.04em]">
              90
            </span>
            <span className="text-2xl font-semibold sm:text-3xl">dias</span>
          </p>
          <p className="mt-3 text-lg font-semibold sm:text-xl">
            de para-choque a para-choque.
          </p>
        </Reveal>

        {/* Coluna da explicação */}
        <div>
          <Reveal>
            <h2 className="text-[clamp(1.6rem,3.2vw,2.4rem)] font-bold leading-tight text-white text-balance">
              Não é aquela garantia de mentira, com uma lista de exceções.
            </h2>
          </Reveal>
          <Reveal
            as="p"
            delay={0.08}
            className="mt-4 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg"
          >
            Levou um carro da Cassiano e algo deu problema nos primeiros 90 dias?
            A gente resolve. Sem letra miúda, sem empurrar a conta pra você.
          </Reveal>

          <ul className="mt-8 space-y-3">
            {coberturas.map((item, i) => {
              const Icon = item.icon;
              return (
                <Reveal
                  as="li"
                  key={item.label}
                  delay={0.12 + i * 0.06}
                  className="flex items-center gap-3.5 rounded-[var(--radius)] bg-white/10 px-4 py-3.5 backdrop-blur-sm ring-1 ring-white/15"
                >
                  <Icon size={22} strokeWidth={1.75} className="shrink-0 text-white" />
                  <span className="text-sm font-medium text-white sm:text-base">
                    {item.label}
                  </span>
                </Reveal>
              );
            })}
          </ul>

          <Reveal delay={0.32} className="mt-8 flex flex-wrap items-center gap-4">
            <WhatsappTrigger
              mensagem={`Olá! Vim pelo site da ${loja.nome} e quero saber mais sobre a garantia de 90 dias.`}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-secondary px-6 py-3.5 text-sm font-semibold text-white transition-[transform,box-shadow,background-color] duration-300 ease-[var(--ease-brand)] hover:-translate-y-0.5 hover:bg-secondary/90 hover:shadow-[0_10px_28px_rgba(0,0,0,0.3)] motion-reduce:hover:translate-y-0"
            >
              <WhatsappIcon size={18} />
              Perguntar sobre a garantia
            </WhatsappTrigger>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-white/85">
              <ShieldCheck size={18} strokeWidth={1.75} />
              Escrita, não só de boca.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
