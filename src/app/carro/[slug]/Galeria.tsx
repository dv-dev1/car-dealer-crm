"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Galeria({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  const [ativa, setAtiva] = useState(0);
  const total = fotos.length;

  const ir = (dir: number) =>
    setAtiva((a) => (a + dir + total) % total);

  return (
    <div>
      {/* Foto principal */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius)] bg-sand">
        <Image
          key={ativa}
          src={fotos[ativa]}
          alt={`${titulo} — foto ${ativa + 1} de ${total}`}
          fill
          priority
          quality={90}
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover"
        />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => ir(-1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-secondary/70 text-white backdrop-blur-sm transition-[background-color,transform] duration-300 ease-[var(--ease-brand)] hover:bg-secondary hover:scale-105 motion-reduce:hover:scale-100"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => ir(1)}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-secondary/70 text-white backdrop-blur-sm transition-[background-color,transform] duration-300 ease-[var(--ease-brand)] hover:bg-secondary hover:scale-105 motion-reduce:hover:scale-100"
            >
              <ChevronRight size={20} />
            </button>
            <span className="absolute bottom-3 left-3 rounded-md bg-secondary/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {ativa + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/* Miniaturas */}
      {total > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {fotos.map((foto, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setAtiva(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === ativa}
              className={`relative aspect-square overflow-hidden rounded-lg transition-[border-color,opacity] duration-200 ${
                i === ativa
                  ? "ring-2 ring-primary ring-offset-1"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={foto}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
