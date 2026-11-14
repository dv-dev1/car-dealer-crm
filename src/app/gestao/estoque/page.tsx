import { EstoqueGestao } from "./EstoqueGestao";
import { requireMember } from "@/features/auth/guard";
import { listStock } from "@/features/stock/model";

export default async function EstoquePage() {
  const member = await requireMember();
  return <EstoqueGestao cars={await listStock(member)} canManage={member.role !== "seller"} />;
}
