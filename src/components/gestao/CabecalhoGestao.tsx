import type { ReactNode } from "react";

/**
 * Cabeçalho padrão das telas da gestão.
 *
 * Antes cada tela montava o seu à mão, todas com o mesmo `h1 text-2xl` e sem
 * presença — abrir Estoque ou Relatórios dava a mesma sensação, e nada dizia
 * "você chegou em outro lugar". Aqui o título ganha corpo, o eyebrow situa a
 * seção e a linha de apoio explica em uma frase o que a tela responde.
 */
export function CabecalhoGestao({
  eyebrow,
  titulo,
  apoio,
  acoes,
}: {
  /** Rótulo curto acima do título — a família da tela ("Central de gestão"). */
  eyebrow?: string;
  titulo: string;
  apoio?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[1.75rem] font-semibold leading-none text-secondary sm:text-[2rem]">
          {titulo}
        </h1>
        {apoio && <p className="mt-2 max-w-lg text-sm text-muted-strong">{apoio}</p>}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2.5">{acoes}</div>}
    </header>
  );
}
