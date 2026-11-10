import { ShieldCheck, RefreshCw, Landmark, FileCheck, Car } from "lucide-react";

const selos = [
  { icon: ShieldCheck, label: "Procedência verificada" },
  { icon: RefreshCw, label: "Seu usado na troca" },
  { icon: Landmark, label: "Financiamento aprovado" },
  { icon: FileCheck, label: "Documentação completa" },
  { icon: Car, label: "Test drive sem compromisso" },
];

export function SelosBar() {
  // Duplica a lista pra o loop do marquee ser contínuo.
  const loop = [...selos, ...selos];
  return (
    <section
      aria-label="Diferenciais de compra"
      className="border-y border-line bg-secondary py-4"
    >
      <div className="marquee">
        <ul className="marquee__track">
          {loop.map((selo, i) => {
            const Icon = selo.icon;
            return (
              <li
                key={i}
                className="flex shrink-0 items-center gap-2.5 px-8 text-sm font-medium text-white/80"
                aria-hidden={i >= selos.length}
              >
                <Icon size={18} className="text-primary" strokeWidth={1.75} />
                {selo.label}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
