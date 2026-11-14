"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, X, Star, Lock } from "lucide-react";
import {
  CATEGORIAS,
  CAMBIOS,
  COMBUSTIVEIS,
  CORES,
  PORTAS,
  OPCIONAIS,
} from "@/data/opcoes-veiculo";
import type { StockVehicle } from "@/features/stock/model";
import { addPhotoAction, removePhotoAction, saveVehicleAction } from "@/features/stock/actions";
import { syncPhotos, type FormPhoto } from "@/features/stock/photo-sync";
import { resizePhoto } from "@/features/stock/resize";

const MAX_PHOTO_BYTES = 2_000_000;
const FORMATO_INVALIDO = "Formato de foto não aceito; use JPG, PNG ou WebP.";

// Reduz no navegador; se não der (HEIC no Chrome, por exemplo), envia o original quando ele cabe no limite.
async function prepararFoto(file: File): Promise<Blob> {
  try {
    return await resizePhoto(file);
  } catch {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= MAX_PHOTO_BYTES) return file;
    throw new Error(FORMATO_INVALIDO);
  }
}

const milhar = (digitos: string) =>
  digitos ? Number(digitos).toLocaleString("pt-BR") : "";

const campo =
  "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none";
const rotulo = "text-sm font-medium text-secondary";
const cartao =
  "rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6";

function dadosIniciais(v: StockVehicle | undefined, today: string) {
  return {
    marca: v?.brand ?? "", modelo: v?.model ?? "", versao: v?.version ?? "",
    anoFabricacao: v ? String(v.manufactureYear) : "", anoModelo: v ? String(v.modelYear) : "",
    km: v ? String(v.km) : "", portas: v?.doors ? String(v.doors) : "", categoria: v?.bodyType ?? "",
    cor: v?.color ?? "", cambio: v?.transmission ?? "", combustivel: v?.fuel ?? "",
    precoVenda: v ? String(v.price) : "", custo: v?.money ? String(v.money.acquisitionCost) : "",
    aquisicao: v?.enteredOn ?? today, descricao: v?.description ?? "",
  };
}

/** Cadastro e edição do carro. Grava o carro, depois as fotos uma a uma, e abre a página do carro.
 *  Se uma foto falha, fica na tela com o aviso; salvar de novo envia só o que faltou. */
