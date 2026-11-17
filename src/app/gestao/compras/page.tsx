import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireMember } from "@/features/auth/guard";
import { buyingReport } from "@/features/buying/model";
import { BuyingView } from "@/features/buying/view";
import { todayIso } from "@/shared/today";

export const metadata: Metadata = { title: "Compras" };

export default async function BuyingPage() {
  const member = await requireMember();
  const report = await buyingReport(member, todayIso());
  if (!report) notFound();
  return <BuyingView report={report} />;
}
