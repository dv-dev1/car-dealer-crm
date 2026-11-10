"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Check } from "lucide-react";
import { formatPreco } from "@/lib/format";
import type { VeiculoGestao } from "@/data/gestao-mock";
import { ETAPAS, type EstagioFunil, type Lead } from "@/data/clientes-mock";
import {
  ESTAGIOS_FORM as ESTAGIOS,
  type EstagioForm,
  type NovoClienteDados,
} from "@/lib/clientes-store";
import { VEU, painel } from "./motion/sobreposicao";

// Na edição o select mostra as etapas REAIS do funil. Os rótulos do cadastro
// ("Lead novo / Em contato / Negociação / Fechamento") colapsam em só dois
// estágios pelo mapaEstagio() — usá-los aqui trocaria a etapa do lead sem que
// ninguém tivesse pedido.
const ETAPAS_ATIVAS = ETAPAS.filter((e) => !e.fechada);

// Carro do lead que não existe (mais) no estoque — texto livre de um cadastro
// antigo, ou veículo já vendido. Vira uma opção própria no select pra edição
// preservar o que está lá em vez de trocar em silêncio pelo primeiro da lista.
const MANTER_CARRO = "__manter__";

export type { NovoClienteDados };

export interface NovoClienteModalProps {
  aberto: boolean;
  onFechar: () => void;
  veiculos: Pick<VeiculoGestao, "id" | "titulo" | "preco">[];
  veiculoInicialId?: string;
  /** Chamado quando o cliente é salvo — a página decide o que fazer (ex:
   *  jogar o lead na coluna "Lead novo" do funil). */
  onSalvar?: (dados: NovoClienteDados) => void;
  /** Preenchido = modo edição: mesmo formulário, campos carregados do lead. */
  leadEmEdicao?: Lead | null;
  /** Só no modo edição — recebe os campos alterados. */
  onAtualizar?: (dados: Partial<Lead>) => void;
}

/**
 * Modal "Novo cliente / negociação". Register product — modal usado com
 * parcimônia (é a exceção certa: capturar um lead no meio do atendimento sem
 * sair do carro). Sem backend ainda: valida e confirma de forma honesta
 * ("registrado" em memória), não finge que salvou no banco.
 */
