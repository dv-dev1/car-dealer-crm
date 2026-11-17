// Buying rules shared by server and browser: nothing here reads the database.

import { MODELS } from "@/features/demo/catalog";

/** Upper bound of each band, in reais; the last one has none. */
export const PRICE_BANDS = [
  { key: "to-50", label: "Até R$ 50 mil", upTo: 50_000 },
  { key: "50-80", label: "R$ 50 a 80 mil", upTo: 80_000 },
  { key: "80-120", label: "R$ 80 a 120 mil", upTo: 120_000 },
  { key: "over-120", label: "Acima de R$ 120 mil", upTo: Infinity },
] as const;

export type BuyingRow = {
  key: string;
  label: string;
  sold: number;
  avgDays: number;
  avgProfit: number;
  /** The group's profit over its days in the yard. */
  profitPerDay: number;
  verdict: "buy" | "avoid" | null;
};

/** Two sales is the least to say anything. A group that loses money, or earns much less a day than the store, is to avoid. */
export function buyingVerdict(row: Pick<BuyingRow, "sold" | "avgProfit" | "profitPerDay">, storeProfitPerDay: number): BuyingRow["verdict"] {
  if (row.sold < 2) return null;
  if (row.avgProfit <= 0 || row.profitPerDay <= storeProfitPerDay * 0.6) return "avoid";
  return row.profitPerDay >= storeProfitPerDay * 1.25 ? "buy" : null;
}

// Trade-in appraisal. `MODELS` is the demo's example table, standing in for FIPE.

export type Condition = "excellent" | "good" | "fair" | "poor";

/** What each state takes off the reference price, and what it costs to get the car ready, in reais. */
export const CONDITION: Record<Condition, { label: string; factor: number; prep: number }> = {
  excellent: { label: "Ótimo", factor: 1, prep: 500 },
  good: { label: "Bom", factor: 0.97, prep: 1500 },
  fair: { label: "Regular", factor: 0.92, prep: 3000 },
  poor: { label: "Ruim", factor: 0.85, prep: 6000 },
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The example table's price for the model in that year, between its oldest and newest year. Null outside the table. */
export function referencePrice(brand: string, model: string, year: number): number | null {
  const found = MODELS.find((m) => same(m.brand, brand) && same(m.model, model));
  if (!found || year < found.years[0] || year > found.years[1]) return null;
  const [firstYear, lastYear] = found.years;
  const [oldest, newest] = found.prices;
  return firstYear === lastYear ? newest : Math.round(oldest + ((newest - oldest) * (year - firstYear)) / (lastYear - firstYear));
}

export type Appraisal = { offer: number; salePrice: number; profit: number; days: number; prep: number; moneyCost: number };

const KM_PER_YEAR = 12_000;
const hundred = (n: number, round: (n: number) => number = Math.round) => round(n / 100) * 100;

/**
 * The most to pay for a car so that, sold at the expected price, the target margin is left after getting it ready
 * and after the money stood still for `days`. Each 10.000 km over 12.000 a year takes 1% of the price, up to 10%.
 * Null when nothing is left to offer.
 */
export function appraise(
  input: { reference: number; year: number; km: number; condition: Condition; days: number; marginPct: number; monthlyRate: number },
  thisYear: number,
): Appraisal | null {
  const { factor, prep } = CONDITION[input.condition];
  const kmOver = Math.max(0, input.km - KM_PER_YEAR * Math.max(1, thisYear - input.year));
  const salePrice = hundred(input.reference * factor * (1 - Math.min(0.1, (kmOver / 10_000) * 0.01)));
  const carry = (input.monthlyRate * input.days) / 30;
  const offer = hundred((salePrice * (1 - input.marginPct / 100) - prep) / (1 + carry), Math.floor);
  if (offer <= 0) return null;
  const moneyCost = offer * carry;
  return { offer, salePrice, profit: salePrice - offer - prep - moneyCost, days: input.days, prep, moneyCost };
}

export type AppraisalInput = { brand: string; model: string; year: number; km: number; reference: number; marginPct: number };
export type AppraisalState = {
  error: string | null;
  /** What was typed, so the form keeps it after the answer or the error. */
  typed?: Record<string, string>;
  input?: AppraisalInput;
  result?: Appraisal | null;
  /** How many sales of this model the days came from; 0 means the store's average, or the fixed 45. */
  modelSales?: number;
};

// "Usar na venda": the appraised car waits in the browser session until the sale dialog opens.

export const TRADE_IN_KEY = "tradeInAppraisal";
export type AppraisalForSale = { brand: string; model: string; year: number; km: number; value: number };
type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** False when the browser refuses the storage (private window). */
export function keepAppraisalForSale(appraisal: AppraisalForSale, storage?: SessionStore): boolean {
  try {
    (storage ?? window.sessionStorage).setItem(TRADE_IN_KEY, JSON.stringify(appraisal));
    return true;
  } catch {
    return false;
  }
}

/** The kept appraisal, once: reading it forgets it. Null when there is none or it does not read. */
export function takeAppraisalForSale(storage?: SessionStore): AppraisalForSale | null {
  try {
    const store = storage ?? window.sessionStorage;
    const raw = store.getItem(TRADE_IN_KEY);
    if (raw === null) return null;
    store.removeItem(TRADE_IN_KEY);
    const a = JSON.parse(raw) as Partial<AppraisalForSale>;
    const ok =
      typeof a.brand === "string" && typeof a.model === "string" &&
      [a.year, a.km, a.value].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0);
    return ok ? { brand: a.brand!, model: a.model!, year: a.year!, km: a.km!, value: a.value! } : null;
  } catch {
    return null;
  }
}
