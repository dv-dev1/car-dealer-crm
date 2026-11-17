import Link from "next/link";
import { loja } from "@/lib/loja";

/**
 * Marca do site em texto: monograma caramelo + nome da loja. Sem arquivo de
 * imagem, então nunca quebra.
 *  - "light" → texto claro: usar sobre fundo ESCURO (header).
 *  - "dark"  → texto grafite: usar sobre fundo CLARO (footer areia).
 */
export function Logo({ variant = "light" }: { variant?: "light" | "dark" }) {
  const wordmarkClass = variant === "light" ? "text-white" : "text-secondary";
  const [primeiro, ...resto] = loja.nome.split(" ");
  return (
    <Link href="/" aria-label={`${loja.nome} — página inicial`} className="group inline-flex items-center">
      <span className="inline-flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-[8px] bg-primary font-bold text-white"
          style={{ letterSpacing: "-0.06em", fontSize: "15px" }}
        >
          {primeiro[0]}
        </span>
        <span className={`text-[15px] font-semibold uppercase leading-none tracking-[0.12em] ${wordmarkClass}`}>
          {primeiro}
          {resto.length > 0 && <span className="text-primary"> {resto.join(" ")}</span>}
        </span>
      </span>
    </Link>
  );
}
