import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdicionarCarro } from "../../novo/AdicionarCarro";
import { requireRole } from "@/features/auth/guard";
import { getVehicle } from "@/features/stock/model";
import { todayIso } from "@/shared/today";

export const metadata: Metadata = {
  title: "Editar carro — Gestão",
  robots: { index: false, follow: false },
};

export default async function EditarCarroPage({ params }: { params: Promise<{ slug: string }> }) {
  const member = await requireRole(["owner", "manager"]);
  const vehicle = await getVehicle(member, (await params).slug);
  if (!vehicle || vehicle.status === "sold") notFound();
  return <AdicionarCarro vehicle={vehicle} today={todayIso()} />;
}
