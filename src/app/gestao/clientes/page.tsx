import { ClientesView } from "./ClientesView";
import { requireMember } from "@/features/auth/guard";
import { listChannels, listLeads, listSellers } from "@/features/leads/model";
import { listStock } from "@/features/stock/model";
import { todayIso } from "@/shared/today";

export default async function ClientesPage() {
  const member = await requireMember();
  const today = todayIso();
  const [stock, leads, channels, sellers] = await Promise.all([
    listStock(member, today),
    listLeads(member, today),
    listChannels(member),
    member.role === "seller" ? null : listSellers(member),
  ]);
  const veiculos = stock.map((v) => ({ id: v.id, titulo: v.title, preco: v.price }));
  return <ClientesView leads={leads} veiculos={veiculos} channels={channels} sellers={sellers}
      memberId={member.membershipId} today={today} />;
}
