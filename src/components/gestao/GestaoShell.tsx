"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus, Menu, X, Sun, Moon, LogOut } from "lucide-react";
import { secoes, EVENTO_NOVO_CLIENTE } from "./secoes";
import { useTema } from "@/lib/tema";
import { VEU, EASE_MARCA as EASE } from "./motion/sobreposicao";
import { signOutAction } from "@/features/auth/actions";

const LARGURA = "260px";

function estaAtiva(pathname: string, href: string) {
  // Painel é o índice (/gestao) → match exato. As demais casam por prefixo,
  // pra manter o item ativo dentro de sub-rotas (ex: /gestao/estoque/novo).
  return href === "/gestao" ? pathname === "/gestao" : pathname.startsWith(href);
}

// Marca da loja no topo do painel — leva pro Painel (não pro site público).
function Marca() {
  return (
    <Link
      href="/gestao"
      aria-label="Cassiano Veículos — Painel"
      className="inline-flex items-center transition-opacity duration-200 hover:opacity-80"
    >
      {/* Duas versões: a de traço escuro sumiria no tema escuro. Trocadas por
          CSS (não por JS) pra a logo certa já vir na primeira pintura. */}
      <Image
        src="/logo-cv-trim.png"
        alt="Cassiano Veículos"
        width={453}
        height={109}
        priority
        className="so-tema-claro h-8 w-auto"
      />
      <Image
        src="/logo-cv-light.png"
        alt="Cassiano Veículos"
        width={453}
        height={109}
        className="so-tema-escuro h-8 w-auto"
      />
    </Link>
  );
}

function ConteudoSidebar({
  pathname,
  onNavegar,
  escopo,
}: {
  pathname: string;
  onNavegar?: () => void;
  /** Sidebar e drawer ficam montados ao mesmo tempo (o desktop só some por
   *  CSS). Sem escopo, os dois disputariam o mesmo layoutId e o realce
   *  saltaria entre as duas instâncias. */
  escopo: string;
}) {
  const reduzir = useReducedMotion();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-1.5 pt-2">
        <Marca />
      </div>

      <Link
        href="/gestao/clientes?novo=1"
        onClick={(e) => {
          // Já na tela de Clientes: navegar não faz nada (mesma rota, sem
          // remontagem) e o botão parecia morto. Avisa por evento.
          if (pathname.startsWith("/gestao/clientes")) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent(EVENTO_NOVO_CLIENTE));
          }
          onNavegar?.();
        }}
        className="flex items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-[0_2px_8px_color-mix(in_srgb,var(--primary)_25%,transparent)] transition-[background-color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] hover:bg-primary-hover active:scale-[0.98]"
      >
        <Plus size={18} strokeWidth={2.25} />
        Novo cliente
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Navegação da gestão">
        {secoes.map((s) => {
          const Icon = s.icon;
          const ativa = estaAtiva(pathname, s.href);
          return (
            <Link
              key={s.href}
              href={s.href}
              onClick={onNavegar}
              aria-current={ativa ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-[var(--radius)] px-3.5 py-2.5 text-sm transition-colors duration-[var(--dur-rapida)] ${
                ativa
                  ? "font-semibold text-primary"
                  : "font-medium text-secondary/75 hover:bg-sand hover:text-secondary"
              }`}
            >
              {/* O realce do item ativo é UM elemento que desliza entre os itens
                  (layoutId), em vez de apagar aqui e acender ali — dá a leitura
                  de "fui pra lá", não de "piscou". */}
              {ativa && (
                <motion.span
                  layoutId={`nav-ativa-${escopo}`}
                  className="absolute inset-0 rounded-[var(--radius)] bg-primary/10"
                  transition={
                    reduzir ? { duration: 0 } : { duration: 0.3, ease: EASE }
                  }
                  aria-hidden="true"
                >
                  {/* Brand signal: 3px bar on the left edge, sliding with the highlight. */}
                  <span className="absolute inset-y-1.5 left-0 w-[3px] bg-signal shadow-[0_0_14px_1px_color-mix(in_srgb,var(--signal)_50%,transparent)]" />
                </motion.span>
              )}
              <Icon size={19} strokeWidth={1.75} className="relative shrink-0" />
              <span className="relative">{s.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        <BotaoTema />
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[var(--radius)] px-3.5 py-2.5 text-sm font-medium text-secondary/70 transition-colors duration-[var(--dur-rapida)] hover:bg-sand hover:text-secondary"
          >
            <LogOut size={18} strokeWidth={1.9} className="shrink-0" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

/** Alternador claro/escuro. Fica no rodapé da sidebar — é ajuste de conforto,
 *  não navegação, então não disputa espaço com as seções. */
function BotaoTema() {
  const { tema, trocar } = useTema();
  const escuro = tema === "escuro";

  return (
    <button
      type="button"
      onClick={trocar}
      // O servidor não sabe a preferência salva; sem isso o rótulo daria
      // mismatch de hidratação.
      suppressHydrationWarning
      aria-label={escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      className="flex items-center gap-3 rounded-[var(--radius)] px-3.5 py-2.5 text-sm font-medium text-secondary/70 transition-colors duration-[var(--dur-rapida)] hover:bg-sand hover:text-secondary"
    >
      {/* tema === null enquanto não montou: mostra o sol como neutro */}
      {escuro ? (
        <Sun size={18} strokeWidth={1.9} className="shrink-0" />
      ) : (
        <Moon size={18} strokeWidth={1.9} className="shrink-0" />
      )}
      <span suppressHydrationWarning>{escuro ? "Tema claro" : "Tema escuro"}</span>
    </button>
  );
}

/**
 * Moldura da área dos vendedores (central de gestão): sidebar fixa no desktop,
 * top bar + drawer no mobile. Register product — navegação padrão, cor contida
 * (cor da marca só na ação primária e no item ativo), motion curto e funcional.
 * Sem o chrome do site público (header/footer/WhatsApp): é outra superfície.
 */
export function GestaoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const reduzir = useReducedMotion();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-surface lg:block"
        style={{ width: LARGURA }}
      >
        <ConteudoSidebar pathname={pathname} escopo="desktop" />
      </aside>

      {/* Top bar — mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Marca />
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          className="grid h-10 w-10 place-items-center rounded-[var(--radius)] text-secondary transition-colors duration-200 hover:bg-sand"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Drawer — mobile */}
      <AnimatePresence>
        {aberto && [
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-veu lg:hidden"
            {...VEU}
            onClick={() => setAberto(false)}
            aria-hidden="true"
          />,
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu da gestão"
            className="fixed inset-y-0 left-0 z-40 w-[280px] max-w-[82vw] border-r border-line bg-surface lg:hidden"
            initial={reduzir ? { opacity: 0 } : { x: "-100%" }}
            animate={reduzir ? { opacity: 1 } : { x: 0 }}
            exit={reduzir ? { opacity: 0 } : { x: "-100%" }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-secondary/70 transition-colors duration-200 hover:bg-sand hover:text-secondary"
            >
              <X size={18} />
            </button>
            <ConteudoSidebar
              pathname={pathname}
              onNavegar={() => setAberto(false)}
              escopo="drawer"
            />
          </motion.aside>,
        ]}
      </AnimatePresence>

      {/* Conteúdo */}
      <div className="lg:pl-[260px]">
        <main className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
