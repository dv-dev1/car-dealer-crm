import type { ReactNode } from "react";

/**
 * Revela o bloco ao carregar, com um atraso proporcional à posição — os cards
 * de uma faixa entram em cascata curta em vez de aparecerem todos de uma vez.
 *
 * A animação é CSS (`.entra` no globals.css), não JS. Isso não é detalhe: uma
 * revelação feita com estado do React serializa `opacity: 0` no HTML do
 * servidor, e se o JS não rodar a tela chega montada e INVISÍVEL — foi
 * exatamente o que aconteceu aqui quando o Next bloqueava os chunks por origem
 * cruzada. Com keyframes, o pior caso é aparecer sem animar. O globals.css
 * ainda desliga tudo em `@media print`, pra o "Exportar PDF" não sair pela
 * metade.
 *
 * Contenção deliberada: 24px de deslocamento e ~45ms entre irmãos, travando na
 * 4ª peça. Quem abre esta tela 80 vezes por dia não pode esperar coreografia.
 *
 * Sem "use client": é só uma classe e uma variável CSS.
 */
export function AoEntrar({
  children,
  ordem = 0,
  className = "",
}: {
  children: ReactNode;
  /** Posição na faixa — vira o atraso da cascata. */
  ordem?: number;
  className?: string;
}) {
  return (
    <div
      className={`entra ${className}`}
      style={{ "--entra-atraso": `${Math.min(ordem, 4) * 45}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
