"use client";

import { useEffect } from "react";
import { esquecerTema } from "@/lib/tema";

/**
 * Dono do tempo de vida do tema escuro. Montado uma vez pelo layout da gestão,
 * some quando a pessoa sai da área — e é só nessa hora que o `data-tema` é
 * limpo, pra o site público (que é claro sempre) não herdar o escuro numa
 * navegação client-side.
 *
 * Existe porque essa limpeza morava no alternador da sidebar, que aparece duas
 * vezes na tela e entra e sai junto com o menu do celular: fechar o menu
 * apagava o tema da página inteira.
 */
export function TemaGestao() {
  useEffect(() => esquecerTema, []);
  return null;
}
