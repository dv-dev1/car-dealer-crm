import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  estoqueGestao,
  veiculoGestaoPorSlug,
} from "@/data/gestao-mock";
import { CarroGestao } from "./CarroGestao";

export function generateStaticParams() {
  return estoqueGestao.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
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
