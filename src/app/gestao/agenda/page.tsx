import { AgendaView } from "./AgendaView";
import { requireMember } from "@/features/auth/guard";
import { listLeads } from "@/features/leads/model";
import { todayIso } from "@/shared/today";

// The agenda reads the same leads as the funnel: a visit set on the car page or in the funnel shows here too.
// Closed leads are done, so only the open ones make events.
export default async function AgendaPage() {
  const member = await requireMember();
  const today = todayIso();
  const leads = (await listLeads(member, today)).filter((l) => l.estagio !== "vendeu" && l.estagio !== "nao-comprou");
  return <AgendaView leads={leads} today={today} />;
}
