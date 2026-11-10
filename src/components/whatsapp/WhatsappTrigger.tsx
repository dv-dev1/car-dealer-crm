"use client";

import type { ReactNode } from "react";
import { useWhatsapp } from "./WhatsappProvider";

// Gatilho reutilizável: mantém o estilo do CTA original (recebe className e
// children iguais), mas em vez de um <a> pro WhatsApp abre o seletor de
// atendentes. Substitui os <a href={whatsappLink(...)}> espalhados pelo site.

export function WhatsappTrigger({
  mensagem,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  mensagem?: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const { abrir } = useWhatsapp();
  return (
    <button
      type="button"
      onClick={() => abrir(mensagem)}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      className={className}
    >
      {children}
    </button>
  );
}
