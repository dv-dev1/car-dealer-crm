import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  estoqueGestao,
  veiculoGestaoPorSlug,
} from "@/data/gestao-mock";
import { CarroGestao } from "./CarroGestao";
import { requireMember } from "@/features/auth/guard";

// No generateStaticParams: a prerendered page would ship cost and margin in the build output.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  await requireMember(); // the title would otherwise reach the redirect response
  const { slug } = await params;
  const v = veiculoGestaoPorSlug(slug);
  return {
    title: v ? `${v.titulo} — Gestão` : "Veículo — Gestão",
    robots: { index: false, follow: false },
  };
}

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
