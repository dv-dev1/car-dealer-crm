import { requireMember } from "@/features/auth/guard";
import { listMembers } from "@/features/team/model";
import { TeamView } from "@/features/team/view";

export default async function TeamPage() {
  const member = await requireMember();
  return <TeamView members={await listMembers(member)} role={member.role} />;
}
