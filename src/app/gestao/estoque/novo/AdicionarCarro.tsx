"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ImagePlus, X, Check, Star, Lock } from "lucide-react";
import {
  CATEGORIAS,
  CAMBIOS,
  COMBUSTIVEIS,
  CORES,
  PORTAS,
  OPCIONAIS,
} from "@/data/opcoes-veiculo";

interface Foto {
  id: string;
  url: string;
}

function lerArquivo(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

const milhar = (digitos: string) =>
  digitos ? Number(digitos).toLocaleString("pt-BR") : "";

const campo =
  "w-full rounded-[calc(var(--radius)-2px)] border border-line bg-surface px-3 py-2.5 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none";
const rotulo = "text-sm font-medium text-secondary";
const cartao =
  "rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6";

export function AdicionarCarro() {
  const inputFotos = useRef<HTMLInputElement>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [dados, setDados] = useState({
    nome: "", marca: "", categoria: "", ano: "", km: "", portas: "",
    cor: "", cambio: "", combustivel: "", precoVenda: "", custo: "", aquisicao: "",
  });
  const [opcionais, setOpcionais] = useState<Set<string>>(new Set());
  const [destaque, setDestaque] = useState(false);
  const [erros, setErros] = useState<{ nome?: string; preco?: string; fotos?: string }>({});
  const [enviado, setEnviado] = useState(false);

  const set = (campo: keyof typeof dados) => (v: string) =>
    setDados((d) => ({ ...d, [campo]: v }));

  async function adicionarFotos(lista: FileList | null) {
    if (!lista) return;
    const imgs = Array.from(lista).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    const urls = await Promise.all(imgs.map(lerArquivo));
    setFotos((prev) => [
      ...prev,
      ...urls.map((url, i) => ({ id: `${Date.now()}-${i}-${Math.random()}`, url })),
    ]);
    setErros((e) => ({ ...e, fotos: undefined }));
  }

  function removerFoto(id: string) {
    setFotos((prev) => prev.filter((f) => f.id !== id));
  }

  function toggleOpcional(o: string) {
    setOpcionais((prev) => {
      const n = new Set(prev);
      n.has(o) ? n.delete(o) : n.add(o);
      return n;
    });
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const novos: typeof erros = {};
    if (!dados.nome.trim()) novos.nome = "Dê um nome pro carro.";
    if (!dados.precoVenda || Number(dados.precoVenda) <= 0)
      novos.preco = "Informe o preço de venda.";
    if (fotos.length === 0) novos.fotos = "Adicione pelo menos 1 foto.";
    setErros(novos);
    if (Object.keys(novos).length > 0) {
      document
        .querySelector('[data-erro="1"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setEnviado(true);
  }

  function recomecar() {
    setFotos([]);
    setDados({
      nome: "", marca: "", categoria: "", ano: "", km: "", portas: "",
      cor: "", cambio: "", combustivel: "", precoVenda: "", custo: "", aquisicao: "",
    });
    setOpcionais(new Set());
    setDestaque(false);
    setErros({});
    setEnviado(false);
  }

  if (enviado) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-bg text-success">
          <Check size={32} strokeWidth={2.2} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-secondary">
          Carro adicionado
        </h1>
        <p className="mt-2 text-sm text-muted-strong">
          <span className="font-medium text-secondary">
            {dados.nome.trim()}
          </span>{" "}
          entrou no cadastro com {fotos.length}{" "}
          {fotos.length === 1 ? "foto" : "fotos"} e {opcionais.size}{" "}
          {opcionais.size === 1 ? "opcional" : "opcionais"}.
        </p>
        <p className="mt-1.5 text-xs text-muted-strong">
          Fase de demonstração — o veículo ainda não é gravado no banco. Some
          assim que o Supabase entrar.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/gestao/estoque"
            className="rounded-[var(--radius)] border border-line bg-surface px-4 py-2.5 text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
          >
            Voltar ao estoque
          </Link>
          <button
            type="button"
            onClick={recomecar}
            className="rounded-[var(--radius)] bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-hover"
          >
            Adicionar outro
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="pb-8">
      <Link
        href="/gestao/estoque"
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
      >
        <ArrowLeft size={16} />
        Voltar ao estoque
      </Link>

      <h1 className="mt-5 text-2xl font-semibold text-secondary">
        Adicionar carro
      </h1>

      {/* Fotos */}
      <section className={`${cartao} mt-6`} data-erro={erros.fotos ? "1" : undefined}>
        <h2 className="text-base font-semibold text-secondary">Fotos do carro</h2>
        <p className="mt-1 text-sm text-muted-strong">
          Pelo menos 1 foto. A primeira vira a capa. Pode adicionar quantas
          quiser.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fotos.map((f, i) => (
            <div
              key={f.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-[calc(var(--radius)-2px)] border border-line bg-sand"
            >
              <Image src={f.url} alt={`Foto ${i + 1}`} fill className="object-cover" unoptimized />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-white">
                  Capa
                </span>
              )}
              <button
                type="button"
                onClick={() => removerFoto(f.id)}
                aria-label={`Remover foto ${i + 1}`}
                className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-inverso/70 text-white opacity-0 transition-opacity duration-200 hover:bg-inverso group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X size={13} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => inputFotos.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              adicionarFotos(e.dataTransfer.files);
            }}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-[calc(var(--radius)-2px)] border border-dashed border-line bg-sand/30 text-muted-strong transition-colors duration-200 hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
          >
            <ImagePlus size={22} strokeWidth={1.75} />
            <span className="text-xs font-medium">Adicionar</span>
          </button>
        </div>

        <input
          ref={inputFotos}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            adicionarFotos(e.target.files);
            e.target.value = "";
          }}
        />
        {erros.fotos && <p className="mt-2 text-[0.8125rem] text-danger-ink">{erros.fotos}</p>}
      </section>

      {/* Dados + Valores */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        {/* Dados do carro */}
        <section className={cartao} data-erro={erros.nome ? "1" : undefined}>
          <h2 className="text-base font-semibold text-secondary">Dados do carro</h2>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className={rotulo} htmlFor="nome">
                Nome completo <span className="text-danger">*</span>
              </label>
              <input
                id="nome"
                value={dados.nome}
                onChange={(e) => {
                  set("nome")(e.target.value);
                  if (erros.nome) setErros((x) => ({ ...x, nome: undefined }));
                }}
                placeholder="Ex: Toyota Corolla 2.0 XEI Flex Aut. 4p 2023"
                aria-invalid={!!erros.nome}
                className={`${campo} mt-1.5 ${erros.nome ? "border-danger" : ""}`}
              />
              {erros.nome && <p className="mt-1.5 text-[0.8125rem] text-danger-ink">{erros.nome}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Texto label="Marca" id="marca" value={dados.marca} onChange={set("marca")} placeholder="Toyota" />
              <Selecao label="Categoria" id="categoria" value={dados.categoria} onChange={set("categoria")} opcoes={CATEGORIAS} />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Texto label="Ano" id="ano" value={dados.ano} onChange={(v) => set("ano")(v.replace(/\D/g, "").slice(0, 4))} placeholder="2023" inputMode="numeric" />
              <Texto label="KM" id="km" value={milhar(dados.km)} onChange={(v) => set("km")(v.replace(/\D/g, ""))} placeholder="45.000" inputMode="numeric" />
              <Selecao label="Portas" id="portas" value={dados.portas} onChange={set("portas")} opcoes={PORTAS} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Selecao label="Cor" id="cor" value={dados.cor} onChange={set("cor")} opcoes={CORES} />
              <Selecao label="Câmbio" id="cambio" value={dados.cambio} onChange={set("cambio")} opcoes={CAMBIOS} />
              <Selecao label="Combustível" id="combustivel" value={dados.combustivel} onChange={set("combustivel")} opcoes={COMBUSTIVEIS} />
            </div>
          </div>
        </section>

        {/* Valores — fundo areia distinto + cadeado: sinaliza que é painel
            confidencial (só admin), justificando a coluna mais curta. */}
        <section
          className="rounded-[var(--radius)] border border-line bg-sand/45 p-5 shadow-[var(--shadow-soft)] sm:p-6"
          data-erro={erros.preco ? "1" : undefined}
        >
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
              <Lock size={14} strokeWidth={2} />
            </span>
            <h2 className="text-base font-semibold text-secondary">Valores</h2>
          </div>
          <p className="mt-1.5 text-xs text-muted-strong">
            Só o administrador vê. O vendedor nunca enxerga custo nem lucro.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <Moeda
              label="Preço de venda" obrigatorio ajuda="Valor anunciado do carro (preço de tabela)."
              value={dados.precoVenda}
              onChange={(v) => { set("precoVenda")(v); if (erros.preco) setErros((x) => ({ ...x, preco: undefined })); }}
              erro={erros.preco}
            />
            <Moeda label="Custo" ajuda="Quanto você pagou no carro." value={dados.custo} onChange={set("custo")} />
            <div>
              <label className={rotulo} htmlFor="aquisicao">Data de aquisição</label>
              <p className="mt-0.5 text-xs text-muted-strong">Pra calcular o giro no estoque.</p>
              <input
                id="aquisicao" type="date" value={dados.aquisicao}
                onChange={(e) => set("aquisicao")(e.target.value)}
                className={`${campo} mt-1.5`}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Opcionais e destaque */}
      <section className={`${cartao} mt-5`}>
        <h2 className="text-base font-semibold text-secondary">Opcionais e destaque</h2>
        <p className="mt-1 text-sm text-muted-strong">
          Clique para marcar os opcionais. Pode marcar quantos quiser.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {OPCIONAIS.map((o) => {
            const ativo = opcionais.has(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggleOpcional(o)}
                aria-pressed={ativo}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  ativo
                    ? "bg-primary text-white"
                    : "border border-line bg-surface text-secondary/80 hover:bg-sand"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>

        <label className="mt-5 flex w-fit cursor-pointer items-center gap-3 rounded-[calc(var(--radius)-2px)] border border-line bg-sand/30 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
            <Star size={16} strokeWidth={2} fill={destaque ? "currentColor" : "none"} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium text-secondary">Destacar na home</span>
            <span className="block text-xs text-muted-strong">Aparece na vitrine de destaques do site.</span>
          </span>
          <input
            type="checkbox"
            checked={destaque}
            onChange={(e) => setDestaque(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
        </label>
      </section>

      {/* Ações */}
      <div className="mt-6 flex items-center justify-end gap-3">
        <Link
          href="/gestao/estoque"
          className="rounded-[var(--radius)] border border-line bg-surface px-4 py-2.5 text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          className="rounded-[var(--radius)] bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(181,110,53,0.25)] transition-colors duration-200 hover:bg-primary-hover"
        >
          Salvar carro
        </button>
      </div>
    </form>
  );
}

// ─── Campos ──────────────────────────────────────────────────

function Texto({
  label, id, value, onChange, placeholder, inputMode,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; inputMode?: "numeric" | "text";
}) {
  return (
    <div>
      <label className={rotulo} htmlFor={id}>{label}</label>
      <input
        id={id} value={value} inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${campo} mt-1.5`}
      />
    </div>
  );
}

function Selecao({
  label, id, value, onChange, opcoes,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  opcoes: readonly string[];
}) {
  return (
    <div>
      <label className={rotulo} htmlFor={id}>{label}</label>
      <select
        id={id} value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${campo} mt-1.5 cursor-pointer ${value ? "" : "text-muted"}`}
      >
        <option value="">Selecionar</option>
        {opcoes.map((o) => (
          <option key={o} value={o} className="text-secondary">{o}</option>
        ))}
      </select>
    </div>
  );
}

function Moeda({
  label, obrigatorio, ajuda, value, onChange, erro,
}: {
  label: string; obrigatorio?: boolean; ajuda?: string;
  value: string; onChange: (v: string) => void; erro?: string;
}) {
  return (
    <div>
      <label className={rotulo}>
        {label} {obrigatorio && <span className="text-danger">*</span>}
      </label>
      {ajuda && <p className="mt-0.5 text-xs text-muted-strong">{ajuda}</p>}
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
        <input
          inputMode="numeric"
          value={milhar(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder="0"
          aria-invalid={!!erro}
          className={`${campo} pl-9 tabular-nums ${erro ? "border-danger" : ""}`}
        />
      </div>
      {erro && <p className="mt-1.5 text-[0.8125rem] text-danger-ink">{erro}</p>}
    </div>
  );
}
