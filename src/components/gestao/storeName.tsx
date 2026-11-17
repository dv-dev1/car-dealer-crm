"use client";

import { createContext, useContext, type ReactNode } from "react";

// The store's name from the database, given by the panel shell to the screens that write as the store.
const StoreNameContext = createContext("");

export function StoreNameProvider({ name, children }: { name: string; children: ReactNode }) {
  return <StoreNameContext.Provider value={name}>{children}</StoreNameContext.Provider>;
}

export function useStoreName(): string {
  return useContext(StoreNameContext);
}

/** The first WhatsApp message to a client, signed by the store. */
export function mensagemDaLoja(nomeCliente: string, loja: string): string {
  return `Olá ${nomeCliente.split(" ")[0]}, aqui é da ${loja} 👋`;
}
