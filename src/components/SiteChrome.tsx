import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { WhatsappFab } from "./WhatsappFab";

/**
 * Moldura do site público: header fixo + conteúdo + footer + WhatsApp flutuante.
 * @param solidHeader Header opaco já no topo — para páginas de fundo claro.
 */
export function SiteChrome({
  children,
  solidHeader = false,
}: {
  children: ReactNode;
  solidHeader?: boolean;
}) {
  return (
    <>
      <Header solid={solidHeader} />
      <main>{children}</main>
      <Footer />
      <WhatsappFab />
    </>
  );
}
