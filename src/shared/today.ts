// The stores are in Paraíba: "today" is the store's day, not the server's (UTC on the Worker).
export const STORE_TIME_ZONE = "America/Fortaleza";

const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE });

/** "YYYY-MM-DD" of `now` in the store's time zone. */
export function todayIso(now: Date = new Date()): string {
  return formatter.format(now);
}

/** A real calendar day as "YYYY-MM-DD": 2026-02-31 is refused. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
