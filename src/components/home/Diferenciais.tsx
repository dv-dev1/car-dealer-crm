import { Gem, ShieldCheck, Handshake } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const cards = [
  {
    icon: Gem,
    titulo: "Curadoria de verdade",
    texto:
      "Não enchemos o pátio por encher. Selecionamos carro que nós mesmos compraríamos, com procedência confirmada.",
  },
  {
    icon: ShieldCheck,
    titulo: "Transparência total",
    texto:
      "Você olha exatamente o que está levando: histórico, estado e documentação na mesa, sem letra miúda.",
  },
  {
    icon: Handshake,
    titulo: "Pós-venda que existe",
    texto:
      "Nosso relacionamento não acaba na entrega da chave. A gente continua por perto quando você precisar.",
  },
];

export function Diferenciais() {
  return (
    <section
      id="diferenciais"
      className="scroll-mt-24 bg-sand/60 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Reveal className="mb-12 max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Por que a Cassiano
          </p>
          <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-tight text-secondary">
            Comprar carro não precisa ser uma aposta.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            A gente vende carro do jeito que gostaria de comprar: transparente,
            sem letra miúda e olhando no olho.
          </p>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.titulo} delay={i * 0.08}>
                <article className="h-full rounded-[var(--radius)] border border-line bg-surface p-7 shadow-[var(--shadow-soft)]">
                  <span className="mb-5 grid h-12 w-12 place-items-center rounded-[var(--radius)] bg-primary/10 text-primary">
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                  <h3 className="text-lg font-semibold text-secondary">
                    {card.titulo}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">
                    {card.texto}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
