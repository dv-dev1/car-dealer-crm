import type { LucideIcon } from "lucide-react";

// Placeholder honesto pras seções: a interface (navegação, cabeçalho, moldura)
// está pronta; o conteúdo de cada tela entra quando o usuário definir. Não
// inventa funcionalidade — só deixa a casa arrumada esperando o conteúdo.
export function SecaoPlaceholder({
  titulo,
  icon: Icon,
}: {
  titulo: string;
  icon: LucideIcon;
}) {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-secondary">{titulo}</h1>
      </header>

      <div className="grid min-h-[62vh] place-items-center rounded-[calc(var(--radius)*1.25)] border border-dashed border-line bg-surface px-6 py-20 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-sand text-primary">
          <Icon size={26} strokeWidth={1.5} />
        </span>
        <h2 className="mt-5 text-base font-semibold text-secondary">
          Seção em construção
        </h2>
        <p className="mt-1.5 max-w-sm text-sm text-secondary/80">
          A interface de{" "}
          <span className="font-medium text-secondary">{titulo}</span> está
          pronta. O conteúdo entra assim que você definir como esta tela deve
          ficar.
        </p>
      </div>
    </div>
  );
}
