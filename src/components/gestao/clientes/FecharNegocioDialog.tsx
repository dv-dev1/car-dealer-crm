"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, BadgeCheck, XCircle } from "lucide-react";
import type { Lead } from "@/data/clientes-mock";
import type { DadosFechamento } from "@/lib/clientes-store";
import type { FormaPagamento } from "@/data/vendas-mock";
import { VEU, painel } from "@/components/gestao/motion/sobreposicao";

const FORMAS: FormaPagamento[] = ["Financiamento", "Troca + diferença", "À vista"];
const MOTIVOS = ["Foi de outro modelo", "Achou caro", "Comprou em outra loja", "Sumiu / não respondeu"];

export interface Fechamento {
  lead: Lead;
  tipo: "vendeu" | "nao-comprou";
}

/**
 * Diálogo de fechamento — abre ao soltar um card numa zona de fechamento.
 * "Vendeu" pede valor + forma (alimenta Metas/Relatórios); "Não comprou" pede o
 * motivo. Tudo opcional pra não travar o gesto, mas oferecido na hora certa.
 */
export function FecharNegocioDialog({
  fechamento,
  onConfirmar,
  onCancelar,
}: {
  fechamento: Fechamento | null;
  onConfirmar: (dados: DadosFechamento) => void;
  onCancelar: () => void;
}) {
  const reduzir = useReducedMotion();
  const tituloId = useId();
  const primeiroRef = useRef<HTMLInputElement>(null);

  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("Financiamento");
  const [motivo, setMotivo] = useState("");

  const vendeu = fechamento?.tipo === "vendeu";

  useEffect(() => {
    if (!fechamento) return;
    setValor("");
    setForma("Financiamento");
    setMotivo("");
    const t = setTimeout(() => primeiroRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [fechamento]);

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

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (vendeu) {
      const num = Number(valor.replace(/\D/g, ""));
      onConfirmar({ valor: num > 0 ? num : undefined, formaPagamento: forma });
    } else {
      onConfirmar({ motivo: motivo.trim() || undefined });
    }
  }

  const campoBase =
    "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none";

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
            className="relative z-[81] w-full max-w-md overflow-hidden rounded-t-[calc(var(--radius)*1.4)] border border-line bg-surface shadow-[var(--shadow-hover)] sm:rounded-[calc(var(--radius)*1.4)]"
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

            <form onSubmit={confirmar} className="flex flex-col gap-4 px-5 py-5">
              <p className="text-sm text-muted-strong">
                {vendeu ? "Fechou com " : "Marcar "}
                <span className="font-semibold text-secondary">{fechamento.lead.nome}</span>
                {fechamento.lead.carro && (
                  <>
                    {" "}
                    — <span className="text-secondary/80">{fechamento.lead.carro}</span>
                  </>
                )}
                {vendeu ? "." : " como não comprou."}
              </p>

              {vendeu ? (
                <>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-strong">
                    Valor da venda
                    <input
                      ref={primeiroRef}
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      inputMode="numeric"
                      placeholder="R$ 0"
                      className={`${campoBase} text-base font-semibold`}
                    />
                  </label>
                  <fieldset>
                    <legend className="mb-1.5 text-xs font-medium text-muted-strong">
                      Forma de pagamento
                    </legend>
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
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              ) : (
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-strong">
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
                  className={`flex-1 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                    vendeu
                      ? "bg-success text-on-primary hover:bg-success-ink"
                      : "bg-primary text-on-primary hover:bg-primary-hover"
                  }`}
                >
                  {vendeu ? "Registrar venda" : "Confirmar"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
