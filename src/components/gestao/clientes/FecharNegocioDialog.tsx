"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, BadgeCheck, XCircle } from "lucide-react";
import { takeAppraisalForSale } from "@/features/buying/rules";
import { loseLeadAction } from "@/features/leads/actions";
import { PAYMENT_LABEL, type Lead, type Payment } from "@/features/leads/types";
import { recordSaleAction } from "@/features/sales/actions";
import { pendingDocsLabel } from "@/features/stock/rules";
import { CAMBIOS, COMBUSTIVEIS } from "@/data/opcoes-veiculo";
import { formatPreco, reaisEmDigitos } from "@/lib/format";
import { formData } from "@/shared/form";
import { VEU, painel } from "@/components/gestao/motion/sobreposicao";

const FORMAS: Payment[] = ["financing", "cash"];
const MOTIVOS = ["Foi de outro modelo", "Achou caro", "Comprou em outra loja", "Sumiu / não respondeu"];

export interface Fechamento {
  /** Null when the sale starts from the car page: the client is then optional. */
  lead: Lead | null;
  tipo: "vendeu" | "nao-comprou";
  /** The car is fixed when the sale starts from the car page. */
  vehicleId?: string;
}

/** `consignorPayout` only for who manages, on a consigned car. */
type Veiculo = { id: string; titulo: string; preco: number; consignorPayout?: number | null; pendingDocs?: number };

const TROCA_VAZIA = {
  tradeBrand: "", tradeModel: "", tradeVersion: "", tradeManufactureYear: "", tradeModelYear: "", tradeKm: "",
  tradeFuel: "Flex", tradeTransmission: "Manual", tradeValue: "",
};

const primeiroNome = (nome: string) => nome.split(" ")[0];

/**
 * Diálogo de fechamento — abre ao soltar um card numa zona de fechamento, ou em
 * "Marcar como vendido" na tela do carro. "Vendeu" registra a venda (carro,
 * valor, forma, banco, valor financiado e carro na troca; vendedor, % de retorno
 * do banco e repasse do consignado só para dono e gerente);
 * "Não comprou" pede o motivo. Grava no banco e mostra o erro aqui dentro.
 */
