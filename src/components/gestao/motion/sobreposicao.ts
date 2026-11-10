// ─── MOVIMENTO DAS SOBREPOSIÇÕES (modais, diálogos, bottom sheets) ───
//
// Um modal é UM movimento, não dois. Véu e painel precisam entrar e sair como
// uma peça só — se destoarem, o olho lê como piscada, não como transição.
//
// Foi exatamente o que acontecia aqui. Medido quadro a quadro no Firefox:
//
//   FECHAMENTO (Esc em t=816ms)
//     t= 832  véu 0.51   painel presente, opaco    ← metade do escuro sumiu num quadro
//     t= 866  véu 0.153  painel presente, opaco    ← página 85% acesa, formulário inteiro lá
//     t= 966  véu 0      painel presente, opaco    ← véu acabou; painel continua sólido
//     t=1033  —          painel some de uma vez    ← 70ms depois, sem transição
//
// Duas causas somadas:
//
// 1. A curva `--ease-brand` (expo-out) despeja ~50% da mudança no PRIMEIRO
//    quadro. Ótima pra deslocamento, péssima pra opacidade de véu: em vez de
//    escurecer/clarear, ele pisca.
// 2. O painel não anima opacidade (decisão certa — ver abaixo), então aparece e
//    some binário. Sozinho isso passa; combinado com o véu fora de tempo, vira
//    "abre, fecha, abre".
//
// ─── A regra assimétrica, e por quê ──────────────────────────────
//
// ENTRADA: o painel NÃO faz fade. Já fez, e o resultado foi um painel
// translúcido com os cards do funil aparecendo através dos campos do
// formulário. Na entrada o véu ainda está ralo, então o que atravessa o painel
// é conteúdo legível. Aqui ele só desliza — sempre sólido.
//
// SAÍDA: o painel PODE fazer fade, e deve. O véu sai DEPOIS dele e segura a
// escuridão, então o que aparece através do painel é véu, não board. É isso que
// elimina o "pop" no fim.
//
// O véu, nos dois sentidos, usa uma curva simétrica: escurecer e clarear são
// mudanças de luz, e luz não tem inércia pra imitar.

/** Curva da marca — deslocamento. Sai forte e assenta (expo-out). */
export const EASE_MARCA: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Curva do véu — simétrica. Não evapora no primeiro quadro. */
export const EASE_LUZ: [number, number, number, number] = [0.4, 0, 0.2, 1];

/**
 * Véu (backdrop). Entra rápido, pra o painel sólido nunca ficar sobre uma
 * página acesa; sai devagar, pra ainda estar lá quando o painel terminar.
 */
export const VEU = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.14, ease: EASE_LUZ } },
  exit: { opacity: 0, transition: { duration: 0.26, ease: EASE_LUZ } },
} as const;

/**
 * Painel. `reduzir` = preferência de movimento reduzido do sistema: o painel
 * aparece e some sem deslizar, mas continua aparecendo — movimento cai,
 * informação fica.
 *
 * `deslocamento` é a distância do deslize (px). Bottom sheet pede mais.
 */
export function painel(reduzir: boolean, deslocamento = 14) {
  if (reduzir) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.12 } },
    };
  }
  return {
    initial: { y: deslocamento },
    animate: { y: 0, opacity: 1, transition: { duration: 0.24, ease: EASE_MARCA } },
    // Fade + deslize curto, terminando ANTES do véu. Ver a regra assimétrica.
    exit: { y: deslocamento * 0.7, opacity: 0, transition: { duration: 0.16, ease: EASE_LUZ } },
  };
}
