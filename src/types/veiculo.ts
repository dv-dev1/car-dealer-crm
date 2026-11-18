// The car as the public site shows it. It comes from the database through features/site, with the public sheet only.

export type StatusVeiculo = "disponivel" | "reservado" | "vendido";

export interface Veiculo {
  id: string;
  slug: string;
  marca: string;
  modelo: string;
  titulo: string;
  ano: number;
  km: number;
  preco: number;
  cambio: string;
  combustivel: string;
  cor?: string;
  portas?: number;
  carroceria?: string;
  potencia?: string;
  motor?: string;
  descricao?: string;
  fotos: string[];
  equipamentos: string[];
  fichaTecnica: Record<string, string>;
  status: StatusVeiculo;
  destaque: boolean;
}

export type Temperatura = "frio" | "morno" | "quente";
export type EstagioLead =
  | "novo"
  | "contato"
  | "negociacao"
  | "fechamento"
  | "ganho"
  | "perdido";

export interface Lead {
  id: string;
  nome: string;
  contato?: string;
  email?: string;
  veiculoInteresse?: string;
  temperatura: Temperatura;
  estagio: EstagioLead;
  ordem: number;
  notas?: string;
}
