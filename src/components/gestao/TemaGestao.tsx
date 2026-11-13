"use client";

import { useLayoutEffect } from "react";
import { activateTheme, esquecerTema } from "@/lib/tema";

/**
 * Dono do tempo de vida do tema escuro. Montado uma vez pelo layout da gestão,
 * some quando a pessoa sai da área — e é só nessa hora que o `data-tema` é
 * limpo, pra o site público (que é claro sempre) não herdar o escuro numa
 * navegação client-side.
 *
 * Existe porque essa limpeza morava no alternador da sidebar, que aparece duas
 * vezes na tela e entra e sai junto com o menu do celular: fechar o menu
 * apagava o tema da página inteira.
 *
 * It also owns `data-theme`: set on mount (a client-side navigation into the
 * area never runs ThemeScope's inline script) and cleared with `data-tema`.
 * Layout effect so both happen before paint, and so the cleanup of the screen
 * being left (/entrar after login) runs before the mount of the next one.
 */
export function TemaGestao({ theme }: { theme: string }) {
  useLayoutEffect(() => {
    activateTheme(theme);
    return esquecerTema;
  }, [theme]);
  return null;
}
