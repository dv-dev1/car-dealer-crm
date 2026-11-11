import { RelatoriosView } from "./RelatoriosView";
import { requireMember } from "@/features/auth/guard";

export default async function RelatoriosPage() {
  await requireMember();
  return <RelatoriosView />;
}
