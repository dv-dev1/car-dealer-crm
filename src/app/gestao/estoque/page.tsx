import { estoqueGestao } from "@/data/gestao-mock";
import { EstoqueGestao } from "./EstoqueGestao";
import { requireMember } from "@/features/auth/guard";

export default async function EstoquePage() {
  await requireMember();
  return <EstoqueGestao veiculos={estoqueGestao} />;
}
