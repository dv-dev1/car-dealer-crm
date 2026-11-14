// The stores are in Paraíba: "today" is the store's day, not the server's (UTC on the Worker).
export const STORE_TIME_ZONE = "America/Fortaleza";

const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE });

/** "YYYY-MM-DD" of `now` in the store's time zone. */
export function todayIso(now: Date = new Date()): string {
  return formatter.format(now);
}
