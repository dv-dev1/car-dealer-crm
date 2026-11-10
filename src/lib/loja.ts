// Dados da loja Cassiano Veículos usados em todo o site (header, hero,
// contato, footer). Dados reais fornecidos pela loja.

export const loja = {
  nome: "Cassiano Veículos",
  slogan: "Seu próximo veículo com tranquilidade.",
  descricao:
    "Seminovos selecionados, procedência garantida e atendimento de quem entende de carro.",
  cnpj: "37.203.730/0001-08",
  whatsapp: "5583996071247", // (83) 99607-1247
  whatsappLabel: "(83) 99607-1247",
  instagram: "https://www.instagram.com/cassianoveiculosoficial",
  instagramHandle: "@cassianoveiculosoficial",
  // Instagram PESSOAL do Cassiano (o dono, cara da marca) — diferente do perfil
  // da loja. Usado na seção do fundador: ele é ativo e interage no dia a dia.
  instagramCassiano: "https://www.instagram.com/cassiano.of",
  instagramCassianoHandle: "@cassiano.of",
  endereco:
    "Rodovia BR-230, 14162, Loja 10, Trevo Auto Shop, Cabedelo - PB, CEP 58109-303",
  horario: {
    semana: "Segunda a Sexta, 08h às 18h",
    sabado: "Sábado, 08h às 18h",
    domingo: "Domingo, fechado",
  },
  // Embed do Google Maps do endereço da loja (Trevo Auto Shop, Cabedelo-PB).
  mapaEmbed:
    "https://www.google.com/maps?q=Trevo+Auto+Shop,+Rodovia+BR-230,+Cabedelo+-+PB,+58109-303&output=embed",
} as const;

// Imagens de ambiente (fotos reais da loja, enviadas pela Cassiano).
export const imagens = {
  // Hero — foto real da concessionária (carros na cobertura), usada como
  // ambiente ao fundo atrás do Cassiano. Versão HD (upscale + sharpen).
  hero: "/concessionaria-hd.webp",
  // Foto recortada (fundo transparente) do Cassiano, o dono e cara da marca.
  // Destaque do hero: a maioria dos clientes compra pela confiança nele.
  // Versão nova em alta (1024x1536), braço completo e fundo transparente.
  cassiano: "/cassiano-novo.png",
  // Foto real da equipe de vendas da Cassiano (seção "Nossa equipe").
  // Versão HD (upscale + sharpen).
  equipe: "/equipe-hd.webp",
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

export const atendentes: readonly Atendente[] = [
  { nome: "Afonso", numero: "5583999859924", label: "(83) 99985-9924" },
  { nome: "Cassiano Veículos", numero: "5583996071247", label: "(83) 99607-1247" },
  { nome: "Daniel", numero: "5583991861991", label: "(83) 99186-1991" },
  { nome: "Placa Preta", numero: "5583987722822", label: "(83) 98772-2822" },
  { nome: "Heleno", numero: "5583991394554", label: "(83) 99139-4554" },
] as const;

// Link do wa.me pra um atendente específico, com a mensagem pré-pronta do CTA.
export function whatsappLinkPara(numero: string, mensagem?: string): string {
  const base = `https://wa.me/${numero}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
