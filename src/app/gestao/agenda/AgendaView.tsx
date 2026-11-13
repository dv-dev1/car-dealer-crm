"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HOJE_ISO, MESES, diaPorExtenso } from "@/lib/hoje";
import {
  eventosDeLeads,
  resumoAgenda,
  TIPO_EVENTO,
  type TipoEvento,
} from "@/data/agenda";
import { useLeads } from "@/lib/clientes-store";
import { CalendarioMes } from "@/components/gestao/agenda/CalendarioMes";
import { AgendaLista, EventoItem } from "@/components/gestao/agenda/AgendaLista";
import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";

const [HOJE_ANO, HOJE_MES] = (() => {
  const [a, m] = HOJE_ISO.split("-").map(Number);
  return [a, m - 1] as const;
})();

export function AgendaView() {
  const leads = useLeads();
  const [vista, setVista] = useState<"mes" | "agenda">("mes");
  const [ano, setAno] = useState(HOJE_ANO);
  const [mes, setMes] = useState(HOJE_MES);
  const [diaSelecionado, setDiaSelecionado] = useState<string>(HOJE_ISO);

  const eventos = useMemo(() => eventosDeLeads(leads), [leads]);
  const resumo = useMemo(() => resumoAgenda(eventos, HOJE_ISO), [eventos]);
  const doDia = useMemo(
    () => eventos.filter((e) => e.data === diaSelecionado),
    [eventos, diaSelecionado],
  );

  function passoMes(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 0) { m = 11; a -= 1; }
    if (m > 11) { m = 0; a += 1; }
    setMes(m);
    setAno(a);
  }

  function irHoje() {
    setAno(HOJE_ANO);
    setMes(HOJE_MES);
    setDiaSelecionado(HOJE_ISO);
  }

  return (
    <div>
      {/* "Agenda" e não "Calendário": o menu chama a seção de Agenda, e ter
          dois nomes pra mesma tela faz o vendedor achar que errou o clique. */}
      <CabecalhoGestao
        eyebrow="Central de gestão"
        titulo="Agenda"
        apoio="Veja por mês ou em lista. No mês, toque num dia pra ver os agendamentos."
        acoes={
          <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-line bg-surface p-1">
            {(["mes", "agenda"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                aria-pressed={vista === v}
                className={`rounded-[var(--radius-control)] px-4 py-1.5 text-sm font-medium transition-[background-color,color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] active:scale-[0.96] ${
                  vista === v
                    ? "bg-primary text-on-primary"
                    : "text-secondary/70 hover:text-secondary"
                }`}
              >
                {v === "mes" ? "Mês" : "Lista"}
              </button>
            ))}
          </div>
        }
      />

      {/* Faixa de resumo — antes eram quatro cards de 110px de altura, dois deles
          quase sempre em zero, empurrando o calendário (o conteúdo real) pra
          baixo da dobra. Mesma informação numa faixa, e zero fica cinza: só o
          que pede ação recebe cor. */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-line bg-line sm:grid-cols-4">
        <ItemResumo label="Visitas hoje" valor={resumo.visitasHoje} tom="sucesso" />
        <ItemResumo label="Retornos hoje" valor={resumo.retornosHoje} tom="alerta" />
        <ItemResumo label="Próximos 7 dias" valor={resumo.proximos7} />
        <ItemResumo label="Retornos atrasados" valor={resumo.retornosAtrasados} tom="perigo" />
      </div>

      {vista === "agenda" ? (
        <div className="mt-6">
          <AgendaLista eventos={eventos} hojeIso={HOJE_ISO} />
        </div>
      ) : (
        <>
          {/* Navegação de mês */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-secondary">
                {MESES[mes]} {ano}
              </h2>
              <button
                type="button"
                onClick={irHoje}
                className="rounded-[var(--radius-control)] border border-line bg-surface px-3 py-1 text-xs font-medium text-secondary transition-colors duration-200 hover:bg-sand"
              >
                Hoje
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => passoMes(-1)} aria-label="Mês anterior" className="grid h-8 w-8 place-items-center rounded-[var(--radius)] border border-line bg-surface text-muted transition-colors duration-200 hover:bg-sand hover:text-secondary">
                <ChevronLeft size={17} />
              </button>
              <button type="button" onClick={() => passoMes(1)} aria-label="Próximo mês" className="grid h-8 w-8 place-items-center rounded-[var(--radius)] border border-line bg-surface text-muted transition-colors duration-200 hover:bg-sand hover:text-secondary">
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px]">
            {/* Calendário + legenda */}
            <div>
              <CalendarioMes
                ano={ano}
                mes={mes}
                eventos={eventos}
                hojeIso={HOJE_ISO}
                diaSelecionado={diaSelecionado}
                onSelecionar={setDiaSelecionado}
              />
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {(Object.entries(TIPO_EVENTO) as [TipoEvento, (typeof TIPO_EVENTO)[TipoEvento]][]).map(
                  ([id, t]) => (
                    <span key={id} className="flex items-center gap-1.5 text-xs text-muted-strong">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.cor }} />
                      {t.label}
                    </span>
                  ),
                )}
              </div>
            </div>

            {/* Painel do dia */}
            <aside className="rounded-[var(--radius)] border border-line bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-secondary">
                  {diaPorExtenso(diaSelecionado)}
                </h3>
                {diaSelecionado === HOJE_ISO && (
                  <span className="rounded-[var(--radius-control)] bg-primary/12 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                    hoje
                  </span>
                )}
              </div>

              {doDia.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-strong">
                  Nada agendado nesse dia.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {doDia.map((e) => (
                    <EventoItem key={e.id} evento={e} />
                  ))}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Item da faixa de resumo. Zero fica cinza de propósito — numa agenda vazia,
 * quatro números coloridos gritando "0" só treinam o vendedor a ignorar a faixa.
 */
function ItemResumo({
  label,
  valor,
  tom,
}: {
  label: string;
  valor: number;
  tom?: "sucesso" | "alerta" | "perigo";
}) {
  const cor =
    valor === 0
      ? "text-muted"
      : tom === "sucesso"
        ? "text-success-ink"
        : tom === "alerta"
          ? "text-warning-ink"
          : tom === "perigo"
            ? "text-danger-ink"
            : "text-secondary";

  return (
    <div className="flex items-baseline gap-2 bg-surface px-4 py-3">
      <span className={`text-xl font-semibold leading-none tabular-nums ${cor}`}>{valor}</span>
      <span className="text-xs leading-tight text-muted-strong">{label}</span>
    </div>
  );
}
