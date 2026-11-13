import type { ReactNode } from "react";

import { TemaGestao } from "@/components/gestao/TemaGestao";
import { autohubFont } from "./autohub/font";

// Aplica o tema salvo ANTES da primeira pintura. Sem isso a tela pisca branca
// a cada navegação pra quem usa o escuro (o React só assumiria depois de
// hidratar). Fica inline de propósito: um arquivo externo chegaria tarde.
// `escuro` é o único valor que liga o tema; qualquer outra coisa cai no claro.
// The key must match CHAVE in lib/tema.ts.
function initialScript(theme: string) {
  return `
var d = document.documentElement;
d.dataset.theme = ${JSON.stringify(theme)};
try {
  if (localStorage.getItem("gestao.tema") === "escuro") d.dataset.tema = "escuro";
} catch (e) {}
`;
}

/**
 * Wraps a screen of the panel area (/gestao, /entrar, /sem-acesso) in a visual
 * theme: `<html data-theme>` switches the tokens (src/themes/<name>/theme.css),
 * and the div carries the theme font variable. `display: contents` keeps the
 * div out of the layout.
 */
export function ThemeScope({ theme, children }: { theme: "autohub"; children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: initialScript(theme) }} />
      <TemaGestao theme={theme} />
      <div data-theme-scope className={`${autohubFont.variable} contents`}>
        {children}
      </div>
    </>
  );
}
