"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { formatPreco } from "@/lib/format";

/**
 * Formato pedido por NOME, não por função. Server component não consegue passar
 * função pra client component ("Functions cannot be passed directly to Client
 * Components") — e metade de quem usa isto (Painel, LojaAgora) é server.
 */
export type FormatoNumero = "inteiro" | "preco" | "porcento" | "decimal1";

const FORMATADORES: Record<FormatoNumero, (n: number) => string> = {
  inteiro: (n) => Math.round(n).toLocaleString("pt-BR"),
  preco: (n) => formatPreco(Math.round(n)),
  porcento: (n) => `${Math.round(n)}%`,
  decimal1: (n) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
};

// Mesmo easing da marca (ease-out-expo) do globals.css, em JS: começa rápido e
// desacelera no fim — é o que faz o número "assentar" como um odômetro parando,
// em vez de chegar batendo.
function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Número que rola de zero até o valor quando entra na tela. É o gesto de
 * assinatura do painel: num painel de instrumentos, o que se move está
 * informando — aqui, o tamanho do número.
 *
 * Roda UMA vez por montagem. Se o valor mudar depois (o vendedor fechou uma
 * venda), anima do valor antigo pro novo, que é o que dá a leitura de "subiu".
 *
 * `prefers-reduced-motion`: mostra o valor final direto, sem contagem.
 */
export function NumeroAnimado({
  valor,
  formato = "inteiro",
  sufixo = "",
  duracao = 700,
  className = "",
}: {
  valor: number;
  formato?: FormatoNumero;
  /** Texto colado no fim ("/dia", " dias"). Não entra na contagem. */
  sufixo?: string;
  duracao?: number;
  className?: string;
}) {
  const formatar = FORMATADORES[formato];
  const reduzir = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [mostrado, setMostrado] = useState(valor);
  const anterior = useRef(0);
  const jaRodou = useRef(false);

  useEffect(() => {
    if (reduzir) {
      setMostrado(valor);
      anterior.current = valor;
      return;
    }

    const de = anterior.current;
    const para = valor;
    anterior.current = valor;
    if (de === para) return;

    let raf = 0;
    let cancelado = false;

    const animar = () => {
      const inicio = performance.now();
      const passo = (agora: number) => {
        if (cancelado) return;
        const t = Math.min(1, (agora - inicio) / duracao);
        setMostrado(de + (para - de) * easeOutExpo(t));
        if (t < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    };

    // Na primeira vez espera o bloco entrar na tela: contar um número que
    // ninguém está vendo desperdiça o efeito (a pessoa rola e ele já acabou).
    if (!jaRodou.current && ref.current && "IntersectionObserver" in window) {
      jaRodou.current = true;
      const alvo = ref.current;
      const obs = new IntersectionObserver(
        (entradas) => {
          if (entradas[0]?.isIntersecting) {
            obs.disconnect();
            animar();
          }
        },
        { threshold: 0.2 },
      );
      obs.observe(alvo);
      return () => {
        cancelado = true;
        obs.disconnect();
        cancelAnimationFrame(raf);
      };
    }

    jaRodou.current = true;
    animar();
    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
    };
  }, [valor, duracao, reduzir]);

  return (
    // tabular-nums é obrigatório: sem largura fixa por dígito o número treme
    // enquanto conta, e a linha inteira dança junto.
    <span ref={ref} className={`tabular-nums ${className}`}>
      {formatar(mostrado)}
      {sufixo}
    </span>
  );
}
