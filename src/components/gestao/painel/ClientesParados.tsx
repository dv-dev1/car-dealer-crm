import Link from "next/link";
import type { StaleLead } from "@/features/leads/contacts";

/** Clientes abertos sem contato há mais dias do que a loja aceita: os cinco que esperam há mais tempo. */
export function ClientesParados({ leads, days }: { leads: StaleLead[]; days: number }) {
  if (leads.length === 0) return null;
  return (
    <section className="rounded-[var(--radius)] border border-warning/25 bg-warning-bg px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-warning-ink">
          {leads.length === 1 ? "1 cliente parado" : `${leads.length} clientes parados`}
        </p>
        <p className="text-xs text-warning-ink">sem contato há mais de {days === 1 ? "1 dia" : `${days} dias`}</p>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-secondary">
        {leads.slice(0, 5).map((lead) => (
          <li key={lead.id} className="flex flex-wrap justify-between gap-x-3">
            <span>
              <span className="font-medium">{lead.name}</span>
              <span className="text-muted-strong"> · {lead.mine ? "seu cliente" : (lead.sellerName ?? "sem vendedor")}</span>
            </span>
            <span className="tabular-nums text-muted-strong">há {lead.days} dias</span>
          </li>
        ))}
      </ul>
      <Link href="/gestao/clientes" className="mt-2 inline-block text-sm font-semibold text-warning-ink underline underline-offset-2 hover:no-underline">
        {leads.length > 5 ? `Ver os ${leads.length} no funil` : "Abrir o funil"}
      </Link>
    </section>
  );
}
