import type { Metadata } from "next";
import { GestaoShell } from "@/components/gestao/GestaoShell";
import { requireDemoOwner, requireMember, type PanelMember } from "@/features/auth/guard";
import { getDemoPanel } from "@/features/demo/model";
import type { DemoPanelProps } from "@/features/demo/view";
import { todayIso } from "@/shared/today";
import { ThemeScope } from "@/themes/ThemeScope";

// Área interna dos vendedores. `noindex` reforça que o público nunca a
// encontra por busca.
export const metadata: Metadata = {
  title: "Gestão",
  robots: { index: false, follow: false },
};

// The demo block reads the real owner: while viewing as a seller the effective member is the seller.
async function demoPanel(member: PanelMember): Promise<DemoPanelProps> {
  const owner = await requireDemoOwner();
  return {
    ...(await getDemoPanel(owner)),
    today: todayIso(),
    selfId: owner.membershipId,
    viewing: member.viewingAs ? { membershipId: member.membershipId, name: member.name, role: member.role } : null,
  };
}

export default async function GestaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Next skips layouts on soft navigation, so every page calls requireMember() too.
  const member = await requireMember();
  const demo = member.viewingAs || (member.isDemo && member.role === "owner") ? await demoPanel(member) : null;
  // Every store gets the Auto Hub theme until a client store has its own; then it comes from the member's store.
  return (
    <ThemeScope theme="autohub">
      <GestaoShell storeName={member.storeName} demo={demo}>
        {children}
      </GestaoShell>
    </ThemeScope>
  );
}
