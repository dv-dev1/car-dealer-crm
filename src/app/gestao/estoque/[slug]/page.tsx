import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CarroGestao } from "./CarroGestao";
import { requireMember } from "@/features/auth/guard";
import { listChannels, listLeads, listSellers } from "@/features/leads/model";
import { listExpenses } from "@/features/stock/expenses";
import { getVehicle, listStock } from "@/features/stock/model";
import { todayIso } from "@/shared/today";

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

  const canManage = member.role !== "seller";
  const [stock, channels, sellers, leads, expenses] = await Promise.all([
    listStock(member),
    listChannels(member),
    canManage ? listSellers(member) : null,
    canManage ? listLeads(member) : [],
    listExpenses(member, veiculo.id),
  ]);
  const open = leads.filter((l) => l.estagio !== "vendeu" && l.estagio !== "nao-comprou");
  const estoque = stock.map((v) => ({
    id: v.id, titulo: v.title, preco: v.price,
    consignorPayout: v.source === "consignment" ? (v.money?.acquisitionCost ?? null) : null,
  }));

  return <CarroGestao veiculo={veiculo} estoque={estoque} canManage={canManage} channels={channels} sellers={sellers}
      leads={open} memberId={member.membershipId} expenses={expenses} today={todayIso()} />;
}
