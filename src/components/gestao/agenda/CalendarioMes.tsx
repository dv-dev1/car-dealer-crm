"use client";

import { useMemo } from "react";
import {
  DIAS_CURTO,
  diasNoMes,
  primeiroDiaSemana,
} from "@/lib/hoje";
import { TIPO_EVENTO, type EventoAgenda } from "@/data/agenda";

function primeiroNome(nome: string) {
  return nome.split(" ")[0];
}

/**
 * Grade mensal. Cada dia mostra até 2 eventos como pílulas coloridas (ardósia
 * = visita, âmbar = retorno) e "+N" quando sobra. Hoje ganha anel caramelo; o
 * dia selecionado, fundo tingido. Clicar num dia abre o painel do lado.
 */
export function CalendarioMes({
  ano,
  mes,
  eventos,
  hojeIso,
  diaSelecionado,
  onSelecionar,
}: {
  ano: number;
  mes: number;
  eventos: EventoAgenda[];
  hojeIso: string;
  diaSelecionado: string | null;
  onSelecionar: (iso: string) => void;
}) {
  // Eventos agrupados por dia ISO, uma vez.
  const porDia = useMemo(() => {
    const m = new Map<string, EventoAgenda[]>();
    for (const e of eventos) {
      const arr = m.get(e.data);
      if (arr) arr.push(e);
      else m.set(e.data, [e]);
    }
    return m;
  }, [eventos]);

  const total = diasNoMes(ano, mes);
  const offset = primeiroDiaSemana(ano, mes);
  const celulas: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const iso = (dia: number) =>
    `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface">
      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 border-b border-line bg-sand/40">
        {DIAS_CURTO.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-muted-strong"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Dias */}
      <div className="grid grid-cols-7">
        {celulas.map((dia, i) => {
          if (dia === null) {
            return <div key={`v-${i}`} className="min-h-[76px] border-b border-r border-line bg-sand/20 last:border-r-0 sm:min-h-[92px]" />;
          }
          const diaIso = iso(dia);
          const evs = porDia.get(diaIso) ?? [];
          const ehHoje = diaIso === hojeIso;
          const selecionado = diaIso === diaSelecionado;

          return (
            <button
              key={diaIso}
              type="button"
              onClick={() => onSelecionar(diaIso)}
              aria-pressed={selecionado}
              aria-label={`Dia ${dia}, ${evs.length} ${evs.length === 1 ? "agendamento" : "agendamentos"}`}
              className={`flex min-h-[76px] flex-col gap-1 border-b border-r border-line p-1.5 text-left transition-colors duration-150 last:border-r-0 sm:min-h-[92px] ${
                selecionado ? "bg-primary/8" : "bg-surface hover:bg-sand/50"
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${
                  ehHoje
                    ? "bg-primary text-white"
                    : selecionado
                      ? "text-primary"
                      : "text-secondary"
                }`}
              >
                {dia}
              </span>

              {/* Mobile: pontos coloridos (o nome não cabe em 375px sem virar
                  "JES…"); o tap abre o painel com o detalhe. */}
              {evs.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:hidden">
                  {evs.map((e) => (
                    <span
                      key={e.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: TIPO_EVENTO[e.tipo].cor }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              )}

              {/* sm+: pílulas nomeadas */}
              <div className="hidden flex-col gap-0.5 sm:flex">
                {evs.slice(0, 2).map((e) => {
                  const t = TIPO_EVENTO[e.tipo];
                  return (
                    <span
                      key={e.id}
                      title={`${t.label}: ${e.lead.nome}`}
                      className="truncate rounded-[4px] px-1 py-0.5 text-[0.62rem] font-semibold uppercase leading-tight"
                      style={{ backgroundColor: `${t.cor}24`, color: t.tinta }}
                    >
                      {primeiroNome(e.lead.nome)}
                    </span>
                  );
                })}
                {evs.length > 2 && (
                  <span className="px-1 text-[0.62rem] font-medium text-muted-strong">
                    +{evs.length - 2} mais
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
