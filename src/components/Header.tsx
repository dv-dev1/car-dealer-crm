"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { WhatsappIcon } from "./WhatsappIcon";
import { WhatsappTrigger } from "./whatsapp/WhatsappTrigger";
import { loja } from "@/lib/loja";

const navLinks = [
  { href: "/", label: "Página Inicial" },
  { href: "/nossos-carros", label: "Nossos carros" },
  { href: "/#diferenciais", label: "Diferenciais" },
  { href: "/#garantia", label: "Garantia 90 dias" },
  { href: "/#equipe", label: "Nossa equipe" },
  { href: "/#contato", label: "Contato" },
];

/**
 * @param solid Força o header opaco (grafite) já no topo. Use em páginas cujo
 * conteúdo começa em fundo claro — sem isso o nav branco fica ilegível sobre o
 * areia até a primeira rolagem. A home não precisa: o hero grafite fica atrás.
 */
export function Header({ solid = false }: { solid?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const solidLook = solid || scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Trava o scroll com o menu mobile aberto.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 transition-[background-color,box-shadow] duration-[400ms] ease-[var(--ease-brand)] ${
        solidLook
          ? "bg-secondary/95 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.15)] backdrop-blur-md"
          : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-5 sm:px-8">
        <Logo />

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/85 transition-colors duration-200 hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <WhatsappTrigger
            mensagem={`Olá! Vim pelo site da ${loja.nome}.`}
            className="hidden items-center gap-2 rounded-[var(--radius)] bg-whatsapp px-4 py-2.5 text-sm font-semibold text-white transition-[transform,background-color,box-shadow] duration-300 ease-[var(--ease-brand)] hover:-translate-y-0.5 hover:bg-whatsapp-hover hover:shadow-[0_8px_20px_rgba(37,211,102,0.35)] motion-reduce:hover:translate-y-0 sm:flex"
          >
            <WhatsappIcon size={18} />
            WhatsApp
          </WhatsappTrigger>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            className="grid h-11 w-11 place-items-center rounded-[var(--radius)] text-white lg:hidden"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Menu mobile — ancorado logo abaixo da barra (top-full acompanha a
          altura variável do header, rolado ou não; sem número mágico). */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-full z-20 min-h-[calc(100svh-100%)] overflow-y-auto bg-secondary/98 backdrop-blur-md lg:hidden">
          <nav
            className="flex flex-col gap-1 px-5 py-6"
            aria-label="Menu mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-[var(--radius)] px-4 py-3.5 text-lg font-medium text-white/90 transition-colors hover:bg-white/5 hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