export function FecharNegocioDialog({
  fechamento,
  veiculos,
  sellers,
  memberId,
  leads = [],
  onConfirmar,
  onCancelar,
}: {
  fechamento: Fechamento | null;
  /** Cars for sale. */
  veiculos: Veiculo[];
  /** Null for a seller: the sale is theirs. */
  sellers: { id: string; name: string }[] | null;
  /** Who records the sale: the seller when the lead has none. */
  memberId: string;
  /** Open leads to pick from when the sale starts from a car. */
  leads?: Lead[];
  /** After the database saved it, with the notice to show. */
  onConfirmar: (aviso: string) => void;
  onCancelar: () => void;
}) {
  const reduzir = useReducedMotion();
  const tituloId = useId();
  const primeiroRef = useRef<HTMLInputElement>(null);

  const [carroId, setCarroId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<Payment>("financing");
  const [banco, setBanco] = useState("");
  const [financiado, setFinanciado] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [retorno, setRetorno] = useState("");
  const [temTroca, setTemTroca] = useState(false);
  const [troca, setTroca] = useState(TROCA_VAZIA);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const lead = fechamento?.lead ?? null;
  // Only owner and manager get the sellers list; the same people see the return and the consignor's payout.
  const gerencia = sellers !== null;
  const vendeu = fechamento?.tipo === "vendeu";
  const carroFixo = fechamento?.vehicleId ? veiculos.find((v) => v.id === fechamento.vehicleId) : undefined;

  // Defaults loaded during render on each opening, as in NovoClienteModal: no empty frame before the values.
  const marca = fechamento ? `${fechamento.tipo}|${lead?.id ?? ""}|${fechamento.vehicleId ?? ""}` : null;
  const [marcaCarregada, setMarcaCarregada] = useState<string | null>(null);
  if (marca && marca !== marcaCarregada) {
    setMarcaCarregada(marca);
    // Never the first car of the list: selling the wrong car is worse than one more click.
    const inicial = fechamento?.vehicleId ?? veiculos.find((v) => v.id === lead?.vehicleId)?.id ?? "";
    setCarroId(inicial);
    setValor(String(veiculos.find((v) => v.id === inicial)?.preco ?? ""));
    setClienteId("");
    setForma("financing");
    setBanco("");
    setFinanciado("");
    // Always an explicit seller: an empty choice would fall back to the lead's seller in record_sale.
    setVendedor(lead?.sellerId ?? memberId);
    setRetorno("");
    setTemTroca(false);
    setTroca(TROCA_VAZIA);
    setMotivo("");
    setErro(null);
    setEnviando(false);
  }
  if (!marca && marcaCarregada !== null) setMarcaCarregada(null);

  useEffect(() => {
    if (!fechamento) return;
    const t = setTimeout(() => primeiroRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [fechamento]);

  // A trade-in appraised in Compras arrives once: it fills the trade-in of the next sale and is forgotten.
  useEffect(() => {
    if (!vendeu) return;
    const kept = takeAppraisalForSale(gerencia);
    if (!kept) return;
    setTemTroca(true);
    setTroca({
      ...TROCA_VAZIA, tradeBrand: kept.brand, tradeModel: kept.model, tradeManufactureYear: String(kept.year),
      tradeModelYear: String(kept.year), tradeKm: String(kept.km), tradeValue: String(kept.value),
    });
  }, [marca, vendeu, gerencia]);

  useEffect(() => {
    if (!fechamento) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancelar();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [fechamento, onCancelar]);

  function escolherCarro(id: string) {
    setCarroId(id);
    const carro = veiculos.find((v) => v.id === id);
    if (carro) setValor(String(carro.preco));
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!fechamento || enviando) return;
    if (vendeu && !carroId) {
      setErro("Escolha o carro vendido.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      if (vendeu) {
        const cliente = lead ?? leads.find((l) => l.id === clienteId) ?? null;
        const resposta = await recordSaleAction(
          { error: null },
          formData({
            vehicleId: carroId,
            leadId: cliente?.id ?? "",
            sellerId: sellers ? vendedor : "",
            price: reaisEmDigitos(valor),
            payment: forma,
            bank: forma === "financing" ? banco : "",
            financedAmount: forma === "financing" ? reaisEmDigitos(financiado) : "",
            returnPct: gerencia && forma === "financing" ? retorno : "",
            ...(temTroca ? { tradeIn: "1", ...troca } : {}),
          }),
        );
        if (resposta.error) return setErro(resposta.error);
        const carro = veiculos.find((v) => v.id === carroId)?.titulo ?? "do carro";
        onConfirmar(cliente ? `Venda de ${primeiroNome(cliente.nome)} registrada.` : `Venda do ${carro} registrada.`);
      } else if (lead) {
        const resposta = await loseLeadAction({ error: null }, formData({ id: lead.id, reason: motivo.trim() }));
        if (resposta.error) return setErro(resposta.error);
        onConfirmar(`${primeiroNome(lead.nome)} marcado como não comprou.`);
      }
    } catch {
      setErro("Não foi possível salvar. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const campoBase =
    "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none";
  const rotulo = "flex flex-col gap-1.5 text-xs font-medium text-muted-strong";
  const repasse = gerencia ? veiculos.find((v) => v.id === carroId)?.consignorPayout : null;
  const pendencias = veiculos.find((v) => v.id === carroId)?.pendingDocs ?? 0;
  const campoTroca = (key: keyof typeof TROCA_VAZIA) => ({
    value: troca[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setTroca((t) => ({ ...t, [key]: e.target.value })),
  });

  return (
    <AnimatePresence>
      {fechamento && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-veu"
            {...VEU}
            onClick={onCancelar}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
            className="relative z-[81] flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[calc(var(--radius)*1.4)] border border-line bg-surface shadow-[var(--shadow-hover)] sm:rounded-[calc(var(--radius)*1.4)]"
            // Mesmo movimento do modal de cliente — ver motion/sobreposicao.ts.
            {...painel(!!reduzir)}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full ${
                    vendeu ? "bg-success-bg text-success" : "bg-sand text-secondary/60"
                  }`}
                >
                  {vendeu ? <BadgeCheck size={18} /> : <XCircle size={18} />}
                </span>
                <h2 id={tituloId} className="text-base font-semibold text-secondary">
                  {vendeu ? "Registrar venda" : "Não comprou"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onCancelar}
                aria-label="Cancelar"
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors duration-200 hover:bg-sand hover:text-secondary"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={confirmar} className="flex flex-col gap-4 overflow-y-auto px-5 py-5">
              {lead ? (
                <p className="text-sm text-muted-strong">
                  {vendeu ? "Fechou com " : "Marcar "}
                  <span className="font-semibold text-secondary">{lead.nome}</span>
                  {lead.carro && !vendeu && (
                    <>
                      {" "}
                      — <span className="text-secondary/80">{lead.carro}</span>
                    </>
                  )}
                  {vendeu ? "." : " como não comprou."}
                </p>
              ) : (
                carroFixo && (
                  <p className="text-sm text-muted-strong">
                    Venda do <span className="font-semibold text-secondary">{carroFixo.titulo}</span>.
                  </p>
                )
              )}

              {vendeu ? (
                <>
                  {!carroFixo && (
                    <label className={rotulo}>
                      Carro vendido
                      <select value={carroId} onChange={(e) => escolherCarro(e.target.value)} className={`${campoBase} cursor-pointer`}>
                        <option value="">Escolha o carro</option>
                        {veiculos.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.titulo} — {formatPreco(v.preco)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {!lead && (
                    <label className={rotulo}>
                      Cliente (opcional)
                      <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={`${campoBase} cursor-pointer`}>
                        <option value="">Sem cliente no funil</option>
                        {leads.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.nome}
                            {l.carro ? ` — ${l.carro}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className={rotulo}>
                    Valor da venda
                    <input
                      ref={primeiroRef}
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      inputMode="numeric"
                      placeholder="R$ 0"
                      className={`${campoBase} text-base font-semibold`}
                    />
                    {repasse != null && <span className="font-normal text-muted">Repasse ao dono: {formatPreco(repasse)}</span>}
                  </label>

                  {pendencias > 0 && (
                    <p className="rounded-[var(--radius-control)] border border-warning/30 bg-warning-bg px-3 py-2 text-xs font-medium text-warning-ink">
                      Este carro tem {pendingDocsLabel(pendencias)} de documentação. A venda segue; resolva antes da entrega.
                    </p>
                  )}

                  <fieldset>
                    <legend className="mb-1.5 text-xs font-medium text-muted-strong">Forma de pagamento</legend>
                    <div className="flex flex-wrap gap-2">
                      {FORMAS.map((f) => {
                        const ativo = forma === f;
                        return (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setForma(f)}
                            aria-pressed={ativo}
                            className={`rounded-[var(--radius-control)] px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
                              ativo
                                ? "bg-primary text-on-primary"
                                : "border border-line bg-surface text-secondary/80 hover:bg-sand"
                            }`}
                          >
                            {PAYMENT_LABEL[f]}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {forma === "financing" && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className={rotulo}>
                        Valor financiado
                        <input
                          value={financiado}
                          onChange={(e) => setFinanciado(e.target.value)}
                          inputMode="numeric"
                          placeholder="R$ 0"
                          className={campoBase}
                        />
                      </label>
                      <label className={rotulo}>
                        Banco (opcional)
                        <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Ex.: BV" className={campoBase} />
                      </label>
                      {gerencia && (
                        <label className={rotulo}>
                          % de retorno do banco (opcional)
                          <input
                            value={retorno}
                            onChange={(e) => setRetorno(e.target.value)}
                            inputMode="decimal"
                            placeholder="Ex.: 2,5"
                            className={campoBase}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <input type="checkbox" checked={temTroca} onChange={(e) => setTemTroca(e.target.checked)} />
                    Carro na troca
                  </label>
                  {temTroca && (
                    <div className="grid grid-cols-2 gap-3">
                      <label className={rotulo}>
                        Marca
                        <input {...campoTroca("tradeBrand")} className={campoBase} />
                      </label>
                      <label className={rotulo}>
                        Modelo
                        <input {...campoTroca("tradeModel")} className={campoBase} />
                      </label>
                      <label className={`${rotulo} col-span-2`}>
                        Versão
                        <input {...campoTroca("tradeVersion")} className={campoBase} />
                      </label>
                      <label className={rotulo}>
                        Ano de fabricação
                        <input {...campoTroca("tradeManufactureYear")} inputMode="numeric" className={campoBase} />
                      </label>
                      <label className={rotulo}>
                        Ano do modelo
                        <input {...campoTroca("tradeModelYear")} inputMode="numeric" className={campoBase} />
                      </label>
                      <label className={rotulo}>
                        Km
                        <input {...campoTroca("tradeKm")} inputMode="numeric" className={campoBase} />
                      </label>
                      <label className={rotulo}>
                        Combustível
                        <select {...campoTroca("tradeFuel")} className={`${campoBase} cursor-pointer`}>
                          {COMBUSTIVEIS.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label className={rotulo}>
                        Câmbio
                        <select {...campoTroca("tradeTransmission")} className={`${campoBase} cursor-pointer`}>
                          {CAMBIOS.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label className={rotulo}>
                        Valor dado na troca
                        <input {...campoTroca("tradeValue")} inputMode="numeric" placeholder="R$ 0" className={campoBase} />
                      </label>
                    </div>
                  )}

                  {sellers && (
                    <label className={rotulo}>
                      Vendedor
                      <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className={`${campoBase} cursor-pointer`}>
                        {sellers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              ) : (
                <label className={rotulo}>
                  Motivo (opcional)
                  <input
                    ref={primeiroRef}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Por que não fechou?"
                    className={campoBase}
                    list="motivos-perda"
                  />
                  <datalist id="motivos-perda">
                    {MOTIVOS.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </label>
              )}

              {erro && (
                <p role="alert" className="text-sm text-danger-ink">
                  {erro}
                </p>
              )}

              <div className="mt-1 flex gap-2.5">
                <button
                  type="button"
                  onClick={onCancelar}
                  className="flex-1 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-2.5 text-sm font-medium text-secondary transition-colors duration-200 hover:bg-sand"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className={`flex-1 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold transition-colors duration-200 disabled:opacity-60 ${
                    vendeu
                      ? "bg-success text-on-primary hover:bg-success-ink"
                      : "bg-primary text-on-primary hover:bg-primary-hover"
                  }`}
                >
                  {enviando ? "Salvando…" : vendeu ? "Registrar venda" : "Confirmar"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
