import { withAuth } from "@workos-inc/authkit-nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NoAccessView } from "@/features/auth/view";
import { ThemeScope } from "@/themes/ThemeScope";

export const metadata: Metadata = { title: "Sem acesso", robots: { index: false, follow: false } };

// Never calls requireMember(): it is where requireMember() sends a person without a store.
export default async function SemAcessoPage() {
  const { user } = await withAuth();
  if (!user) redirect("/entrar");
  return (
    <ThemeScope theme="autohub">
      <NoAccessView />
    </ThemeScope>
  );
}
