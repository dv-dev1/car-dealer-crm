"use client";

import { Car } from "lucide-react";
import { WhatsappIcon } from "@/components/WhatsappIcon";
import { whatsappLinkPara } from "@/lib/loja";
import { diaPorExtenso } from "@/lib/hoje";
import { TIPO_EVENTO, type EventoAgenda } from "@/data/agenda";

function primeiroNome(nome: string) {
  return nome.split(" ")[0];
}

/** Linha de um evento — reusada no painel do dia e na lista. */
export function EventoItem({ evento }: { evento: EventoAgenda }) {
  const t = TIPO_EVENTO[evento.tipo];
  const msg = `Olá ${primeiroNome(evento.lead.nome)}, aqui é da Cassiano Veículos 👋`;
  return (
    <div className="flex items-center gap-3 rounded-[calc(var(--radius)-2px)] border border-line bg-surface p-3">
      <span
        className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: t.cor }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-secondary">
          {evento.lead.nome}
        </p>
        <p className="mt-0.5 text-xs font-medium" style={{ color: t.tinta }}>
          {t.label}
        </p>
        {evento.lead.carro && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-strong">
            <Car size={12} strokeWidth={1.8} className="shrink-0" />
            <span className="truncate">{evento.lead.carro}</span>
          </p>
        )}
      </div>
      <a
        href={whatsappLinkPara(evento.lead.telefone, msg)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Chamar ${primeiroNome(evento.lead.nome)} no WhatsApp`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[calc(var(--radius)-5px)] bg-whatsapp text-white transition-colors duration-200 hover:bg-whatsapp-hover"
      >
        <WhatsappIcon className="h-4 w-4" />
      </a>
    </div>
  );
}

/**
 * Vista em lista (aba "Agenda"): retornos atrasados no topo (o que pega fogo),
 * depois os próximos agendamentos agrupados por dia. Forward-looking — o
 * histórico completo mora na vista de mês.
 */
export function AgendaLista({
  eventos,
  hojeIso,
}: {
  eventos: EventoAgenda[];
  hojeIso: string;
}) {
  const atrasados = eventos.filter(
    (e) => e.tipo === "retorno" && e.data < hojeIso,
  );
  const futuros = eventos.filter((e) => e.data >= hojeIso);

  // Agrupa os futuros por dia (já vêm ordenados por data).
  const grupos = new Map<string, EventoAgenda[]>();
  for (const e of futuros) {
    const arr = grupos.get(e.data);
    if (arr) arr.push(e);
    else grupos.set(e.data, [e]);
  }

  if (atrasados.length === 0 && futuros.length === 0) {
    return (
      <div className="grid place-items-center rounded-[var(--radius)] border border-dashed border-line bg-surface px-6 py-16 text-center">
        <p className="text-sm font-medium text-secondary">Agenda livre.</p>
        <p className="mt-1 max-w-xs text-sm text-muted-strong">
          Marque uma visita ou um retorno num lead do funil que ele aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {atrasados.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-danger-ink">
            Retornos atrasados
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger-bg px-1.5 text-xs font-semibold tabular-nums text-danger-ink">
              {atrasados.length}
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {atrasados.map((e) => (
              <EventoItem key={e.id} evento={e} />
            ))}
          </div>
        </section>
      )}

      {[...grupos.entries()].map(([dia, evs]) => (
        <section key={dia}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-secondary">
            {diaPorExtenso(dia)}
            {dia === hojeIso && (
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                hoje
              </span>
            )}
          </h2>
          <div className="flex flex-col gap-2">
            {evs.map((e) => (
              <EventoItem key={e.id} evento={e} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
