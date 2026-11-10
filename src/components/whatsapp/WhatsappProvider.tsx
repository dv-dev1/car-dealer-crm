"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { WhatsappChooser } from "./WhatsappChooser";

// Estado compartilhado do seletor de atendentes. Fica no layout (envolve o site
// inteiro), então qualquer CTA de WhatsApp — em qualquer página — abre o mesmo
// painel, e ele é renderizado UMA vez só. A mensagem pré-pronta do CTA (a geral
// ou a de um carro específico) viaja junto pro atendente escolhido.

type WhatsappCtx = { abrir: (mensagem?: string) => void };

const Ctx = createContext<WhatsappCtx | null>(null);

export function useWhatsapp() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useWhatsapp precisa estar dentro de <WhatsappProvider>.");
  }
  return ctx;
}

export function WhatsappProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState<string | undefined>(undefined);

  const abrir = useCallback((msg?: string) => {
    setMensagem(msg);
    setAberto(true);
  }, []);

  const fechar = useCallback(() => setAberto(false), []);

  const valor = useMemo(() => ({ abrir }), [abrir]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <WhatsappChooser aberto={aberto} mensagem={mensagem} onClose={fechar} />
    </Ctx.Provider>
  );
}
