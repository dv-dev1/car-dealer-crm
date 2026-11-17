// Buying rules shared by server and browser: nothing here reads the database.

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
