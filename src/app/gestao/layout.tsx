import type { Metadata } from "next";
import { GestaoShell } from "@/components/gestao/GestaoShell";
import { requireMember } from "@/features/auth/guard";
import { ThemeScope } from "@/themes/ThemeScope";

// Área interna dos vendedores. `noindex` reforça que o público nunca a
// encontra por busca.
export const metadata: Metadata = {
  title: "Gestão",
  robots: { index: false, follow: false },
};

export default async function GestaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Next skips layouts on soft navigation, so every page calls requireMember() too.
  await requireMember();
  // Every store gets the Auto Hub theme until a client store has its own; then it comes from the member's store.
  return (
    <ThemeScope theme="autohub">
      <GestaoShell>{children}</GestaoShell>
    </ThemeScope>
  );
}
