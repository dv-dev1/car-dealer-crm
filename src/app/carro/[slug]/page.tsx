import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  Gauge,
  Cog,
  Fuel,
  Palette,
  DoorOpen,
  ShieldCheck,
  FileCheck,
  ChevronRight,
  Check,
} from "lucide-react";
import { SiteChrome } from "@/components/SiteChrome";
import { VeiculoCard } from "@/components/VeiculoCard";
import { Reveal } from "@/components/Reveal";
import { WhatsappIcon } from "@/components/WhatsappIcon";
import { WhatsappTrigger } from "@/components/whatsapp/WhatsappTrigger";
import { getVeiculoBySlug, getOutrosVeiculos, getVeiculos } from "@/lib/veiculos";
import { formatKm, formatPreco } from "@/lib/format";
import { loja } from "@/lib/loja";
import { Galeria } from "./Galeria";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const veiculos = await getVeiculos();
  return veiculos.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const veiculo = await getVeiculoBySlug(slug);
  if (!veiculo) return { title: "Veículo não encontrado" };
  return {
    title: veiculo.titulo,
    description: veiculo.descricao?.slice(0, 155),
  };
}

export default async function CarroPage({ params }: Props) {
  const { slug } = await params;
  const veiculo = await getVeiculoBySlug(slug);
  if (!veiculo) notFound();

  const outros = await getOutrosVeiculos(slug, 4);

  const specs = [
    { icon: Calendar, label: "Ano", valor: String(veiculo.ano) },
    { icon: Gauge, label: "Quilometragem", valor: formatKm(veiculo.km) },
    { icon: Cog, label: "Câmbio", valor: veiculo.cambio },
    { icon: Fuel, label: "Combustível", valor: veiculo.combustivel },
    { icon: Palette, label: "Cor", valor: veiculo.cor ?? "—" },
    { icon: DoorOpen, label: "Portas", valor: `${veiculo.portas ?? "—"} portas` },
  ];

  const mensagemWpp = `Olá! Tenho interesse no ${veiculo.titulo} (${formatPreco(
    veiculo.preco
  )}) que vi no site da ${loja.nome}.`;

  const fichaEntries = Object.entries(veiculo.fichaTecnica);

  return (
    <SiteChrome solidHeader>
      <div className="bg-background pt-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Você está aqui" className="py-5 text-sm text-muted">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="transition-colors hover:text-primary">
                  Início
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href="/nossos-carros"
                  className="transition-colors hover:text-primary"
                >
                  Nossos carros
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-secondary">{veiculo.titulo}</li>
            </ol>
          </nav>

          {/* Galeria + card de specs */}
          <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            <Galeria fotos={veiculo.fotos} titulo={veiculo.titulo} />

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-[var(--radius)] border border-line bg-surface p-6 shadow-[var(--shadow-soft)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {veiculo.marca} • {veiculo.ano}
                </p>
                <h1 className="mt-2 text-2xl font-bold leading-tight text-secondary">
                  {veiculo.titulo}
                </h1>

                <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted">
                  Valor
                </p>
                <p className="text-3xl font-bold text-secondary">
                  {formatPreco(veiculo.preco)}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {specs.map((spec) => {
                    const Icon = spec.icon;
                    return (
                      <div
                        key={spec.label}
                        className="rounded-[var(--radius)] bg-sand/50 p-3"
                      >
                        <Icon size={18} className="mb-1.5 text-primary" strokeWidth={1.75} />
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                          {spec.label}
                        </p>
                        <p className="text-sm font-semibold text-secondary">
                          {spec.valor}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <WhatsappTrigger
                  mensagem={mensagemWpp}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-whatsapp px-6 py-3.5 text-sm font-semibold text-white transition-[transform,background-color,box-shadow] duration-300 ease-[var(--ease-brand)] hover:-translate-y-0.5 hover:bg-whatsapp-hover hover:shadow-[0_10px_28px_rgba(37,211,102,0.4)] motion-reduce:hover:translate-y-0"
                >
                  <WhatsappIcon size={18} />
                  Falar com um vendedor
                </WhatsappTrigger>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-primary" />
                    Procedência verificada
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <FileCheck size={14} className="text-primary" />
                    Documentação completa
                  </span>
                </div>
              </div>
            </aside>
          </div>

          {/* Ficha técnica */}
          {fichaEntries.length > 0 && (
            <section className="mt-16 max-w-3xl">
              <h2 className="text-xl font-bold text-secondary">Ficha técnica</h2>
              <dl className="mt-5 overflow-hidden rounded-[var(--radius)] border border-line">
                {fichaEntries.map(([chave, valor], i) => (
                  <div
                    key={chave}
                    className={`flex items-center justify-between px-5 py-3.5 text-sm ${
                      i % 2 === 0 ? "bg-surface" : "bg-sand/40"
                    }`}
                  >
                    <dt className="text-muted">{chave}</dt>
                    <dd className="font-semibold text-secondary">{valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Equipamentos */}
          {veiculo.equipamentos.length > 0 && (
            <section className="mt-14">
              <h2 className="text-xl font-bold text-secondary">
                Equipamentos e opcionais
              </h2>
              <ul className="mt-5 flex flex-wrap gap-2.5">
                {veiculo.equipamentos.map((eq) => (
                  <li
                    key={eq}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-secondary"
                  >
                    <Check size={14} className="text-primary" strokeWidth={2.5} />
                    {eq}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Descrição */}
          {veiculo.descricao && (
            <section className="mt-14 max-w-3xl">
              <h2 className="text-xl font-bold text-secondary">Descrição</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-text">
                {veiculo.descricao}
              </p>
            </section>
          )}
        </div>

        {/* Outros carros */}
        {outros.length > 0 && (
          <section className="mx-auto mt-20 max-w-[1280px] px-5 pb-20 sm:px-8">
            <div className="mb-8 flex items-end justify-between">
              <h2 className="text-xl font-bold text-secondary">
                Outros carros disponíveis
              </h2>
              <Link
                href="/nossos-carros"
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-secondary transition-colors hover:border-primary hover:text-primary"
              >
                Ver todos
                <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {outros.map((v) => (
                <VeiculoCard key={v.id} veiculo={v} />
              ))}
            </div>
          </section>
        )}
      </div>
    </SiteChrome>
  );
}
