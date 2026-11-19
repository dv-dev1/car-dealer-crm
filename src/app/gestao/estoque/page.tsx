import { EstoqueGestao } from "./EstoqueGestao";
import { requireMember } from "@/features/auth/guard";
import { listStock } from "@/features/stock/model";

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string | string[]; ordem?: string | string[] }>;
}) {
  const member = await requireMember();
  const { filtro, ordem } = await searchParams;
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
  return (
    <EstoqueGestao
      // A new address (a panel card, the menu's plain link) starts the screen over on its filter.
      key={`${one(filtro)}|${one(ordem)}`}
      cars={await listStock(member)}
      canManage={member.role !== "seller"}
      filtroInicial={one(filtro)}
      ordemInicial={one(ordem)}
    />
  );
}
