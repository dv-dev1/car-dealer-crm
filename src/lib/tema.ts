"use client";

// ─── TEMA DA ÁREA DE GESTÃO ──────────────────────────────────────
// Claro/escuro só do painel interno — o site público é claro sempre.
// O valor vive no <html data-tema>, que é onde o globals.css escuta, e a
// escolha persiste no localStorage. A primeira pintura é resolvida por um
// script inline em app/gestao/layout.tsx (anti-flash); aqui mora a troca.
//
// ─── Por que é um store de módulo, e não useState ────────────────
//
// O alternador aparece DUAS vezes ao mesmo tempo: na sidebar do desktop (que
// no celular não some, só fica escondida por CSS) e dentro do drawer do
// celular. Com estado local, as duas cópias não se falavam:
//
//   · trocar o tema numa não mexia no rótulo da outra;
//   · e o cleanup do efeito — que existe pra o site público não herdar o
//     escuro — rodava quando QUALQUER cópia desmontava. Fechar o menu do
//     celular apagava o data-tema e a tela inteira voltava pro claro sozinha,
//     enquanto o botão continuava anunciando "Tema claro".
//
// Uma fonte só, no módulo, resolve os dois: todas as cópias leem o mesmo
// valor e reagem juntas. Mesmo padrão do store de leads (clientes-store.ts).
//
// Limpar o data-tema ao sair da gestão virou responsabilidade de quem tem o
// tempo de vida certo pra isso — <TemaGestao/>, montado uma vez pelo layout —
// e não de um botão que entra e sai da tela.

import { useCallback, useSyncExternalStore } from "react";

export type Tema = "claro" | "escuro";

const CHAVE = "cassiano.tema";

/** `null` = ainda não lemos o navegador (servidor, ou antes da 1ª montagem). */
let atual: Tema | null = null;
const ouvintes = new Set<() => void>();

function emitir() {
  for (const cb of ouvintes) cb();
}

function aplicar(tema: Tema) {
  const raiz = document.documentElement;
  if (tema === "escuro") raiz.dataset.tema = "escuro";
  else delete raiz.dataset.tema;
}

function lerSalvo(): Tema {
  try {
    return localStorage.getItem(CHAVE) === "escuro" ? "escuro" : "claro";
  } catch {
    return "claro";
  }
}

function subscribe(cb: () => void) {
  ouvintes.add(cb);
  if (atual === null) {
    atual = lerSalvo();
    aplicar(atual);
    emitir(); // re-renderiza com o valor lido após a 1ª montagem
  }
  return () => {
    ouvintes.delete(cb);
  };
}

const getSnapshot = () => atual;
// O servidor não tem como saber a preferência salva. Devolver null aqui é o
// que faz a hidratação bater — quem chama trata null como "ainda não sei".
const getServerSnapshot = (): Tema | null => null;

/** Limpa o tema. Só o <TemaGestao/> chama, ao sair da área de gestão. */
export function esquecerTema() {
  atual = null;
  delete document.documentElement.dataset.tema;
  emitir();
}

/**
 * Tema da gestão. Devolve `null` enquanto não montou — quem chama usa isso pra
 * não renderizar o ícone no servidor e cair em mismatch de hidratação.
 */
export function useTema() {
  const tema = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const trocar = useCallback(() => {
    const proximo: Tema = atual === "escuro" ? "claro" : "escuro";
    atual = proximo;
    aplicar(proximo);
    try {
      localStorage.setItem(CHAVE, proximo);
    } catch {
      /* modo privado — vale só nesta sessão */
    }
    emitir();
  }, []);

  return { tema, trocar };
}
