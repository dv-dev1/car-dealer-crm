import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { cache } from "react";

import { resolveMembership, type MemberContext, type Role } from "@/shared/db/client";

// cache() shares one read among the layout and the page of one request; a new request reads again,
// so a removed member loses access on the next request. Outside a React server render it does not memoize.
// No try/catch: redirect() throws for control flow, and a database error must reach Next as an error.
export const requireMember = cache(async (): Promise<MemberContext> => {
  const { user } = await withAuth();
  if (!user) redirect("/entrar");
  const member = await resolveMembership({
    workosUserId: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
  });
  if (!member) redirect("/sem-acesso");
  return member;
});

export async function requireRole(allowed: Role[]): Promise<MemberContext> {
  const member = await requireMember();
  if (!allowed.includes(member.role)) redirect("/gestao");
  return member;
}
