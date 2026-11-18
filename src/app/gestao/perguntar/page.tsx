import type { Metadata } from "next";

import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";
import { AskView } from "@/features/ai/ask-view";
import { requireMember } from "@/features/auth/guard";

export const metadata: Metadata = { title: "Perguntar" };

export default async function AskPage() {
  await requireMember();
  return (
    <div>
      <CabecalhoGestao eyebrow="Central de gestão" titulo="Pergunte à loja" apoio="Pergunte com as suas palavras. A resposta sai dos números do painel." />
      <AskView />
    </div>
  );
}
