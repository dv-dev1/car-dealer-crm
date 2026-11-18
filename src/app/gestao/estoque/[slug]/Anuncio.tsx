"use client";

import { useEffect, useState, useTransition } from "react";
import { Megaphone } from "lucide-react";

import { generateAdAction } from "@/features/ai/actions";
import { AD_LABEL, AD_FIELDS, type AdTexts } from "@/features/ai/rules";

const MAX_SHARED_PHOTOS = 4;
const acao =
  "rounded-[var(--radius-control)] border border-line px-3 py-1.5 text-sm font-semibold text-secondary hover:border-primary disabled:opacity-60";

/** The car's ad written by the AI from its sheet: one text per place, each with copy and share. Every role. */
export function Anuncio({ slug, photos }: { slug: string; photos: string[] }) {
  const [ad, setAd] = useState<AdTexts | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<keyof AdTexts | null>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [gerando, iniciar] = useTransition();

  // The photos are fetched as soon as there is an ad: sharing has to start inside the tap, with no wait before it.
  useEffect(() => {
    if (!ad) return;
    let vivo = true;
    Promise.all(
      photos.slice(0, MAX_SHARED_PHOTOS).map(async (url, i) => {
        const blob = await (await fetch(url)).blob();
        return new File([blob], `foto-${i + 1}.${blob.type.split("/")[1] ?? "jpg"}`, { type: blob.type });
      }),
    )
      .then((files) => vivo && setArquivos(files))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [ad, photos]);

  function gerar() {
    setErro(null);
    iniciar(async () => {
      try {
        const result = await generateAdAction(slug);
        if ("error" in result) setErro(result.error);
        else setAd(result.ad);
      } catch {
        setErro("Não deu para gerar o anúncio. Confira a internet e tente de novo.");
      }
    });
  }

  async function copiar(campo: keyof AdTexts) {
    try {
      await navigator.clipboard.writeText(ad![campo]);
      setCopiado(campo);
    } catch {
      setErro("Não deu para copiar. Selecione o texto e copie à mão.");
    }
  }

  // With the photos when the phone accepts files, text only otherwise; without the share sheet, WhatsApp with the text.
  async function compartilhar(campo: keyof AdTexts) {
    const text = ad![campo];
    try {
      if (arquivos.length && navigator.canShare?.({ files: arquivos })) return await navigator.share({ text, files: arquivos });
      if (navigator.share) return await navigator.share({ text });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <h2 className="flex items-center gap-2 text-base font-semibold text-secondary">
        <Megaphone size={18} strokeWidth={1.8} className="shrink-0" />
        Anúncio pronto
      </h2>
      <p className="mt-1 text-sm text-muted-strong">A IA escreve com a ficha do carro. Confira e ajuste antes de publicar.</p>
      <button type="button" onClick={gerar} disabled={gerando} className={`${acao} mt-3`}>
        {gerando ? "Escrevendo…" : ad ? "Gerar de novo" : "Gerar anúncio"}
      </button>
      {erro && <p role="alert" className="mt-2 text-sm text-danger-ink">{erro}</p>}
      {ad && (
        <div className="mt-4 space-y-4">
          {AD_FIELDS.map((campo) => (
            <div key={campo}>
              <label htmlFor={`anuncio-${campo}`} className="text-sm font-medium text-secondary">{AD_LABEL[campo]}</label>
              <textarea
                id={`anuncio-${campo}`}
                value={ad[campo]}
                onChange={(e) => {
                  setAd({ ...ad, [campo]: e.target.value });
                  setCopiado(null);
                }}
                rows={campo === "olxTitle" ? 1 : campo === "olxDescription" ? 8 : 4}
                className="mt-1.5 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm text-secondary focus:border-primary focus:outline-none"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => copiar(campo)} className={acao}>
                  {copiado === campo ? "Copiado" : "Copiar"}
                </button>
                <button type="button" onClick={() => compartilhar(campo)} className={acao}>
                  Compartilhar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
