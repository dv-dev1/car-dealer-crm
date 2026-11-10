"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Percent,
  Pencil,
  UserPlus,
  CircleCheck,
  Trash2,
  TriangleAlert,
  ImageUp,
  X,
} from "lucide-react";
import { formatPreco } from "@/lib/format";
import type { VeiculoGestao } from "@/data/gestao-mock";
import {
  NovoClienteModal,
  type NovoClienteDados,
} from "@/components/gestao/NovoClienteModal";
import { adicionarLead, criarLead } from "@/lib/clientes-store";

export function CarroGestao({
  veiculo,
  estoque,
}: {
  veiculo: VeiculoGestao;
  estoque: Pick<VeiculoGestao, "id" | "titulo" | "preco">[];
}) {
  const [fotoAtiva, setFotoAtiva] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Margem — editável localmente (sem backend ainda). Inicia com o mock.
  const [margemDefinida, setMargemDefinida] = useState(veiculo.margemDefinida);
  const [descontoMax, setDescontoMax] = useState(veiculo.descontoMax);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(String(veiculo.descontoMax || ""));

  const minimoAVista = veiculo.preco - (margemDefinida ? descontoMax : 0);
  const lucro = minimoAVista - veiculo.custo;

  const specs = useMemo(
    () =>
      [
        veiculo.ano,
        `${veiculo.km.toLocaleString("pt-BR")} km`,
        veiculo.cambio,
        veiculo.combustivel,
      ]
        .filter(Boolean)
        .join(" · "),
    [veiculo],
  );

  function emBreve(o: string) {
    setAviso(`${o} entra na próxima fase (com o Supabase plugado).`);
    window.clearTimeout((emBreve as unknown as { t?: number }).t);
    (emBreve as unknown as { t?: number }).t = window.setTimeout(
      () => setAviso(null),
      3200,
    );
  }

  function salvarMargem(e: React.FormEvent) {
    e.preventDefault();
    const valor = Math.max(0, Math.round(Number(rascunho) || 0));
    setDescontoMax(valor);
    setMargemDefinida(true);
    setEditando(false);
  }

  // Registra o cliente no funil de Clientes (mesmo store do kanban). O modal
  // vem com este carro pré-selecionado; resolvemos o título pra gravar no lead.
  function registrarCliente(dados: NovoClienteDados) {
    const carro = estoque.find((v) => v.id === dados.veiculoId)?.titulo;
    adicionarLead(criarLead(dados, carro));
  }

  const acaoSecundaria =
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] border px-4 py-2.5 text-sm font-semibold transition-colors duration-200";

  return (
    <div className="pb-4">
      {/* Voltar */}
      <Link
        href="/gestao/estoque"
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
      >
        <ArrowLeft size={16} />
        Voltar ao estoque
      </Link>

      {/* Título + specs */}
      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight text-secondary">
            {veiculo.titulo}
          </h1>
          <p className="mt-1.5 text-sm text-muted-strong">{specs}</p>
        </div>
        <span className="shrink-0 rounded-full bg-sand px-3 py-1 text-xs font-medium text-secondary/80">
          {veiculo.diasEstoque === 0
            ? "Entrou hoje"
            : `${veiculo.diasEstoque} dias no estoque`}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Coluna da foto */}
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius)] border border-line bg-sand">
            <Image
              src={veiculo.fotos[fotoAtiva]}
              alt={veiculo.titulo}
              fill
              sizes="(max-width: 1024px) 100vw, 620px"
              priority
              className="object-cover"
            />
          </div>
          {veiculo.fotos.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {veiculo.fotos.slice(0, 5).map((f, i) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFotoAtiva(i)}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-current={i === fotoAtiva}
                  className={`relative aspect-square overflow-hidden rounded-[calc(var(--radius)-5px)] border transition-colors duration-200 ${
                    i === fotoAtiva
                      ? "border-primary"
                      : "border-line hover:border-primary/40"
                  }`}
                >
                  <Image src={f} alt="" fill sizes="120px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Painel admin */}
        <div className="flex flex-col gap-4">
          {/* Preço de tabela */}
          <div className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-end justify-between gap-3">
              <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                Preço de tabela
              </span>
              <span className="text-2xl font-semibold tabular-nums text-secondary">
                {formatPreco(veiculo.preco)}
              </span>
            </div>

            {/* Estado da margem */}
            {!margemDefinida ? (
              <div className="mt-4 rounded-[calc(var(--radius)-2px)] bg-warning-bg px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-warning-ink">
                  <TriangleAlert size={16} />
                  Sem desconto liberado
                </p>
                <p className="mt-1 text-sm text-warning-ink/85">
                  Margem ainda não definida. Não ofereça desconto sem confirmar
                  com o gerente.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-[calc(var(--radius)-2px)] bg-success-bg px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-success-ink/80">
                    Mínimo à vista
                  </span>
                  <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-success-ink">
                    −{formatPreco(descontoMax)}
                  </span>
                </div>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-success-ink">
                  {formatPreco(minimoAVista)}
                </p>
              </div>
            )}
          </div>

          {/* Visão do administrador */}
          <div className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
              Visão do administrador
            </p>

            {editando ? (
              <form onSubmit={salvarMargem} className="mt-3">
                <label className="text-sm font-medium text-secondary" htmlFor="desc">
                  Desconto máximo à vista
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                      R$
                    </span>
                    <input
                      id="desc"
                      autoFocus
                      inputMode="numeric"
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                      className="w-full rounded-[calc(var(--radius)-2px)] border border-line bg-surface py-2.5 pl-9 pr-3 text-sm tabular-nums text-secondary focus:border-primary focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-[calc(var(--radius)-2px)] bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-hover"
                  >
                    Liberar
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  O vendedor passa a ver o mínimo à vista. Lucro previsto:{" "}
                  <span className="font-semibold tabular-nums text-success-ink">
                    {formatPreco(veiculo.preco - (Number(rascunho) || 0) - veiculo.custo)}
                  </span>
                </p>
              </form>
            ) : (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Custo de aquisição</dt>
                  <dd className="font-semibold tabular-nums text-secondary">
                    {formatPreco(veiculo.custo)}
                  </dd>
                </div>
                {margemDefinida ? (
                  <div className="flex items-center justify-between border-t border-line pt-2">
                    <dt className="text-muted">Lucro no mínimo à vista</dt>
                    <dd className="font-semibold tabular-nums text-success-ink">
                      {formatPreco(lucro)}
                    </dd>
                  </div>
                ) : (
                  <p className="border-t border-line pt-2 text-muted">
                    Margem ainda não definida. O vendedor não vê desconto até você
                    definir.
                  </p>
                )}
              </dl>
            )}
          </div>

          {/* Ações */}
          <div className="grid gap-2.5">
            {!editando && (
              <button
                type="button"
                onClick={() => {
                  setRascunho(String(margemDefinida ? descontoMax : ""));
                  setEditando(true);
                }}
                className={
                  margemDefinida
                    ? `${acaoSecundaria} border-primary/30 bg-primary/8 text-primary hover:bg-primary/14`
                    : `${acaoSecundaria} border-transparent bg-warning text-white shadow-[0_2px_8px_rgba(183,121,31,0.25)] hover:bg-warning-ink`
                }
              >
                <Percent size={16} />
                {margemDefinida ? "Editar margem" : "Definir margem"}
              </button>
            )}

            <button
              type="button"
              onClick={() => emBreve("Edição de carro / foto")}
              className={`${acaoSecundaria} border-line bg-surface text-secondary hover:bg-sand`}
            >
              <ImageUp size={16} />
              Editar carro / foto
            </button>

            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(181,110,53,0.25)] transition-colors duration-200 hover:bg-primary-hover"
            >
              <UserPlus size={17} />
              Registrar cliente / negociação
            </button>

            <div className="mt-1 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => emBreve("Marcar como vendido")}
                className={`${acaoSecundaria} border-success/35 bg-success-bg text-success-ink hover:bg-success/12`}
              >
                <CircleCheck size={16} />
                Marcar como vendido
              </button>
              <button
                type="button"
                onClick={() => emBreve("Remoção de veículo")}
                className={`${acaoSecundaria} border-danger/30 bg-surface text-danger-ink hover:bg-danger-bg`}
              >
                <Trash2 size={16} />
                Remover carro
              </button>
            </div>
          </div>
        </div>
      </div>

      <NovoClienteModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        veiculos={estoque}
        veiculoInicialId={veiculo.id}
        onSalvar={registrarCliente}
      />

      {/* Toast */}
      {aviso && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-[70] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-[var(--radius)] bg-inverso px-4 py-3 text-sm text-white shadow-[var(--shadow-hover)]"
        >
          <span>{aviso}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Fechar aviso"
            className="text-white/70 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