export function AdicionarCarro({ vehicle, today }: { vehicle?: StockVehicle; today: string }) {
  const router = useRouter();
  const inputFotos = useRef<HTMLInputElement>(null);
  const [fotos, setFotos] = useState<FormPhoto[]>(
    () => vehicle?.photos.map((f) => ({ id: f.id, url: f.url, savedId: f.id })) ?? [],
  );
  const [removidas, setRemovidas] = useState<string[]>([]);
  const [dados, setDados] = useState(() => dadosIniciais(vehicle, today));
  const [opcionais, setOpcionais] = useState<Set<string>>(new Set(vehicle?.features ?? []));
  const [destaque, setDestaque] = useState(vehicle?.featured ?? false);
  const [pronto, setPronto] = useState(vehicle ? vehicle.status !== "preparing" : true);
  const [erros, setErros] = useState<{ modelo?: string; preco?: string; fotos?: string }>({});
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [criado, setCriado] = useState<{ id: string; slug: string } | null>(null);
  const consignado = vehicle?.source === "consignment";

  // Prévias das fotos novas são URLs do navegador; soltas quando a tela fecha.
  useEffect(() => () => fotos.forEach((f) => f.file && URL.revokeObjectURL(f.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (campo: keyof typeof dados) => (v: string) =>
    setDados((d) => ({ ...d, [campo]: v }));

  function adicionarFotos(lista: FileList | null) {
    if (!lista) return;
    const imgs = Array.from(lista).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (imgs.length === 0) return;
    setFotos((prev) => [
      ...prev,
      ...imgs.map((file, i) => ({ id: `${Date.now()}-${i}-${Math.random()}`, url: URL.createObjectURL(file), file })),
    ]);
    setErros((e) => ({ ...e, fotos: undefined }));
  }

  function removerFoto(id: string) {
    const foto = fotos.find((f) => f.id === id);
    if (foto?.savedId) setRemovidas((r) => [...r, foto.savedId!]);
    setFotos((prev) => prev.filter((f) => f.id !== id));
  }

  function toggleOpcional(o: string) {
    setOpcionais((prev) => {
      const n = new Set(prev);
      n.has(o) ? n.delete(o) : n.add(o);
      return n;
    });
  }

  function formulario() {
    const form = new FormData();
    const id = vehicle?.id ?? criado?.id;
    if (id) form.set("id", id);
    const campos: Record<string, string> = {
      brand: dados.marca, model: dados.modelo, version: dados.versao, manufactureYear: dados.anoFabricacao,
      modelYear: dados.anoModelo, km: dados.km, doors: dados.portas, bodyType: dados.categoria, color: dados.cor,
      transmission: dados.cambio, fuel: dados.combustivel, price: dados.precoVenda, acquisitionCost: dados.custo || "0",
      enteredOn: dados.aquisicao, description: dados.descricao,
    };
    for (const [nome, valor] of Object.entries(campos)) form.set(nome, valor);
    for (const o of opcionais) form.append("features", o);
    if (destaque) form.set("featured", "on");
    if (pronto) form.set("ready", "on");
    return form;
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const novos: typeof erros = {};
    if (!dados.modelo.trim()) novos.modelo = "Diga o modelo do carro.";
    if (!dados.precoVenda || Number(dados.precoVenda) <= 0) novos.preco = "Informe o preço de venda.";
    if (!vehicle && fotos.length === 0) novos.fotos = "Adicione pelo menos 1 foto.";
    setErros(novos);
    setErroServidor(null);
    if (Object.keys(novos).length > 0) {
      document.querySelector('[data-erro="1"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSalvando(true);
    let saiu = false;
    try {
      // Every new photo is reduced first: one that cannot go up stops the save before anything is written.
      let preparadas: FormPhoto[];
      try {
        preparadas = await Promise.all(
          fotos.map(async (f) => (f.savedId || f.upload || !f.file ? f : { ...f, upload: await prepararFoto(f.file) })),
        );
      } catch {
        setErroServidor(FORMATO_INVALIDO);
        return;
      }
      setFotos(preparadas);

      const salvo = await saveVehicleAction({ error: null }, formulario());
      if (salvo.error || !salvo.id || !salvo.slug) {
        setErroServidor(salvo.error ?? "Não foi possível salvar.");
        return;
      }
      // From here on a new save edits this car instead of creating another one.
      if (!vehicle) setCriado({ id: salvo.id, slug: salvo.slug });

      const r = await syncPhotos(salvo.id, preparadas, removidas, { add: addPhotoAction, remove: removePhotoAction });
      setFotos(r.photos);
      setRemovidas(r.removed);
      if (r.error) {
        const contagem = r.total > 0 ? `${r.sent} de ${r.total} fotos novas entraram. ` : "";
        setErroServidor(`Carro salvo. ${contagem}${r.error} Salve de novo para tentar outra vez.`);
        return;
      }
      saiu = true;
      router.push(`/gestao/estoque/${salvo.slug}`);
    } catch {
      setErroServidor("Não foi possível salvar. Confira a internet e tente de novo.");
    } finally {
      if (!saiu) setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="pb-8">
      <Link
        href={vehicle ? `/gestao/estoque/${vehicle.slug}` : "/gestao/estoque"}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
      >
        <ArrowLeft size={16} />
        {vehicle ? "Voltar ao carro" : "Voltar ao estoque"}
      </Link>

      <h1 className="mt-5 text-2xl font-semibold text-secondary">
        {vehicle ? "Editar carro" : "Adicionar carro"}
      </h1>

      {/* Fotos */}
      <section className={`${cartao} mt-6`} data-erro={erros.fotos ? "1" : undefined}>
        <h2 className="text-base font-semibold text-secondary">Fotos do carro</h2>
        <p className="mt-1 text-sm text-muted-strong">
          Pelo menos 1 foto. A primeira vira a capa. Até 20 fotos.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fotos.map((f, i) => (
            <div
              key={f.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-[calc(var(--radius)-2px)] border border-line bg-sand"
            >
              <Image src={f.url} alt={`Foto ${i + 1}`} fill sizes="200px" className="object-cover" unoptimized />
              {i === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-[var(--radius-control)] bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-on-primary">
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
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
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
        <section className={cartao} data-erro={erros.modelo ? "1" : undefined}>
          <h2 className="text-base font-semibold text-secondary">Dados do carro</h2>

          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Texto label="Marca" id="marca" value={dados.marca} onChange={set("marca")} placeholder="Chevrolet" />
              <div>
                <label className={rotulo} htmlFor="modelo">
                  Modelo <span className="text-danger">*</span>
                </label>
                <input
                  id="modelo"
                  value={dados.modelo}
                  onChange={(e) => {
                    set("modelo")(e.target.value);
                    if (erros.modelo) setErros((x) => ({ ...x, modelo: undefined }));
                  }}
                  placeholder="Onix"
                  aria-invalid={!!erros.modelo}
                  className={`${campo} mt-1.5 ${erros.modelo ? "border-danger" : ""}`}
                />
                {erros.modelo && <p className="mt-1.5 text-[0.8125rem] text-danger-ink">{erros.modelo}</p>}
              </div>
              <Texto label="Versão" id="versao" value={dados.versao} onChange={set("versao")} placeholder="LT 1.0 Turbo" />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Texto label="Ano de fabricação" id="anoFabricacao" value={dados.anoFabricacao} onChange={(v) => set("anoFabricacao")(v.replace(/\D/g, "").slice(0, 4))} placeholder="2022" inputMode="numeric" />
              <Texto label="Ano do modelo" id="anoModelo" value={dados.anoModelo} onChange={(v) => set("anoModelo")(v.replace(/\D/g, "").slice(0, 4))} placeholder="2023" inputMode="numeric" />
              <Texto label="KM" id="km" value={milhar(dados.km)} onChange={(v) => set("km")(v.replace(/\D/g, ""))} placeholder="45.000" inputMode="numeric" />
              <Selecao label="Portas" id="portas" value={dados.portas} onChange={set("portas")} opcoes={PORTAS} />
            </div>

            <Selecao label="Categoria" id="categoria" value={dados.categoria} onChange={set("categoria")} opcoes={CATEGORIAS} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Selecao label="Cor" id="cor" value={dados.cor} onChange={set("cor")} opcoes={CORES} />
              <Selecao label="Câmbio" id="cambio" value={dados.cambio} onChange={set("cambio")} opcoes={CAMBIOS} />
              <Selecao label="Combustível" id="combustivel" value={dados.combustivel} onChange={set("combustivel")} opcoes={COMBUSTIVEIS} />
            </div>

            <div>
              <label className={rotulo} htmlFor="descricao">Descrição</label>
              <textarea
                id="descricao"
                value={dados.descricao}
                onChange={(e) => set("descricao")(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Estado, revisões, dono único…"
                className={`${campo} mt-1.5`}
              />
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
            <Moeda
              label={consignado ? "Repasse ao dono" : "Preço de compra"}
              ajuda={consignado ? "Quanto a loja repassa ao dono do carro." : "Quanto você pagou no carro, sem as despesas."}
              value={dados.custo}
              onChange={set("custo")}
            />
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
                className={`rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
                  ativo
                    ? "bg-primary text-on-primary"
                    : "border border-line bg-surface text-secondary/80 hover:bg-sand"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>

        <label className="mt-5 flex w-fit cursor-pointer items-center gap-3 rounded-[calc(var(--radius)-2px)] border border-line bg-sand/30 px-4 py-3">
          <span className="flex-1">
            <span className="block text-sm font-medium text-secondary">Pronto para anunciar</span>
            <span className="block text-xs text-muted-strong">Desmarcado, o carro fica em preparação e sai do site.</span>
          </span>
          <input
            type="checkbox"
            checked={pronto}
            onChange={(e) => setPronto(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
        </label>

        <label className="mt-3 flex w-fit cursor-pointer items-center gap-3 rounded-[calc(var(--radius)-2px)] border border-line bg-sand/30 px-4 py-3">
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
      {erroServidor && (
        <p role="alert" className="mt-6 text-right text-sm text-danger-ink">
          {erroServidor}
        </p>
      )}
      <div className="mt-4 flex items-center justify-end gap-3">
        <Link
          href={vehicle ? `/gestao/estoque/${vehicle.slug}` : "/gestao/estoque"}
          className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2.5 text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={salvando}
          className="rounded-[var(--radius-control)] bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar carro"}
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
