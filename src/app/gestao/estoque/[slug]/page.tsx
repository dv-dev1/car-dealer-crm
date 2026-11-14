import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CarroGestao } from "./CarroGestao";
import { requireMember } from "@/features/auth/guard";
import { getVehicle, listStock } from "@/features/stock/model";

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
  const member = await requireMember();
  const { slug } = await params;
  const veiculo = await getVehicle(member, slug);
  if (!veiculo) notFound();

  const estoque = (await listStock(member)).map((v) => ({ id: v.id, titulo: v.title, preco: v.price }));

  return <CarroGestao veiculo={veiculo} estoque={estoque} canManage={member.role !== "seller"} />;
}
