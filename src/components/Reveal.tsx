"use client";

import { useEffect, useRef, useState, type ReactNode, type ElementType } from "react";

interface RevealProps {
  children: ReactNode;
  /** Atraso do stagger, em segundos. */
  delay?: number;
  /** Tag renderizada (default div). */
  as?: ElementType;
  className?: string;
}

/**
 * Scroll reveal seguro por construção. O conteúdo é VISÍVEL por padrão (SSR,
 * sem JS, reduced-motion). O efeito só "arma" (esconde pra depois revelar) os
 * elementos que nascem ABAIXO da dobra — e só depois que o JS confirmou que
 * está vivo (dentro deste effect). Consequências:
 *
 *  - JS morto/lento/hidratação falha  → nada é armado → tudo continua visível.
 *  - Elemento acima da dobra no load  → nunca é escondido → sem flash.
 *  - Print headless sem rolar          → o que está na 1ª dobra está visível;
 *    as seções de baixo só escondem quando o JS as arma, e revelam ao entrarem
 *    no viewport (o observer dispara na rolagem do próprio screenshot tool).
 *
 * Nunca voltar a esconder por padrão via classe: é o que deixava a seção em
 * branco no celular quando o gatilho não rodava.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Sem suporte / reduced-motion: não arma nada. Fica visível, sem movimento.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced || !("IntersectionObserver" in window)) return;

    // Só faz sentido esconder pra revelar o que ainda não está na tela. O que
    // já está (acima/na dobra) fica visível — nada de flash de entrada.
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (el.getBoundingClientRect().top < vh) return;

    setArmed(true);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${armed ? "reveal--armed" : ""} ${
        visible ? "is-visible" : ""
      } ${className}`.trim()}
      style={delay ? { ["--reveal-delay" as string]: `${delay}s` } : undefined}
    >
      {children}
    </Tag>
  );
}
