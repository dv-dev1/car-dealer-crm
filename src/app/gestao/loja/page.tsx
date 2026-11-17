import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireMember } from "@/features/auth/guard";
import { getStoreSettings } from "@/features/store/model";
import { StoreSettingsView } from "@/features/store/view";

export const metadata: Metadata = { title: "Ajustes da loja" };

export default async function StoreSettingsPage() {
  const member = await requireMember();
  if (member.role === "seller") notFound();
  const { moneyRate } = await getStoreSettings(member);
  return <StoreSettingsView moneyRate={moneyRate} />;
}
