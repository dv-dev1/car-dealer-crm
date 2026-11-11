import { withAuth } from "@workos-inc/authkit-nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signOutAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Sem acesso", robots: { index: false, follow: false } };

// Never calls requireMember(): it is where requireMember() sends a person without a store.
export default async function SemAcessoPage() {
  const { user } = await withAuth();
  if (!user) redirect("/entrar");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6 rounded-[var(--radius)] border border-line bg-surface p-6">
        <p className="text-secondary">
          Seu e-mail ainda não tem acesso a nenhuma loja. Peça ao dono da loja para cadastrar você.
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-surface"
          >
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