export function NovoClienteModal({
  aberto,
  onFechar,
  veiculos,
  veiculoInicialId,
  onSalvar,
  leadEmEdicao,
  onAtualizar,
}: NovoClienteModalProps) {
  const reduzir = useReducedMotion();
  const nomeRef = useRef<HTMLInputElement>(null);
  const tituloId = useId();
  const editando = !!leadEmEdicao;

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [estagio, setEstagio] = useState<EstagioForm>("Lead novo");
  const [etapaFunil, setEtapaFunil] = useState<EstagioFunil>("lead-novo");
  const [veiculoId, setVeiculoId] = useState(veiculoInicialId ?? veiculos[0]?.id ?? "");
  const [obs, setObs] = useState("");
  const [conversaEm, setConversaEm] = useState("");
  const [visitaEm, setVisitaEm] = useState("");
  const [horaVisita, setHoraVisita] = useState("");
  const [veioEm, setVeioEm] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  // ─── Carga do formulário ao (re)abrir ──────────────────────────
  //
  // Feito DURANTE o render, não em `useEffect`. Efeito roda depois da primeira
  // pintura, e o resultado era visível: o modal abria com os campos VAZIOS,
  // preenchia na frente da pessoa no meio do fade e SALTAVA ~17px pra cima,
  // porque o conteúdo preenchido é mais alto que o vazio e o modal é
  // centralizado. Lia como "abre, fecha, abre".
  //
  // Ajustar estado durante o render é o padrão do React pra derivar estado de
  // prop ("Adjusting state when a prop changes"): o React descarta o render em
  // curso e refaz na hora, ANTES de pintar. Nenhum quadro vazio chega à tela.
  const marca = `${aberto}|${leadEmEdicao?.id ?? "novo"}`;
  const [marcaCarregada, setMarcaCarregada] = useState<string | null>(null);

  if (aberto && marca !== marcaCarregada) {
    const l = leadEmEdicao;
    setMarcaCarregada(marca);
    setNome(l?.nome ?? "");
    setTelefone(l?.telefoneLabel && l.telefoneLabel !== "—" ? l.telefoneLabel : "");
    setEstagio("Lead novo");
    setEtapaFunil(l?.estagio ?? "lead-novo");
    // Edição: casa o carro do lead com o do estoque pelo título. Não casou (e o
    // lead tem carro), seleciona a opção "manter" — nunca o primeiro da lista,
    // que trocaria o carro do cliente sem ninguém pedir.
    const doEstoque = l?.carro ? veiculos.find((v) => v.titulo === l.carro)?.id : undefined;
    setVeiculoId(
      doEstoque ??
        (l?.carro ? MANTER_CARRO : undefined) ??
        veiculoInicialId ??
        veiculos[0]?.id ??
        "",
    );
    setObs(l?.nota ?? "");
    setConversaEm(l?.conversaEm ?? "");
    setVisitaEm(l?.visitaEm ?? "");
    setHoraVisita(l?.horaVisita ?? "");
    setVeioEm(l?.veioEm ?? "");
    setErro(null);
    setEnviado(false);
  }

  // Fechou: libera pra próxima abertura recarregar do zero.
  if (!aberto && marcaCarregada !== null) setMarcaCarregada(null);

  // O foco continua em efeito — é ação sobre o DOM, não estado, e só faz
  // sentido depois que o campo existe na tela.
  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(() => nomeRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [aberto]);

  // ESC fecha; trava o scroll do fundo enquanto aberto.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [aberto, onFechar]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setErro("Informe o nome do cliente pra registrar a negociação.");
      nomeRef.current?.focus();
      return;
    }
    setErro(null);

    if (editando) {
      const digitos = telefone.replace(/\D/g, "");
      onAtualizar?.({
        nome: nome.trim(),
        telefone: digitos ? (digitos.startsWith("55") ? digitos : `55${digitos}`) : "",
        telefoneLabel: telefone.trim() || "—",
        carro:
          veiculoId === MANTER_CARRO
            ? leadEmEdicao?.carro
            : veiculos.find((v) => v.id === veiculoId)?.titulo,
        nota: obs.trim() || undefined,
        estagio: etapaFunil,
        conversaEm: conversaEm || undefined,
        visitaEm: visitaEm || undefined,
        horaVisita: horaVisita || undefined,
        veioEm: veioEm || undefined,
      });
      onFechar();
      return;
    }

    onSalvar?.({
      nome: nome.trim(),
      telefone: telefone.trim(),
      estagio,
      veiculoId,
      observacoes: obs.trim(),
      conversaEm: conversaEm || undefined,
      visitaEm: visitaEm || undefined,
      horaVisita: horaVisita || undefined,
      veioEm: veioEm || undefined,
    });
    setEnviado(true);
  }

  const campoBase =
    "w-full rounded-[calc(var(--radius)-2px)] border border-line bg-surface px-3 py-2.5 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none";

  return (
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <motion.div
            // Sem backdrop-blur: animar a opacidade de um elemento com
            // backdrop-filter faz o navegador recompor a camada de desfoque a
            // cada quadro, e no Firefox isso pisca. 2px de desfoque não paga o
            // preço; o véu escuro sozinho já separa o modal do fundo.
            className="absolute inset-0 bg-veu"
            {...VEU}
            onClick={onFechar}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
            className="relative z-[81] flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[calc(var(--radius)*1.4)] border border-line bg-surface shadow-[var(--shadow-hover)] sm:rounded-[calc(var(--radius)*1.4)]"
            // Tempos e curvas de véu e painel vivem juntos em motion/sobreposicao.ts
            // — é lá que está escrito por que o painel só faz fade na SAÍDA.
            {...painel(!!reduzir)}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id={tituloId} className="text-base font-semibold text-secondary">
                {enviado ? "Cliente registrado" : editando ? "Editar cliente" : "Novo cliente"}
              </h2>
              <button
                type="button"
                onClick={onFechar}
                aria-label="Fechar"
                className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors duration-200 hover:bg-sand hover:text-secondary"
              >
                <X size={18} />
              </button>
            </div>

            {enviado ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-success-bg text-success">
                  <Check size={28} strokeWidth={2.2} />
                </span>
                <p className="mt-4 text-sm text-secondary">
                  <span className="font-semibold">{nome.trim()}</span> foi
                  registrado e já aparece no funil de{" "}
                  <span className="font-medium">Clientes</span>.
                </p>
                <p className="mt-1.5 max-w-xs text-xs text-muted">
                  Fica salvo neste navegador. Quando o Supabase entrar, passa a
                  sincronizar entre todos os dispositivos.
                </p>
                <button
                  type="button"
                  onClick={onFechar}
                  className="mt-5 rounded-[var(--radius)] bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-hover"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <form onSubmit={enviar} className="flex flex-col gap-3 overflow-y-auto px-5 py-5">
                <div>
                  <label className="sr-only" htmlFor="nc-nome">
                    Nome do cliente
                  </label>
                  <input
                    id="nc-nome"
                    ref={nomeRef}
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value);
                      if (erro) setErro(null);
                    }}
                    placeholder="Nome do cliente"
                    aria-invalid={!!erro}
                    className={`${campoBase} font-medium ${erro ? "border-danger" : ""}`}
                  />
                  {erro && <p className="mt-1.5 text-xs text-danger-ink">{erro}</p>}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="sr-only" htmlFor="nc-tel">
                      Telefone
                    </label>
                    <input
                      id="nc-tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      inputMode="tel"
                      placeholder="(83) 99999-0000"
                      className={campoBase}
                    />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="nc-estagio">
                      {editando ? "Etapa do funil" : "Estágio"}
                    </label>
                    {editando ? (
                      <select
                        id="nc-estagio"
                        value={etapaFunil}
                        onChange={(e) => setEtapaFunil(e.target.value as EstagioFunil)}
                        className={`${campoBase} cursor-pointer`}
                      >
                        {ETAPAS_ATIVAS.map((et) => (
                          <option key={et.id} value={et.id}>
                            {et.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        id="nc-estagio"
                        value={estagio}
                        onChange={(e) =>
                          setEstagio(e.target.value as (typeof ESTAGIOS)[number])
                        }
                        className={`${campoBase} cursor-pointer`}
                      >
                        {ESTAGIOS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="sr-only" htmlFor="nc-veiculo">
                    Veículo de interesse
                  </label>
                  <select
                    id="nc-veiculo"
                    value={veiculoId}
                    onChange={(e) => setVeiculoId(e.target.value)}
                    className={`${campoBase} cursor-pointer`}
                  >
                    {veiculoId === MANTER_CARRO && leadEmEdicao?.carro && (
                      <option value={MANTER_CARRO}>
                        {leadEmEdicao.carro} (fora do estoque atual)
                      </option>
                    )}
                    {veiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.titulo} — {formatPreco(v.preco)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="sr-only" htmlFor="nc-obs">
                    Observações da negociação
                  </label>
                  <textarea
                    id="nc-obs"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    rows={3}
                    placeholder="Observações da negociação…"
                    className={`${campoBase} resize-none`}
                  />
                </div>

                {/* Datas opcionais */}
                <fieldset className="rounded-[calc(var(--radius)-2px)] border border-line px-3.5 pb-3.5 pt-2.5">
                  <legend className="px-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                    Datas (opcional)
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Conversamos em
                      <input
                        type="date"
                        value={conversaEm}
                        onChange={(e) => setConversaEm(e.target.value)}
                        className={campoBase}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Visita agendada para
                      <input
                        type="date"
                        value={visitaEm}
                        onChange={(e) => setVisitaEm(e.target.value)}
                        className={campoBase}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Horário da visita
                      <input
                        type="time"
                        value={horaVisita}
                        onChange={(e) => setHoraVisita(e.target.value)}
                        className={campoBase}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Veio à loja em
                      <input
                        type="date"
                        value={veioEm}
                        onChange={(e) => setVeioEm(e.target.value)}
                        className={campoBase}
                      />
                    </label>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  className="mt-1 w-full rounded-[var(--radius)] bg-primary px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(181,110,53,0.25)] transition-colors duration-200 hover:bg-primary-hover"
                >
                  {editando ? "Salvar alterações" : "Salvar cliente"}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
