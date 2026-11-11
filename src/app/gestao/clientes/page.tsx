import { estoqueGestao } from "@/data/gestao-mock";
import { ClientesView } from "./ClientesView";
import { requireMember } from "@/features/auth/guard";

export default async function ClientesPage() {
  await requireMember();
  const veiculos = estoqueGestao.map((v) => ({
    id: v.id,
    titulo: v.titulo,
    preco: v.preco,
  }));
  return <ClientesView veiculos={veiculos} />;
}
