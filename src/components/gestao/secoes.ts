import {
  LayoutDashboard,
  Car,
  Users,
  Calendar,
  FileText,
  type LucideIcon,
} from "lucide-react";

// Seções da área dos vendedores (a central de gestão). Metas foi fundida em
// Relatórios (a meta é uma métrica de resultado), enxugando o menu de 6 pra 5.
export interface Secao {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Evento que a sidebar dispara quando o "Novo cliente" é clicado por quem JÁ
 * está na tela de Clientes. Nesse caso navegar não adianta: a rota é a mesma,
 * o componente não remonta, e o efeito que abre o formulário nunca rodaria.
 */
export const EVENTO_NOVO_CLIENTE = "cassiano:novo-cliente";

export const secoes: Secao[] = [
  { label: "Painel", href: "/gestao", icon: LayoutDashboard },
  { label: "Estoque", href: "/gestao/estoque", icon: Car },
  { label: "Clientes", href: "/gestao/clientes", icon: Users },
  { label: "Agenda", href: "/gestao/agenda", icon: Calendar },
  { label: "Relatórios", href: "/gestao/relatorios", icon: FileText },
];
