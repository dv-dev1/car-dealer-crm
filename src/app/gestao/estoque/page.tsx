import { estoqueGestao } from "@/data/gestao-mock";
import { EstoqueGestao } from "./EstoqueGestao";

export default function EstoquePage() {
  return <EstoqueGestao veiculos={estoqueGestao} />;
}
