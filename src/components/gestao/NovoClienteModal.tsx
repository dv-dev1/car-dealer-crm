"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Check } from "lucide-react";
import { formatPreco } from "@/lib/format";
import { createLeadAction, updateLeadAction } from "@/features/leads/actions";
import { ETAPAS, UI_STAGE, type EstagioFunil, type Lead } from "@/features/leads/types";
import { formData } from "@/shared/form";
import { MensagemIA } from "./clientes/MensagemIA";
import { VEU, painel } from "./motion/sobreposicao";

const ETAPAS_ATIVAS = ETAPAS.filter((e) => !e.fechada);

// Carro do lead que não está no estoque à venda — texto livre de um cadastro
// antigo, ou veículo já vendido. Vira uma opção própria no select pra edição
// preservar o que está lá em vez de trocar em silêncio pelo primeiro da lista.
const MANTER_CARRO = "__manter__";

export interface NovoClienteModalProps {
  aberto: boolean;
  onFechar: () => void;
  /** Carros à venda. */
  veiculos: { id: string; titulo: string; preco: number }[];
  veiculoInicialId?: string;
  /** Origens do lead (canais da loja). */
  channels: { id: string; name: string }[];
  /** Equipe, só para dono e gerente; null para o vendedor (o cliente é dele). */
  sellers: { id: string; name: string }[] | null;
  /** Preenchido = modo edição: mesmo formulário, campos carregados do lead. */
  leadEmEdicao?: Lead | null;
  /** Depois que a edição gravou no banco, com o aviso a mostrar. */
  onSalvo?: (aviso: string) => void;
}

/**
 * Modal "Novo cliente / negociação". Register product — modal usado com
 * parcimônia (é a exceção certa: capturar um lead no meio do atendimento sem
 * sair do carro). Grava no banco da loja e mostra o erro aqui dentro.
 */
export function NovoClienteModal({
  aberto,
  onFechar,
  veiculos,
  veiculoInicialId,
  channels,
  sellers,
  leadEmEdicao,
  onSalvo,
}: NovoClienteModalProps) {
  const reduzir = useReducedMotion();
  const nomeRef = useRef<HTMLInputElement>(null);
  const tituloId = useId();
  const editando = !!leadEmEdicao;

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [etapaFunil, setEtapaFunil] = useState<EstagioFunil>("lead-novo");
  const [veiculoId, setVeiculoId] = useState(veiculoInicialId ?? "");
  const [origem, setOrigem] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [obs, setObs] = useState("");
  const [conversaEm, setConversaEm] = useState("");
  const [visitaEm, setVisitaEm] = useState("");
  const [horaVisita, setHoraVisita] = useState("");
  const [veioEm, setVeioEm] = useState("");
  const [retornarEm, setRetornarEm] = useState("");
  const [erro, setErro] = useState<{ texto: string; campo?: string } | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

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
    setEtapaFunil(l?.estagio ?? "lead-novo");
    // Edição: o carro do lead se estiver à venda; senão a opção "manter" —
    // nunca o primeiro da lista, que trocaria o carro do cliente sem ninguém
    // pedir. Cadastro novo: sem carro, salvo vindo da tela de um carro.
    const doEstoque = l?.vehicleId && veiculos.some((v) => v.id === l.vehicleId) ? l.vehicleId : undefined;
    setVeiculoId(doEstoque ?? (l?.carro ? MANTER_CARRO : undefined) ?? veiculoInicialId ?? "");
    setOrigem(l?.channelId ?? "");
    setVendedor(l?.sellerId ?? "");
    setObs(l?.nota ?? "");
    setConversaEm(l?.conversaEm ?? "");
    setVisitaEm(l?.visitaEm ?? "");
    setHoraVisita(l?.horaVisita ?? "");
    setVeioEm(l?.veioEm ?? "");
    setRetornarEm(l?.retornarEm ?? "");
    setErro(null);
    setEnviado(false);
    setEnviando(false);
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

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!nome.trim()) {
      setErro({ texto: "Informe o nome do cliente pra registrar a negociação.", campo: "name" });
      nomeRef.current?.focus();
      return;
    }
    setErro(null);

    const manter = veiculoId === MANTER_CARRO;
    // Marcou visita num lead novo → é uma "Visita marcada" de fato.
    const etapa = !editando && etapaFunil === "lead-novo" && visitaEm ? "visita-marcada" : etapaFunil;
    const campos: Record<string, string> = {
      name: nome,
      phone: telefone,
      stage: UI_STAGE[etapa],
      vehicleId: manter ? (leadEmEdicao?.vehicleId ?? "") : veiculoId,
      interest: manter && !leadEmEdicao?.vehicleId ? (leadEmEdicao?.carro ?? "") : "",
      channelId: origem,
      sellerId: sellers ? vendedor : "",
      note: obs,
      lastContactOn: conversaEm,
      visitOn: visitaEm,
      visitTime: horaVisita,
      cameOn: veioEm,
      callBackOn: retornarEm,
    };
    if (leadEmEdicao) campos.id = leadEmEdicao.id;

    setEnviando(true);
    try {
      const resposta = await (editando ? updateLeadAction : createLeadAction)({ error: null }, formData(campos));
      if (resposta.error) {
        setErro({ texto: resposta.error, campo: resposta.field });
        return;
      }
      if (editando) {
        onSalvo?.(`${nome.trim().split(" ")[0]} atualizado.`);
        onFechar();
      } else {
        setEnviado(true);
      }
    } catch {
      setErro({ texto: "Não foi possível salvar. Confira a internet e tente de novo." });
    } finally {
      setEnviando(false);
    }
  }

  const campoBase =
    "w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none";

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
                <button
                  type="button"
                  onClick={onFechar}
                  className="mt-5 rounded-[var(--radius-control)] bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
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
                    aria-invalid={erro?.campo === "name"}
                    className={`${campoBase} font-medium ${erro?.campo === "name" ? "border-danger" : ""}`}
                  />
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
                      Etapa do funil
                    </label>
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
                    <option value="">Sem carro definido</option>
                    {veiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.titulo} — {formatPreco(v.preco)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`grid grid-cols-1 gap-3 ${sellers ? "sm:grid-cols-2" : ""}`}>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Origem
                    <select value={origem} onChange={(e) => setOrigem(e.target.value)} className={`${campoBase} cursor-pointer`}>
                      <option value="">Não informada</option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {sellers && (
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Vendedor
                      <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className={`${campoBase} cursor-pointer`}>
                        <option value="">{editando ? "Sem vendedor" : "Eu (quem cadastra)"}</option>
                        {sellers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
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
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Retornar em
                      <input
                        type="date"
                        value={retornarEm}
                        onChange={(e) => setRetornarEm(e.target.value)}
                        className={campoBase}
                      />
                    </label>
                  </div>
                </fieldset>

                {erro && (
                  <p role="alert" className="text-sm text-danger-ink">
                    {erro.texto}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="mt-1 w-full disabled:opacity-60 rounded-[var(--radius-control)] bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover"
                >
                  {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar cliente"}
                </button>
                {leadEmEdicao && <MensagemIA key={leadEmEdicao.id} lead={leadEmEdicao} />}
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
