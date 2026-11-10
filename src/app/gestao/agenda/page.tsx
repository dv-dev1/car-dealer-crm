import { AgendaView } from "./AgendaView";

// A agenda lê o MESMO store dos clientes (via useLeads, dentro do AgendaView).
// Assim uma visita registrada na tela do carro ou no funil aparece aqui também
// — fonte única, sem divergir do kanban.
export default function AgendaPage() {
  return <AgendaView />;
}
