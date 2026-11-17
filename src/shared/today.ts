// The stores are in Paraíba: "today" is the store's day, not the server's (UTC on the Worker).
export const STORE_TIME_ZONE = "America/Fortaleza";

const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE });

/** "YYYY-MM-DD" of `now` in the store's time zone. */
export function todayIso(now: Date = new Date()): string {
  return formatter.format(now);
}

/** A real calendar day as "YYYY-MM-DD": 2026-02-31 is refused, and so is year 0000, which Postgres rejects. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** `iso` moved by whole days, as "YYYY-MM-DD". */
export const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
