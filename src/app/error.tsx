"use client";

// Any page that breaks (the database is down, a bug) lands here. Nothing of the error goes to the screen:
// its message can carry a query, an address or a client's data. The Worker's log has it.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-secondary">Algo deu errado. Tente de novo em instantes.</h1>
      <button
        type="button"
        onClick={reset}
        className="rounded-[var(--radius)] bg-secondary px-6 py-3 text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary"
      >
        Tentar de novo
      </button>
    </main>
  );
}
