"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  FileDown,
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  ChevronRight,
} from "lucide-react";
import { formatPreco } from "@/lib/format";
import { resumoEstoque, type VeiculoGestao } from "@/data/gestao-mock";
import { GestaoCarCard } from "@/components/gestao/GestaoCarCard";
import { CabecalhoGestao } from "@/components/gestao/CabecalhoGestao";

type Filtro = "todos" | "sem-margem" | "girar" | "preparacao";
type Ordem = "relevancia" | "preco-asc" | "preco-desc" | "patio-desc" | "lucro-desc";
type Modo = "grade" | "lista";

const ORDENS: { valor: Ordem; label: string }[] = [
  { valor: "relevancia", label: "Relevância" },
  { valor: "preco-desc", label: "Maior preço" },
  { valor: "preco-asc", label: "Menor preço" },
  { valor: "patio-desc", label: "Mais tempo no pátio" },
  { valor: "lucro-desc", label: "Maior lucro" },
];

function pertence(v: VeiculoGestao, f: Filtro) {
  if (f === "todos") return v.statusGestao !== "vendido";
  if (f === "sem-margem") return v.statusGestao === "sem-margem";
  if (f === "girar") return v.diasEstoque > 90 && v.statusGestao !== "vendido";
  if (f === "preparacao") return v.statusGestao === "preparacao";
  return true;
}

