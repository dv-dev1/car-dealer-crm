"use client";

import { useLayoutEffect } from "react";
import { activateTheme, esquecerTema } from "@/lib/tema";

/**
 * Owns the lifetime of the dark theme. Mounted by <ThemeScope> on /gestao,
 * /entrar and /sem-acesso, it unmounts when the person leaves those screens,
 * and only then is `data-tema` cleared, so the public site (always light)
 * does not inherit the dark theme on a client-side navigation.
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
