import { estoqueGestao } from "@/data/gestao-mock";
import { ClientesView } from "./ClientesView";

export default function ClientesPage() {
  const veiculos = estoqueGestao.map((v) => ({
    id: v.id,
    titulo: v.titulo,
    preco: v.preco,
  }));
  return <ClientesView veiculos={veiculos} />;
}
