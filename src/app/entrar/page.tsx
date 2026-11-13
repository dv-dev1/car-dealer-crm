import { withAuth } from "@workos-inc/authkit-nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginView } from "@/features/auth/view";
import { ThemeScope } from "@/themes/ThemeScope";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ erro?: string | string[] }> }) {
  const { user } = await withAuth();
  if (user) redirect("/gestao");

  const { erro } = await searchParams;
  // Read per request on the server: the build does not see .dev.vars or `wrangler secret`, so a
  // client-side process.env.NEXT_PUBLIC_* would be empty.
  return (
    <ThemeScope theme="autohub">
      <LoginView turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} googleFailed={erro === "google"} />
    </ThemeScope>
  );
}
