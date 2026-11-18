"use client";

import { useId, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { WhatsappIcon } from "@/components/WhatsappIcon";
import { draftMessageAction } from "@/features/ai/actions";
import { MESSAGE_KIND_LABEL, type MessageKind } from "@/features/ai/rules";
import type { Lead } from "@/features/leads/types";
import { whatsappLinkPara } from "@/lib/loja";

import { tapContact } from "./contato";

type Draft = { kind: MessageKind; text: string };

/**
 * The AI writes the WhatsApp message for this client by the stage and the history; the person edits it and sends.
 * Sending opens WhatsApp with the text and records the contact. Nothing shows for a client without a phone.
 */
export function MensagemIA({
  lead,
  inicial,
  className = "mt-5 border-t border-line pt-4",
}: {
  lead: Pick<Lead, "id" | "nome" | "telefone" | "canEdit">;
  inicial?: Draft;
  className?: string;
}) {
  const campo = useId();
  const [draft, setDraft] = useState<Draft | null>(inicial ?? null);
  const [erro, setErro] = useState<string | null>(null);
  const [escrevendo, iniciar] = useTransition();
  if (!lead.telefone) return null;

  function escrever() {
    setErro(null);
    iniciar(async () => {
      try {
        const result = await draftMessageAction(lead.id);
        if ("error" in result) setErro(result.error);
        else setDraft(result);
      } catch {
        setErro("Não deu para escrever a mensagem. Confira a internet e tente de novo.");
      }
    });
  }

  return (
    <section className={className}>
      <button
        type="button"
        onClick={escrever}
        disabled={escrevendo}
        className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2 text-sm font-semibold text-secondary hover:border-primary disabled:opacity-60"
      >
        <Sparkles size={16} strokeWidth={1.8} />
        {escrevendo ? "Escrevendo…" : draft ? "Escrever outra" : "Escrever mensagem com IA"}
      </button>
      {erro && <p role="alert" className="mt-2 text-sm text-danger-ink">{erro}</p>}
      {draft && (
        <div className="mt-3">
          <label htmlFor={campo} className="text-sm font-medium text-secondary">
            Mensagem ({MESSAGE_KIND_LABEL[draft.kind]})
          </label>
          <textarea
            id={campo}
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
            rows={5}
            className="mt-1.5 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary focus:border-primary focus:outline-none"
          />
          <a
            href={whatsappLinkPara(lead.telefone, draft.text)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => tapContact(lead, "whatsapp")}
            className="mt-2 inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-whatsapp px-3 py-2 text-sm font-semibold text-white hover:bg-whatsapp-hover"
          >
            <WhatsappIcon className="h-4 w-4" />
            Enviar no WhatsApp
          </a>
        </div>
      )}
    </section>
  );
}
