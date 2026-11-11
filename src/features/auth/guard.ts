import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

import { resolveMembership, type MemberContext, type Role } from "@/shared/db/client";

// Read on every call, never cached: a removed member loses access on the next request.
// No try/catch: redirect() throws for control flow, and a database error must reach Next as an error.
export async function requireMember(): Promise<MemberContext> {
  const { user } = await withAuth();
  if (!user) redirect("/entrar");
  const member = await resolveMembership({
    workosUserId: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
  });
  if (!member) redirect("/sem-acesso");
  return member;
}

export async function requireRole(allowed: Role[]): Promise<MemberContext> {
  const member = await requireMember();
  if (!allowed.includes(member.role)) redirect("/gestao");
  return member;
}
