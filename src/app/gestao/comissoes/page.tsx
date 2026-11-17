import type { Metadata } from "next";

import { requireMember } from "@/features/auth/guard";
import { listCommissions, listRules } from "@/features/commissions/model";
import { CommissionsView } from "@/features/commissions/view";
import { listSellers } from "@/features/leads/model";
import { lerPeriodo, rotuloPeriodo } from "@/features/reports/rules";
import { todayIso } from "@/shared/today";

export const metadata: Metadata = { title: "Comissões" };

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const member = await requireMember();
  const params = await searchParams;
  const { periodo, janela } = lerPeriodo({ periodo: first(params.periodo), de: first(params.de), ate: first(params.ate) }, todayIso());
  const [data, rules, sellers] = await Promise.all([
    listCommissions(member, janela),
    listRules(member),
    member.role === "seller" ? [] : listSellers(member),
  ]);
  return <CommissionsView role={member.role} data={data} rules={rules} sellers={sellers} rotulo={rotuloPeriodo(periodo, janela)} />;
}
