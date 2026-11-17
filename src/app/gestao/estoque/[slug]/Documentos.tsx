"use client";

import { useActionState } from "react";
import { setDocumentAction } from "@/features/stock/actions";
import { DOCUMENT_LABEL, DOCUMENT_STATUS_LABEL, pendingDocsLabel, type VehicleDocument } from "@/features/stock/rules";

const campo = "rounded-[var(--radius-control)] border border-line bg-surface px-2.5 py-1.5 text-sm text-secondary focus:border-primary focus:outline-none";
const TOM = { ok: "text-success-ink", pending: "text-warning-ink", not_applicable: "text-muted" } as const;

function Linha({ vehicleId, doc, canManage }: { vehicleId: string; doc: VehicleDocument; canManage: boolean }) {
  const [estado, acao, enviando] = useActionState(setDocumentAction, { error: null });
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-secondary">{DOCUMENT_LABEL[doc.item]}</span>
        <span className={`text-sm font-semibold ${doc.status ? TOM[doc.status] : "text-muted"}`}>
          {doc.status ? DOCUMENT_STATUS_LABEL[doc.status] : "Não conferido"}
        </span>
      </div>
      {!canManage && doc.note && <p className="mt-0.5 text-xs text-muted-strong">{doc.note}</p>}
      {canManage && (
        <form action={acao} className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <input type="hidden" name="item" value={doc.item} />
          <select name="status" required defaultValue={doc.status ?? ""} aria-label={`Situação: ${DOCUMENT_LABEL[doc.item]}`} className={campo}>
            <option value="" disabled>
              Escolha
            </option>
            {Object.entries(DOCUMENT_STATUS_LABEL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <input name="note" maxLength={200} defaultValue={doc.note ?? ""} placeholder="Observação (opcional)"
            aria-label={`Observação: ${DOCUMENT_LABEL[doc.item]}`} className={`${campo} min-w-0 flex-1`} />
          <button type="submit" disabled={enviando} className="text-sm font-semibold text-primary hover:text-primary-hover disabled:opacity-60">
            {enviando ? "Salvando…" : "Salvar"}
          </button>
          {estado.error && <p role="alert" className="w-full text-sm text-danger-ink">{estado.error}</p>}
        </form>
      )}
    </li>
  );
}

/** The car's documents: everybody reads where each stands; owner and manager set it. */
export function Documentos({ vehicleId, documents, canManage }: { vehicleId: string; documents: VehicleDocument[]; canManage: boolean }) {
  const pendentes = documents.filter((d) => d.status === "pending").length;
  return (
    <div className="rounded-[var(--radius)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">Documentação</p>
        {pendentes > 0 && <p className="text-sm font-semibold text-warning-ink">{pendingDocsLabel(pendentes)}</p>}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {documents.map((doc) => (
          <Linha key={doc.item} vehicleId={vehicleId} doc={doc} canManage={canManage} />
        ))}
      </ul>
    </div>
  );
}
