"use client";

import { useState, type DragEvent } from "react";
import { ETAPAS, type Etapa, type EstagioFunil, type Lead } from "@/data/clientes-mock";
import { LeadCard } from "./LeadCard";
import { ZonaFechamento } from "./ZonaFechamento";

const ATIVAS: Etapa[] = ETAPAS.filter((e) => !e.fechada);

/** Alvos que aceitam um card: as 4 etapas ativas + as 2 zonas de fechamento. */
export type Alvo = EstagioFunil;

/** Handlers de drop que a coluna e a zona de fechamento recebem prontos. */
export interface PropsDrop {
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

/**
 * Board do funil (desktop/tablet largo). Quatro colunas ativas + zonas de
 * fechamento embaixo.
 *
 * O arraste é o NATIVO do HTML5 (`draggable` + dataTransfer), não uma biblioteca:
 * quem move o card na tela é o próprio navegador, que desenha a imagem fantasma
 * seguindo o cursor. Sem sensor, sem limiar de ativação, sem overlay em portal —
 * a camada que antes precisava engatar antes do primeiro pixel de feedback, e
 * não engatava.
 *
 * As setas ◀ ▶ no card fazem a mesma coisa por clique: quem não quiser (ou não
 * puder) arrastar tem o mesmo resultado, e o teclado funciona de graça.
 */
export function BoardFunil({
  leads,
  vendasMes,
  perdasMes,
  onMover,
  onFechar,
  onEditar,
}: {
  leads: Lead[];
  vendasMes: number;
  perdasMes: number;
  onMover: (id: string, destino: EstagioFunil) => void;
  onFechar: (lead: Lead, tipo: "vendeu" | "nao-comprou") => void;
  onEditar: (lead: Lead) => void;
}) {
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [sobre, setSobre] = useState<Alvo | null>(null);

  function soltarEm(id: string, alvo: Alvo) {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.estagio === alvo) return;

    if (alvo === "vendeu" || alvo === "nao-comprou") {
      onFechar(lead, alvo);
      return;
    }
    onMover(id, alvo);
  }

  /** Um alvo de drop. `preventDefault` no dragOver é obrigatório — sem ele o
   *  navegador recusa o drop e o card volta pro lugar. */
  function propsDrop(alvo: Alvo): PropsDrop {
    return {
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setSobre((atual) => (atual === alvo ? atual : alvo));
      },
      // relatedTarget é pra onde o cursor foi: se ainda está dentro do próprio
      // alvo (passou por cima de um card filho), não apaga o destaque.
      onDragLeave: (e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setSobre((atual) => (atual === alvo ? null : atual));
      },
      onDrop: (e) => {
        e.preventDefault();
        setSobre(null);
        setArrastandoId(null);
        const id = e.dataTransfer.getData("text/plain");
        if (id) soltarEm(id, alvo);
      },
    };
  }

  function moverEtapa(lead: Lead, direcao: -1 | 1) {
    const i = ATIVAS.findIndex((e) => e.id === lead.estagio);
    const destino = ATIVAS[i + direcao];
    if (destino) onMover(lead.id, destino.id);
  }

  return (
    <div onDragEnd={() => { setArrastandoId(null); setSobre(null); }}>
      <div className="grid grid-cols-4 gap-3">
        {ATIVAS.map((etapa) => (
          <Coluna
            key={etapa.id}
            etapa={etapa}
            leads={leads.filter((l) => l.estagio === etapa.id)}
            arrastandoId={arrastandoId}
            aceso={sobre === etapa.id}
            drop={propsDrop(etapa.id)}
            onComecar={setArrastandoId}
            onEditar={onEditar}
            onMoverEtapa={moverEtapa}
          />
        ))}
      </div>

      <ZonaFechamento
        vendasMes={vendasMes}
        perdasMes={perdasMes}
        arrastando={!!arrastandoId}
        sobre={sobre}
        dropVendeu={propsDrop("vendeu")}
        dropNaoComprou={propsDrop("nao-comprou")}
      />
    </div>
  );
}

