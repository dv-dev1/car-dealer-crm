import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { requireMember } from "@/features/auth/guard";
import { listChannelSettings } from "@/features/channels/model";
import { ChannelsSettings } from "@/features/channels/view";
import { listStoreExpenses } from "@/features/store/expenses";
import { getStoreSettings } from "@/features/store/model";
import { StoreExpensesSettings, StoreSettingsView } from "@/features/store/view";
import { MESES } from "@/lib/hoje";
import { todayIso } from "@/shared/today";

export const metadata: Metadata = { title: "Ajustes da loja" };

export default async function StoreSettingsPage() {
  const member = await requireMember();
  if (member.role === "seller") notFound();
  const today = todayIso();
  const month = `${today.slice(0, 7)}-01`;
  const mesLabel = MESES[Number(today.slice(5, 7)) - 1].toLowerCase();
  const [{ moneyRate }, channels, expenses] = await Promise.all([
    getStoreSettings(member),
    listChannelSettings(member, month),
    listStoreExpenses(member, month),
  ]);
  return (
    <div className="space-y-6">
      <StoreSettingsView moneyRate={moneyRate} />
      {channels && <ChannelsSettings channels={channels} mesLabel={mesLabel} />}
      {expenses && <StoreExpensesSettings expenses={expenses} mesLabel={mesLabel} />}
    </div>
  );
}
