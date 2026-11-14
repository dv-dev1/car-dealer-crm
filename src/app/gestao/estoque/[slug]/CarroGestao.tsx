"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Percent,
  Pencil,
  UserPlus,
  Trash2,
  TriangleAlert,
  ImageUp,
  X,
} from "lucide-react";
import { formatPreco } from "@/lib/format";
import type { StockVehicle } from "@/features/stock/model";
import { STATUS_LABEL } from "@/features/stock/rules";
import { removeVehicleAction, setMarginAction } from "@/features/stock/actions";
import {
  NovoClienteModal,
  type NovoClienteDados,
} from "@/components/gestao/NovoClienteModal";
import { adicionarLead, criarLead } from "@/lib/clientes-store";

export function CarroGestao({
  veiculo,
  estoque,
  canManage,
}: {
  veiculo: StockVehicle;
  estoque: { id: string; titulo: string; preco: number }[];
  canManage: boolean;
}) {
  const [fotoAtiva, setFotoAtiva] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [margemDefinida, setMargemDefinida] = useState(veiculo.minCashPrice !== null);
  const [descontoMax, setDescontoMax] = useState(veiculo.price - (veiculo.minCashPrice ?? veiculo.price));
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(String(descontoMax || ""));

  const minimoAVista = veiculo.price - (margemDefinida ? descontoMax : 0);
  const custo = veiculo.money?.cost ?? 0;
  const lucro = minimoAVista - custo;
  const fotos = veiculo.photos.map((f) => f.url);

  const specs = useMemo(
    () =>
      [
        veiculo.modelYear,
        `${veiculo.km.toLocaleString("pt-BR")} km`,
        veiculo.transmission,
        veiculo.fuel,
      ]
        .filter(Boolean)
        .join(" · "),
    [veiculo],
  );

  const [salvandoMargem, setSalvandoMargem] = useState(false);

  async function salvarMargem(e: React.FormEvent) {
    e.preventDefault();
    const valor = Math.max(0, Math.round(Number(rascunho) || 0));
    const form = new FormData();
    form.set("vehicleId", veiculo.id);
    form.set("discount", String(valor));
    setSalvandoMargem(true);
    const r = await setMarginAction({ error: null }, form);
    setSalvandoMargem(false);
    if (r.error) {
      setAviso(r.error);
      return;
    }
    setAviso(null);
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
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-sand";

  return (
    <div className="pb-4">
      {/* Voltar */}
      <Link
        href="/gestao/estoque"
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
      >
        <ArrowLeft size={16} />
        Voltar ao estoque
      </Link>

      {/* Título + specs */}
      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight text-secondary">
            {veiculo.title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-strong">{specs}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {veiculo.status !== "available" && (
            <span className="rounded-[var(--radius-control)] bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {STATUS_LABEL[veiculo.status]}
            </span>
          )}
          <span className="rounded-[var(--radius-control)] bg-sand px-3 py-1 text-xs font-medium text-secondary/80">
            {veiculo.daysInStock === 0 ? "Entrou hoje" : `${veiculo.daysInStock} dias no estoque`}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Coluna da foto */}
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius)] border border-line bg-sand">
            {fotos[fotoAtiva] ? (
              <Image
                src={fotos[fotoAtiva]}
                alt={veiculo.title}
                fill
                sizes="(max-width: 1024px) 100vw, 620px"
                priority
                unoptimized
                className="object-cover"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-sm font-medium text-muted">Sem foto</span>
            )}
          </div>
          {fotos.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {fotos.slice(0, 5).map((f, i) => (
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
                  <Image src={f} alt="" fill sizes="120px" unoptimized className="object-cover" />
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
              <span data-kpi className="text-2xl font-semibold tabular-nums text-secondary">
                {formatPreco(veiculo.price)}
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
                  <span className="rounded-[var(--radius-control)] bg-success/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-success-ink">
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
          {canManage && veiculo.money && (
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
                      className="w-full rounded-[var(--radius-control)] border border-line bg-surface py-2.5 pl-9 pr-3 text-sm tabular-nums text-secondary focus:border-primary focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={salvandoMargem}
                    className="rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
                  >
                    Liberar
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  O vendedor passa a ver o mínimo à vista. Lucro previsto:{" "}
                  <span className="font-semibold tabular-nums text-success-ink">
                    {formatPreco(veiculo.price - (Number(rascunho) || 0) - custo)}
                  </span>
                </p>
              </form>
            ) : (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Custo com despesas</dt>
                  <dd className="font-semibold tabular-nums text-secondary">
                    {formatPreco(custo)}
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
          )}

          {/* Ações: one primary, outline secondaries, a text button for the destructive one. */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover sm:col-span-2"
            >
              <UserPlus size={17} />
              Registrar cliente / negociação
            </button>

            {canManage && !editando && (
              <button
                type="button"
                onClick={() => {
                  setRascunho(String(margemDefinida ? descontoMax : ""));
                  setEditando(true);
                }}
                className={acaoSecundaria}
              >
                <Percent size={16} className={margemDefinida ? undefined : "text-warning"} />
                {margemDefinida ? "Editar margem" : "Definir margem"}
              </button>
            )}

            {canManage && (
            <>
            {veiculo.status !== "sold" && (
              <Link href={`/gestao/estoque/${veiculo.slug}/editar`} className={acaoSecundaria}>
                <ImageUp size={16} />
                Editar carro / foto
              </Link>
            )}

            {veiculo.status !== "sold" && <RemoverCarro veiculo={veiculo} />}
            </>
            )}
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

/** "Remover carro" asks for the reason on the page itself; the car leaves the stock, its history stays. */
function RemoverCarro({ veiculo }: { veiculo: StockVehicle }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, acao, enviando] = useActionState(removeVehicleAction, { error: null });

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold text-danger-ink transition-colors duration-200 hover:bg-danger-bg"
      >
        <Trash2 size={16} />
        Remover carro
      </button>
    );
  }

  return (
    <form action={acao} className="space-y-3 rounded-[var(--radius)] border border-danger/30 bg-danger-bg p-4 sm:col-span-2">
      <input type="hidden" name="vehicleId" value={veiculo.id} />
      <p className="text-sm font-semibold text-danger-ink">Tirar este carro do estoque?</p>
      <p className="text-sm text-danger-ink/85">Ele some do estoque e do site. O histórico fica guardado.</p>
      <label htmlFor="motivo-remocao" className="block text-sm font-medium text-secondary">
        Motivo
      </label>
      <select
        id="motivo-remocao"
        name="reason"
        defaultValue="wrong_entry"
        className="w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary"
      >
        <option value="wrong_entry">Cadastro errado</option>
        {veiculo.source === "consignment" && <option value="returned_to_consignor">Devolvido ao dono</option>}
      </select>
      {estado.error && (
        <p role="alert" className="text-sm text-danger-ink">
          {estado.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-[var(--radius-control)] bg-danger px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          {enviando ? "Removendo…" : "Remover"}
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => setConfirmando(false)}
          className="rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:bg-sand disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
