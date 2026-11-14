import { withAuth } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { UUID, resolveMembership, withStore, type Role, type StoreMember } from "@/shared/db/client";

// The member the owner of a demo store chose in "Ver como"; read only there.
export const VIEW_AS_COOKIE = "view_as";
export type PanelMember = StoreMember & { viewingAs: boolean };

// cache() shares one read among the layout and the page of one request; a new request reads again,
// so a removed member loses access on the next request. Outside a React server render it does not memoize.
// No try/catch: redirect() throws for control flow, and a database error must reach Next as an error.
const realMember = cache(async (): Promise<StoreMember> => {
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

// The effective member: in a demo store the owner may see the panel as someone of the team.
export const requireMember = cache(async (): Promise<PanelMember> => {
  const real = await realMember();
  if (real.role !== "owner" || !real.isDemo) return { ...real, viewingAs: false };
  const chosen = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!chosen || !UUID.test(chosen) || chosen === real.membershipId) return { ...real, viewingAs: false };
  // RLS limits the lookup to the owner's store: a member of another store is not found.
  const [member] = await withStore(real, (db) =>
    db.query<{ name: string; role: Role }>("select name, role from memberships where id = $1", [chosen]),
  );
  if (!member) return { ...real, viewingAs: false };
  return { ...real, membershipId: chosen, role: member.role, name: member.name, viewingAs: true };
});

export async function requireRole(allowed: Role[]): Promise<PanelMember> {
  const member = await requireMember();
  if (!allowed.includes(member.role)) redirect("/gestao");
  return member;
}

// "Restaurar demo" and "Ver como" act as the real owner, whoever they are viewing as.
export async function requireDemoOwner(): Promise<StoreMember> {
  const real = await realMember();
  if (real.role !== "owner" || !real.isDemo) redirect("/gestao");
  return real;
}
