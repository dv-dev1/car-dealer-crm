"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { atendentes, whatsappLinkPara } from "@/lib/loja";
import { WhatsappIcon } from "../WhatsappIcon";

// Easing de assinatura da marca (ease-out-expo). Mesmo do --ease-brand no CSS.
const EASE_BRAND: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Iniciais pro monograma do avatar (diferencia os atendentes em vez de um
// ícone-carimbo igual pra todos). "Cassiano Veículos" → CV, "Afonso" → A.
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/**
 * Painel "Fale com a gente": lista os atendentes da loja; a pessoa escolhe um e
 * cai no WhatsApp dele já com a mensagem pré-pronta. Nasce do canto (do FAB) no
 * desktop e vira bottom sheet no mobile.
 *
 * Marca: avatares em monograma caramelo (identidade Cassiano) + selo verde do
 * WhatsApp no cabeçalho (afordância). Acessível: role="dialog" + aria-modal,
 * foco inicial no primeiro atendente, Esc fecha, Tab preso, foco devolvido ao
 * gatilho, scroll travado. Motion respeita prefers-reduced-motion (só fade).
 */
export function WhatsappChooser({
  aberto,
  mensagem,
  onClose,
}: {
  aberto: boolean;
  mensagem?: string;
  onClose: () => void;
}) {
  const reduzir = useReducedMotion();
  const painelRef = useRef<HTMLDivElement>(null);
  const gatilhoAnterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (aberto) {
      gatilhoAnterior.current = document.activeElement as HTMLElement | null;
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    document.body.style.overflow = "hidden";

    const foco = window.setTimeout(() => {
      painelRef.current
        ?.querySelector<HTMLElement>("[data-atendente]")
        ?.focus();
    }, 20);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const alvos = painelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        );
        if (!alvos || alvos.length === 0) return;
        const primeiro = alvos[0];
        const ultimo = alvos[alvos.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(foco);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto, onClose]);

  useEffect(() => {
    if (!aberto && gatilhoAnterior.current) {
      gatilhoAnterior.current.focus?.();
      gatilhoAnterior.current = null;
    }
  }, [aberto]);

  const painelVariants = reduzir
    ? {
        inicial: { opacity: 0 },
        animar: { opacity: 1 },
        sair: { opacity: 0 },
      }
    : {
        inicial: { opacity: 0, scale: 0.96, y: 8 },
        animar: { opacity: 1, scale: 1, y: 0 },
        sair: { opacity: 0, scale: 0.98, y: 6 },
      };

  return (
    <AnimatePresence>
      {aberto && [
        <motion.div
          key="scrim"
          className="fixed inset-0 z-50 bg-secondary/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE_BRAND }}
          onClick={onClose}
          aria-hidden="true"
        />,
        <motion.div
          key="painel"
          ref={painelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wpp-chooser-titulo"
          variants={painelVariants}
          initial="inicial"
          animate="animar"
          exit="sair"
          transition={{ duration: 0.2, ease: EASE_BRAND }}
          className="fixed z-50 flex flex-col overflow-hidden bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.22)] inset-x-0 bottom-0 origin-bottom rounded-t-[calc(var(--radius)*1.5)] sm:inset-x-auto sm:bottom-24 sm:right-5 sm:w-[360px] sm:origin-bottom-right sm:rounded-[calc(var(--radius)*1.5)]"
        >
          {/* Grab handle — só no bottom sheet (mobile). */}
          <div
            aria-hidden="true"
            className="mx-auto mt-2.5 h-1.5 w-9 shrink-0 rounded-full bg-line sm:hidden"
          />

          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-whatsapp/12 text-whatsapp"
            >
              <WhatsappIcon size={18} />
            </span>
            <div className="flex-1">
              <h2
                id="wpp-chooser-titulo"
                className="text-base font-semibold text-secondary"
              >
                Fale com a gente
              </h2>
              <p className="mt-0.5 text-sm text-secondary/70">
                Escolha com quem deseja conversar
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="-mr-1.5 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-secondary/70 transition-colors duration-200 hover:bg-sand hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X size={18} />
            </button>
          </div>

          <ul className="max-h-[min(60vh,460px)] overflow-y-auto py-1.5 [padding-bottom:max(0.375rem,env(safe-area-inset-bottom))] sm:[padding-bottom:0.375rem]">
            {atendentes.map((a) => (
              <li key={a.numero}>
                <a
                  data-atendente
                  href={whatsappLinkPara(a.numero, mensagem)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex items-center gap-3.5 px-5 py-3 transition-colors duration-200 hover:bg-primary/8 focus-visible:bg-primary/8 focus-visible:outline-none"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                    {iniciais(a.nome)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-secondary">
                      {a.nome}
                    </span>
                    <span className="block truncate text-sm text-secondary/70">
                      {a.papel ? (
                        <>
                          <span className="font-medium text-secondary/85">
                            {a.papel}
                          </span>{" "}
                          · {a.label}
                        </>
                      ) : (
                        a.label
                      )}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </motion.div>,
      ]}
    </AnimatePresence>
  );
}
