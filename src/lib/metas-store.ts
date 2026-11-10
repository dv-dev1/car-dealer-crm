"use client";

// ─── STORE DA META DO MÊS (Fase 2 — interno) ─────────────────────
// Guarda só um número: quantos carros a loja se propôs a vender no mês. Persiste
// no localStorage pra o gestor editar e não perder no refresh. As VENDAS não
// ficam aqui — elas são contadas do funil (clientes-store), como manda a régua
// "conta automático quando marca Vendido no funil". Quando o Supabase entrar,
// isto vira uma linha de config da loja.

import { useSyncExternalStore } from "react";
import { META_VENDAS_MES } from "@/data/vendas-mock";

const STORAGE_KEY = "cassiano.meta.v1";

let alvo: number = META_VENDAS_MES;
let hidratado = false;
const ouvintes = new Set<() => void>();

function emitir() {
  for (const cb of ouvintes) cb();
}

function hidratar() {
  if (hidratado) return;
  hidratado = true;
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (bruto != null) {
      const n = Number(bruto);
      if (Number.isFinite(n) && n > 0) alvo = Math.round(n);
    }
  } catch {
    /* localStorage indisponível — segue com o default */
  }
  try {
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      const n = Number(e.newValue);
      if (Number.isFinite(n) && n > 0) {
        alvo = Math.round(n);
        emitir();
      }
    });
  } catch {
    /* sem window (SSR) */
  }
}

function subscribe(cb: () => void) {
  ouvintes.add(cb);
  if (!hidratado) {
    hidratar();
    emitir();
  }
  return () => {
    ouvintes.delete(cb);
  };
}

function getSnapshot() {
  return alvo;
}

function getServerSnapshot() {
  return META_VENDAS_MES;
}

/** Meta de vendas do mês (reativa). */
export function useMeta(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Redefine a meta. Limita a um intervalo são (1..99) pra não quebrar a barra. */
export function definirMeta(n: number) {
  const valor = Math.min(99, Math.max(1, Math.round(n) || 1));
  alvo = valor;
  try {
    localStorage.setItem(STORAGE_KEY, String(valor));
  } catch {
    /* segue em memória */
  }
  emitir();
}
