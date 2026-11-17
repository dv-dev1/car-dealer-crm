import { RelatoriosView } from "./RelatoriosView";
import { requireMember } from "@/features/auth/guard";
import { loadGoal } from "@/features/reports/model";
import { MESES } from "@/lib/hoje";
import { resumoMetaMes } from "@/lib/metas";
import { todayIso } from "@/shared/today";

export default async function RelatoriosPage() {
  const member = await requireMember();
  const today = todayIso();
  const goal = await loadGoal(member, today);
  const meta = goal.alvo === null ? null : resumoMetaMes({ ...goal, alvo: goal.alvo }, today);
  return (
    <RelatoriosView meta={meta} mesLabel={MESES[Number(today.slice(5, 7)) - 1]} podeEditarMeta={member.role !== "seller"} />
  );
}
