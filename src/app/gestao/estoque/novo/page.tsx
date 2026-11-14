import type { Metadata } from "next";
import { AdicionarCarro } from "./AdicionarCarro";
import { requireRole } from "@/features/auth/guard";
import { todayIso } from "@/shared/today";

export const metadata: Metadata = {
  title: "Adicionar carro — Gestão",
  robots: { index: false, follow: false },
};

export default async function AdicionarCarroPage() {
  await requireRole(["owner", "manager"]);
  return <AdicionarCarro today={todayIso()} />;
}
