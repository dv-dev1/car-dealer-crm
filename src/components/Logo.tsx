"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { loja } from "@/lib/loja";

/**
 * Logo oficial da Cassiano Veículos (marca horizontal: monograma CV caramelo
 * + wordmark "CASSIANO VEÍCULOS"). Arquivo fonte transparente enviado pela loja
 * (public/logo-cv-trim.png, recortado do padding via sharp — proporção ~4.15:1).
 *
 * Duas variantes por contraste de fundo:
 *  - "light"  → texto claro (public/logo-cv-light.png): usar sobre fundo ESCURO
 *               (header no topo transparente / grafite ao rolar).
 *  - "dark"   → texto grafite original (public/logo-cv-trim.png): usar sobre
 *               fundo CLARO (footer areia).
 *
 * Fallback: se o PNG não carregar, mostra um wordmark tipográfico no estilo da
 * marca — o site nunca quebra.
 */
export function Logo({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [imgOk, setImgOk] = useState(true);
  const src = variant === "light" ? "/logo-cv-light.png" : "/logo-cv-trim.png";
  // Cor do wordmark tipográfico do fallback, casando com a variante.
  const wordmarkClass = variant === "light" ? "text-white" : "text-secondary";

  return (
    <Link
      href="/"
      aria-label={`${loja.nome} — página inicial`}
      className="group inline-flex items-center"
    >
      {imgOk ? (
        <Image
          src={src}
          alt={loja.nome}
          width={453}
          height={109}
          priority
          onError={() => setImgOk(false)}
          className="h-8 w-auto transition-transform duration-300 ease-[var(--ease-brand)] group-hover:scale-[1.03] motion-reduce:group-hover:scale-100 sm:h-9"
        />
      ) : (
        <span className="inline-flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-[8px] bg-primary font-bold text-white"
            style={{ letterSpacing: "-0.06em", fontSize: "15px" }}
          >
            CV
          </span>
          <span
            className={`text-[15px] font-semibold uppercase leading-none tracking-[0.12em] ${wordmarkClass}`}
          >
            Cassiano
            <span className="text-primary"> Veículos</span>
          </span>
        </span>
      )}
    </Link>
  );
}
