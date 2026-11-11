import { AgendaView } from "./AgendaView";
import { requireMember } from "@/features/auth/guard";

// A agenda lê o MESMO store dos clientes (via useLeads, dentro do AgendaView).
// Assim uma visita registrada na tela do carro ou no funil aparece aqui também
// — fonte única, sem divergir do kanban.
export default async function AgendaPage() {
  await requireMember();
  return <AgendaView />;
}
