import type { Metadata } from "next";

import { requireMember } from "@/features/auth/guard";
import { afterSale } from "@/features/sales/after-sale";
import { AfterSaleView } from "@/features/sales/after-sale-view";
import { todayIso } from "@/shared/today";

export const metadata: Metadata = { title: "Pós-venda" };

export default async function AfterSalePage() {
  const member = await requireMember();
  return <AfterSaleView data={await afterSale(member, todayIso())} />;
}
