import { MapPin, Phone, Clock } from "lucide-react";
import { loja } from "@/lib/loja";
import { WhatsappIcon } from "@/components/WhatsappIcon";
import { WhatsappTrigger } from "@/components/whatsapp/WhatsappTrigger";
import { InstagramIcon } from "@/components/InstagramIcon";
import { Reveal } from "@/components/Reveal";

export function Contato() {
  return (
    <section id="contato" className="scroll-mt-24 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <div className="overflow-hidden rounded-[calc(var(--radius)*1.5)] bg-secondary shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
          <div className="grid md:grid-cols-2">
            {/* Coluna de conteúdo */}
            <div className="p-8 sm:p-12">
              <Reveal
                as="p"
                className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary"
              >
                Vamos conversar
              </Reveal>
              <Reveal>
                <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold leading-tight text-white">
                  Vamos achar o <span className="text-primary">seu carro?</span>
                </h2>
              </Reveal>
              <Reveal
                as="p"
                delay={0.08}
                className="mt-4 max-w-md text-sm leading-relaxed text-white/70"
              >
                Chama no WhatsApp e fala com a gente. A gente te mostra o estoque
                atualizado, avalia seu usado e tira todas as suas dúvidas na hora.
              </Reveal>

              <Reveal delay={0.14} className="mt-7 flex flex-wrap gap-3">
                <WhatsappTrigger
                  mensagem={`Olá! Vim pelo site da ${loja.nome}.`}
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-whatsapp px-6 py-3.5 text-sm font-semibold text-white transition-[transform,background-color,box-shadow] duration-300 ease-[var(--ease-brand)] hover:-translate-y-0.5 hover:bg-whatsapp-hover hover:shadow-[0_10px_28px_rgba(37,211,102,0.4)] motion-reduce:hover:translate-y-0"
                >
                  <WhatsappIcon size={18} />
                  Falar no WhatsApp
                </WhatsappTrigger>
                <a
                  href={loja.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition-[transform,background-color] duration-300 ease-[var(--ease-brand)] hover:-translate-y-0.5 hover:bg-white/10 motion-reduce:hover:translate-y-0"
                >
                  <InstagramIcon size={18} />
                  Instagram
                </a>
              </Reveal>

              <div className="mt-9 space-y-4 border-t border-white/10 pt-7 text-sm text-white/75">
                <p className="flex items-start gap-3">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
                  {loja.endereco}
                </p>
                <p className="flex items-start gap-3">
                  <Phone size={18} className="mt-0.5 shrink-0 text-primary" />
                  {loja.whatsappLabel}
                </p>
                <p className="flex items-start gap-3">
                  <Clock size={18} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    {loja.horario.semana}
                    <br />
                    {loja.horario.sabado}
                    <br />
                    {loja.horario.domingo}
                  </span>
                </p>
              </div>
            </div>

            {/* Coluna do mapa */}
            <div className="relative min-h-[320px] bg-sand/10">
              {loja.mapaEmbed ? (
                <iframe
                  src={loja.mapaEmbed}
                  title={`Localização da ${loja.nome}`}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-white/40">
                  <MapPin size={32} className="text-primary/60" />
                  <p className="text-sm">
                    Mapa da localização
                    <br />
                    <span className="text-xs">
                      (endereço a definir com a loja)
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
