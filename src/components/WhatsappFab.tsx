import { loja } from "@/lib/loja";
import { WhatsappIcon } from "./WhatsappIcon";
import { WhatsappTrigger } from "./whatsapp/WhatsappTrigger";

/**
 * Botão flutuante do WhatsApp — fixo no canto, presente em todas as páginas.
 * No mobile é o CTA principal (a11y: alvo de toque generoso, nome acessível).
 * Abre o seletor de atendentes (o painel nasce daqui).
 */
export function WhatsappFab() {
  return (
    <WhatsappTrigger
      mensagem={`Olá! Vim pelo site da ${loja.nome} e quero falar sobre um veículo.`}
      aria-label="Falar com a Cassiano Veículos no WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-[0_8px_24px_rgba(37,211,102,0.4)] transition-[transform,background-color] duration-200 ease-[var(--ease-brand)] hover:bg-whatsapp-hover hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <WhatsappIcon size={28} />
    </WhatsappTrigger>
  );
}
