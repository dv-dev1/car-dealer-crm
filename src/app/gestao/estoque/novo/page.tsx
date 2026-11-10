import type { Metadata } from "next";
import { AdicionarCarro } from "./AdicionarCarro";

export const metadata: Metadata = {
  title: "Adicionar carro — Gestão",
  robots: { index: false, follow: false },
};

export default function AdicionarCarroPage() {
  return <AdicionarCarro />;
}
