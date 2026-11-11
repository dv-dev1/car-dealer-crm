import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  estoqueGestao,
  veiculoGestaoPorSlug,
} from "@/data/gestao-mock";
import { CarroGestao } from "./CarroGestao";
import { requireMember } from "@/features/auth/guard";

// No generateStaticParams: a prerendered page would ship cost and margin in the build output.
// A static title: one per car would read the stock before the guard and reach the redirect response.
export const metadata: Metadata = {
  title: "Veículo — Gestão",
  robots: { index: false, follow: false },
};

export default async function CarroGestaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireMember();
  const { slug } = await params;
  const veiculo = veiculoGestaoPorSlug(slug);
  if (!veiculo) notFound();

  const estoque = estoqueGestao.map((v) => ({
    id: v.id,
    titulo: v.titulo,
    preco: v.preco,
  }));

  return <CarroGestao veiculo={veiculo} estoque={estoque} />;
}
