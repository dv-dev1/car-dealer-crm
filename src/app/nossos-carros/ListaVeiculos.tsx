"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Veiculo } from "@/types/veiculo";
import { VeiculoCard } from "@/components/VeiculoCard";
import { Reveal } from "@/components/Reveal";

type Ordenacao = "relevancia" | "menor-preco" | "maior-preco" | "menor-km";

export function ListaVeiculos({ veiculos }: { veiculos: Veiculo[] }) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordenacao>("relevancia");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista = veiculos.filter((v) =>
      termo
        ? `${v.marca} ${v.modelo} ${v.titulo}`.toLowerCase().includes(termo)
        : true
    );
    lista = [...lista].sort((a, b) => {
      switch (ordem) {
        case "menor-preco":
          return a.preco - b.preco;
        case "maior-preco":
          return b.preco - a.preco;
        case "menor-km":
          return a.km - b.km;
        default:
          return Number(b.destaque) - Number(a.destaque);
      }
    });
    return lista;
  }, [veiculos, busca, ordem]);

  return (
    <>
      {/* Controles */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por marca ou modelo..."
            aria-label="Buscar veículos"
            className="w-full rounded-[var(--radius)] border border-line bg-surface py-3 pl-11 pr-4 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-primary"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          Ordenar:
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordenacao)}
            className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
          >
            <option value="relevancia">Relevância</option>
            <option value="menor-preco">Menor preço</option>
            <option value="maior-preco">Maior preço</option>
            <option value="menor-km">Menor km</option>
          </select>
        </label>
      </div>

      <p className="mb-6 text-sm text-muted">
        {filtrados.length}{" "}
        {filtrados.length === 1 ? "veículo encontrado" : "veículos encontrados"}
      </p>

      {filtrados.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((veiculo, i) => (
            <Reveal key={veiculo.id} delay={Math.min(i, 6) * 0.05}>
              <VeiculoCard veiculo={veiculo} />
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-dashed border-line bg-sand/40 py-20 text-center">
          <p className="text-lg font-semibold text-secondary">
            Nenhum veículo encontrado
          </p>
          <p className="mt-2 text-sm text-muted">
            Tente outra busca ou fale com a gente no WhatsApp — talvez a gente
            tenha o carro certo chegando.
          </p>
        </div>
      )}
    </>
  );
}
