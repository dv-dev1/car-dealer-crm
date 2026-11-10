// Tipos do domínio — espelham o schema em supabase/schema.sql.
// O site consome `Veiculo`; o admin (Fase 2) usa também Venda e Lead.

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

export interface Venda {
  id: string;
  veiculoId?: string;
  valor: number;
  dataVenda: string;
  formaPagamento?: string;
  vendedor?: string;
  clienteNome?: string;
}
