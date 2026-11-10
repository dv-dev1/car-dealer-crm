import Link from "next/link";
import { Logo } from "./Logo";
import { WhatsappIcon } from "./WhatsappIcon";
import { WhatsappTrigger } from "./whatsapp/WhatsappTrigger";
import { InstagramIcon } from "./InstagramIcon";
import { loja } from "@/lib/loja";

const navFooter = [
  { href: "/", label: "Página Inicial" },
  { href: "/nossos-carros", label: "Nossos carros" },
  { href: "/#diferenciais", label: "Diferenciais" },
  { href: "/#garantia", label: "Garantia 90 dias" },
  { href: "/#equipe", label: "Nossa equipe" },
  { href: "/#contato", label: "Contato" },
];

export function Footer() {
  return (
    <footer className="bg-secondary text-white/70">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">{loja.descricao}</p>
          <div className="mt-3 h-0.5 w-16 rounded bg-primary" />
        </div>

        <nav aria-label="Navegação do rodapé">
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
            Navegação
          </h4>
          <ul className="mt-4 space-y-2.5">
            {navFooter.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm transition-colors hover:text-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
            Contato
          </h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <WhatsappTrigger className="transition-colors hover:text-primary">
                WhatsApp
              </WhatsappTrigger>
            </li>
            <li>
              <a
                href={loja.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                Instagram
              </a>
            </li>
          </ul>
          <div className="mt-4 flex gap-3">
            <WhatsappTrigger
              aria-label="WhatsApp"
              className="grid h-11 w-11 place-items-center rounded-[var(--radius)] border border-white/15 transition-colors hover:border-primary hover:text-primary"
            >
              <WhatsappIcon size={18} />
            </WhatsappTrigger>
            <a
              href={loja.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="grid h-11 w-11 place-items-center rounded-[var(--radius)] border border-white/15 transition-colors hover:border-primary hover:text-primary"
            >
              <InstagramIcon size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        {/* pb extra no mobile: garante que o texto não fique atrás do FAB do
            WhatsApp (fixo no canto inferior direito). */}
        <div className="mx-auto max-w-[1280px] px-5 pb-24 pt-5 text-xs text-white/40 sm:px-8 sm:pb-5">
          © {new Date().getFullYear()} {loja.nome}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
