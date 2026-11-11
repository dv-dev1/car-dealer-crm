import type { Metadata } from "next";
import { AdicionarCarro } from "./AdicionarCarro";
import { requireMember } from "@/features/auth/guard";

export const metadata: Metadata = {
  title: "Adicionar carro — Gestão",
  robots: { index: false, follow: false },
};

export default async function AdicionarCarroPage() {
  await requireMember();
  return <AdicionarCarro />;
}