function Coluna({
  etapa,
  leads,
  arrastandoId,
  aceso,
  drop,
  onComecar,
  onEditar,
  onMoverEtapa,
}: {
  etapa: Etapa;
  leads: Lead[];
  arrastandoId: string | null;
  aceso: boolean;
  drop: PropsDrop;
  onComecar: (id: string | null) => void;
  onEditar: (lead: Lead) => void;
  onMoverEtapa: (lead: Lead, direcao: -1 | 1) => void;
}) {
  return (
    <section
      className="flex flex-col"
      aria-label={`Etapa ${etapa.label}, ${leads.length} ${
        leads.length === 1 ? "cliente" : "clientes"
      }`}
    >
      {/* Cabeçalho */}
      <header
        className="flex items-center justify-between rounded-t-[var(--radius)] px-3 py-2 text-on-primary"
        style={{ backgroundColor: etapa.cor }}
      >
        <span className="text-sm font-semibold">{etapa.label}</span>
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[color-mix(in_srgb,var(--on-primary)_20%,transparent)] px-1.5 text-xs font-semibold tabular-nums">
          {leads.length}
        </span>
      </header>

      {/* Corpo — alvo do drop */}
      <div
        {...drop}
        className={`flex flex-1 flex-col gap-2.5 rounded-b-[var(--radius)] border border-t-0 p-2.5 transition-colors duration-150 ${
          aceso ? "border-primary bg-primary/5" : "border-line bg-sand/35"
        }`}
        style={{ minHeight: 200 }}
      >
        {leads.map((lead) => (
          <CartaArrastavel
            key={lead.id}
            lead={lead}
            arrastando={arrastandoId === lead.id}
            onComecar={onComecar}
            onEditar={onEditar}
            onMoverEtapa={onMoverEtapa}
          />
        ))}

        {leads.length === 0 && (
          <div className="grid flex-1 place-items-center rounded-[calc(var(--radius)-4px)] border border-dashed border-line px-3 py-6 text-center">
            <p className="text-xs text-muted">{aceso ? "Solte aqui" : "Vazio"}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function CartaArrastavel({
  lead,
  arrastando,
  onComecar,
  onEditar,
  onMoverEtapa,
}: {
  lead: Lead;
  arrastando: boolean;
  onComecar: (id: string | null) => void;
  onEditar: (lead: Lead) => void;
  onMoverEtapa: (lead: Lead, direcao: -1 | 1) => void;
}) {
  return (
    // SEM animação de posição aqui, de propósito.
    //
    // Já teve: um wrapper com `layout` do framer-motion, pra o card deslizar
    // até a coluna nova. Custou um card que pisca ao abrir qualquer modal —
    // `layout` reage a QUALQUER mudança de layout da página, e todo modal do
    // projeto trava a rolagem enquanto abre. É o segundo problema que esse
    // card tem por causa de animação de posição (o primeiro travou o arraste
    // inteiro na rodada 1).
    //
    // O deslize era enfeite; o card não piscar é requisito. Este card é a peça
    // mais usada do sistema — ela fica quieta.
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        e.dataTransfer.effectAllowed = "move";
        // Adiado um tique: o navegador tira o retrato do card pro fantasma
        // AGORA, e se ele já estivesse esmaecido o fantasma sairia apagado.
        setTimeout(() => onComecar(lead.id), 0);
      }}
      onDragEnd={() => onComecar(null)}
      className={`cursor-grab rounded-[calc(var(--radius)-2px)] transition-opacity duration-150 active:cursor-grabbing ${
        arrastando ? "opacity-40" : ""
      }`}
    >
      <LeadCard lead={lead} onEditar={onEditar} onMoverEtapa={onMoverEtapa} />
    </div>
  );
}
