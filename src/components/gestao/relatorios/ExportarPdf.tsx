"use client";

import { FileDown } from "lucide-react";

/** Prints the report; the browser's dialog saves it as PDF. */
export function ExportarPdf() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-2 text-sm font-medium text-secondary transition-[background-color,scale] duration-[var(--dur-rapida)] ease-[var(--ease-brand)] hover:bg-sand active:scale-[0.97]"
    >
      <FileDown size={16} strokeWidth={1.9} />
      Exportar PDF
    </button>
  );
}
