// Dados da loja do site público (header, hero, contato, footer). Até a etapa 5 o site mostra a
// Maré Veículos, a loja fictícia da demonstração: sem CNPJ, endereço, Instagram nem pessoa de
// verdade. O WhatsApp é o mesmo da demo no banco.

export const loja = {
  nome: "Maré Veículos",
  slogan: "Seu próximo veículo com tranquilidade.",
  descricao:
    "Seminovos selecionados, procedência garantida e atendimento de quem entende de carro.",
  whatsapp: "558390000000",
  whatsappLabel: "(83) 9000-0000",
  endereco: "João Pessoa - PB",
  horario: {
    semana: "Segunda a Sexta, 08h às 18h",
    sabado: "Sábado, 08h às 18h",
    domingo: "Domingo, fechado",
  },
} as const;

export function whatsappLink(mensagem?: string): string {
  const base = `https://wa.me/${loja.whatsapp}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

// ─── ATENDENTES ──────────────────────────────────────────────
// Equipe de atendimento da loja. Ao clicar em qualquer CTA de WhatsApp, o
// visitante escolhe com quem falar (ver components/whatsapp). `numero` é o
// formato do wa.me (55 + DDD + número, só dígitos); `label` é o que aparece.
export interface Atendente {
  nome: string;
  numero: string;
  label: string;
  papel?: string; // função na loja (Vendas, Financiamento...) — opcional
}

// A loja fictícia atende por um número só.
export const atendentes: readonly Atendente[] = [
  { nome: loja.nome, numero: loja.whatsapp, label: loja.whatsappLabel },
] as const;

// Link do wa.me pra um atendente específico, com a mensagem pré-pronta do CTA.
export function whatsappLinkPara(numero: string, mensagem?: string): string {
  const base = `https://wa.me/${numero}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
