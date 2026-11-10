import type { LucideIcon } from "lucide-react";

type Tom = "neutro" | "sucesso" | "alerta" | "perigo";

const TOM: Record<Tom, { circulo: string; icone: string; numero: string }> = {
  neutro: { circulo: "bg-sand", icone: "text-secondary/55", numero: "text-secondary" },
  sucesso: { circulo: "bg-success-bg", icone: "text-success", numero: "text-secondary" },
  alerta: { circulo: "bg-warning-bg", icone: "text-warning", numero: "text-warning-ink" },
  perigo: { circulo: "bg-danger-bg", icone: "text-danger", numero: "text-secondary" },
};

/**
 * Cartão de número do topo da lista (Disponíveis, Sem margem, Parados +90d).
 * Número grande à esquerda, ícone num círculo tingido à direita — leitura de
 * relance, sem gráfico decorativo. O tom só acende quando o número pede atenção.
 */
export function StatCard({
  label,
  valor,
  icon: Icon,
  tom = "neutro",
  legenda,
}: {
  label: string;
  valor: number | string;
  icon: LucideIcon;
  tom?: Tom;
  legenda?: string;
}) {
  const t = TOM[tom];
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-soft)]">
      <div className="min-w-0">
        <p className="text-[0.8rem] font-medium text-muted-strong">{label}</p>
        <p className={`mt-1 text-[1.9rem] font-semibold leading-none tabular-nums ${t.numero}`}>
          {valor}
        </p>
        {legenda && <p className="mt-1.5 text-xs text-muted-strong">{legenda}</p>}
      </div>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${t.circulo}`}>
        <Icon size={20} strokeWidth={1.9} className={t.icone} />
      </span>
    </div>
  );
}