export function EstoqueGestao({ veiculos }: { veiculos: VeiculoGestao[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ordem, setOrdem] = useState<Ordem>("relevancia");
  const [modo, setModo] = useState<Modo>("grade");

  const resumo = useMemo(() => resumoEstoque(veiculos), [veiculos]);

  const contagem = useMemo(
    () => ({
      todos: veiculos.filter((v) => pertence(v, "todos")).length,
      "sem-margem": veiculos.filter((v) => pertence(v, "sem-margem")).length,
      girar: veiculos.filter((v) => pertence(v, "girar")).length,
      preparacao: veiculos.filter((v) => pertence(v, "preparacao")).length,
    }),
    [veiculos],
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let r = veiculos.filter((v) => pertence(v, filtro));
    if (termo) {
      r = r.filter((v) =>
        `${v.titulo} ${v.marca} ${v.modelo} ${v.ano} ${v.cor ?? ""}`
          .toLowerCase()
          .includes(termo),
      );
    }
    const ordenada = [...r];
    ordenada.sort((a, b) => {
      switch (ordem) {
        case "preco-asc":
          return a.preco - b.preco;
        case "preco-desc":
          return b.preco - a.preco;
        case "patio-desc":
          return b.diasEstoque - a.diasEstoque;
        case "lucro-desc":
          return b.lucro - a.lucro;
        default:
          return Number(b.destaque) - Number(a.destaque);
      }
    });
    return ordenada;
  }, [veiculos, busca, filtro, ordem]);

  const chips: { valor: Filtro; label: string; n: number }[] = [
    { valor: "todos", label: "Todos", n: contagem.todos },
    { valor: "sem-margem", label: "Sem margem", n: contagem["sem-margem"] },
    { valor: "girar", label: "Girar (+90d)", n: contagem.girar },
    { valor: "preparacao", label: "Em preparação", n: contagem.preparacao },
  ];

  return (
    <div>
      <CabecalhoGestao
        eyebrow="Central de gestão"
        titulo="Estoque"
        apoio={`${resumo.total} veículos no pátio`}
        acoes={
          <>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-line bg-surface px-3.5 py-2 text-sm font-medium text-secondary transition-[background-color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] hover:bg-sand active:scale-[0.97]"
          >
            <FileDown size={17} strokeWidth={1.9} />
            Exportar PDF
          </button>
          <Link
            href="/gestao/estoque/novo"
            className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary shadow-[0_2px_8px_color-mix(in_srgb,var(--primary)_25%,transparent)] transition-[background-color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] hover:bg-primary-hover active:scale-[0.97]"
          >
            <Plus size={17} strokeWidth={2.25} />
            Adicionar carro
          </Link>
          </>
        }
      />

      {/* Sem banda de stat cards aqui: os mesmos três números já vivem nos chips
          de filtro logo abaixo ("Todos 8 · Sem margem 3 · Girar +90d 1"), e o
          "sem margem" ainda repetia no alerta. Era o mesmo dado quatro vezes na
          mesma tela — os chips ganham, porque além de informar, filtram. */}

      {/* Busca */}
      <div className="relative mt-6">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar modelo, ano, cor…"
          aria-label="Buscar no estoque"
          className="w-full rounded-[var(--radius)] border border-line bg-surface py-2.5 pl-11 pr-4 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </div>

      {/* Filtros + ordenação + modo */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => {
            const ativo = filtro === c.valor;
            return (
              <button
                key={c.valor}
                type="button"
                onClick={() => setFiltro(c.valor)}
                aria-pressed={ativo}
                className={`rounded-[var(--radius-control)] px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  ativo
                    ? "bg-primary text-on-primary"
                    : "border border-line bg-surface text-secondary/80 hover:bg-sand"
                }`}
              >
                {c.label}{" "}
                <span
                  className={`tabular-nums ${ativo ? "text-on-primary/75" : "text-muted"}`}
                >
                  ({c.n})
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="ordenar">
            Ordenar por
          </label>
          <div className="relative">
            <select
              id="ordenar"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
              className="cursor-pointer appearance-none rounded-[var(--radius)] border border-line bg-surface py-2 pl-3 pr-8 text-sm font-medium text-secondary focus:border-primary focus:outline-none"
            >
              {ORDENS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronRight
              size={15}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-muted"
            />
          </div>

          <div
            className="flex items-center rounded-[var(--radius)] border border-line bg-surface p-0.5"
            role="group"
            aria-label="Modo de exibição"
          >
            <button
              type="button"
              onClick={() => setModo("grade")}
              aria-pressed={modo === "grade"}
              aria-label="Ver em grade"
              className={`grid h-8 w-8 place-items-center rounded-[calc(var(--radius)-4px)] transition-colors duration-200 ${
                modo === "grade" ? "bg-primary text-on-primary" : "text-muted hover:text-secondary"
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setModo("lista")}
              aria-pressed={modo === "lista"}
              aria-label="Ver em lista"
              className={`grid h-8 w-8 place-items-center rounded-[calc(var(--radius)-4px)] transition-colors duration-200 ${
                modo === "lista" ? "bg-primary text-on-primary" : "text-muted hover:text-secondary"
              }`}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Banner de alerta — sem margem */}
      {resumo.semMargem > 0 && filtro !== "sem-margem" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-warning/25 bg-warning-bg px-4 py-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-warning text-[0.7rem] font-bold text-on-primary tabular-nums">
            {resumo.semMargem}
          </span>
          <p className="min-w-0 flex-1 text-sm text-warning-ink">
            {resumo.semMargem === 1
              ? "1 carro sem margem definida."
              : `${resumo.semMargem} carros sem margem definida.`}{" "}
            Defina a margem pra liberar o desconto pro vendedor.
          </p>
          <button
            type="button"
            onClick={() => setFiltro("sem-margem")}
            className="shrink-0 text-sm font-semibold text-warning-ink underline underline-offset-2 hover:no-underline"
          >
            Ver
          </button>
        </div>
      )}

      {/* Resultado */}
      <p className="mt-6 text-sm text-muted">
        {lista.length}{" "}
        {lista.length === 1 ? "veículo encontrado" : "veículos encontrados"}
      </p>

      {lista.length === 0 ? (
        <div className="mt-3 grid place-items-center rounded-[var(--radius)] border border-dashed border-line bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium text-secondary">
            Nenhum veículo com esse filtro.
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Ajuste a busca ou volte pra “Todos” pra ver o estoque completo.
          </p>
          <button
            type="button"
            onClick={() => {
              setBusca("");
              setFiltro("todos");
            }}
            className="mt-4 rounded-[var(--radius)] border border-line bg-surface px-3.5 py-2 text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
          >
            Limpar filtros
          </button>
        </div>
      ) : modo === "grade" ? (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {lista.map((v) => (
            <GestaoCarCard key={v.id} v={v} />
          ))}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[var(--radius)] border border-line bg-surface">
          {lista.map((v) => (
            <li key={v.id}>
              <Link
                href={`/gestao/estoque/${v.slug}`}
                className="group flex items-center gap-4 px-3 py-3 transition-colors duration-200 hover:bg-sand/60 sm:px-4"
              >
                <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-[calc(var(--radius)-5px)] bg-sand">
                  <Image
                    src={v.fotos[0]}
                    alt={v.titulo}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-secondary">
                    {v.titulo}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {v.ano} · {v.km.toLocaleString("pt-BR")} km ·{" "}
                    {v.diasEstoque === 0 ? "entrou hoje" : `${v.diasEstoque} dias`}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
                    Tabela
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-secondary">
                    {formatPreco(v.preco)}
                  </p>
                </div>
                <div className="w-32 text-right">
                  {v.statusGestao === "sem-margem" ? (
                    <span className="text-sm font-semibold text-warning-ink">
                      Sem margem
                    </span>
                  ) : (
                    <>
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
                        Lucro
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-success-ink">
                        {formatPreco(v.lucro)}
                      </p>
                    </>
                  )}
                </div>
                <ChevronRight
                  size={18}
                  className="hidden shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
