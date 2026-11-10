import type { Metadata } from "next";
import { GestaoShell } from "@/components/gestao/GestaoShell";
import { TemaGestao } from "@/components/gestao/TemaGestao";

// Área interna dos vendedores. `noindex` reforça que o público nunca a
// encontra por busca (a trava de login real entra com o Supabase, próxima fase).
export const metadata: Metadata = {
  title: "Gestão",
  robots: { index: false, follow: false },
};

// Aplica o tema salvo ANTES da primeira pintura. Sem isso a tela pisca branca
// a cada navegação pra quem usa o escuro (o React só assumiria depois de
// hidratar). Fica inline de propósito: um arquivo externo chegaria tarde.
// `escuro` é o único valor que liga o tema; qualquer outra coisa cai no claro.
const TEMA_INICIAL = `
try {
  var t = localStorage.getItem("cassiano.tema");
  if (t === "escuro") document.documentElement.dataset.tema = "escuro";
} catch (e) {}
`;

export default function GestaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
      <TemaGestao />
      <GestaoShell>{children}</GestaoShell>
    </>
  );
}
