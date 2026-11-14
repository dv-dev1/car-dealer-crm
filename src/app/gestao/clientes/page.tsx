import { ClientesView } from "./ClientesView";
import { requireMember } from "@/features/auth/guard";
import { listStock } from "@/features/stock/model";

export default async function ClientesPage() {
  const member = await requireMember();
  const veiculos = (await listStock(member)).map((v) => ({ id: v.id, titulo: v.title, preco: v.price }));
  return <ClientesView veiculos={veiculos} />;
}
