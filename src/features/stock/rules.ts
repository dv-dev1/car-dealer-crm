// Stock rules shared by server and browser: nothing here reads the database.
import type { AwayReason, StockStatus, StockVehicle } from "./model";

export const STALE_ATTENTION_DAYS = 60;
export const STALE_DAYS = 90;

export function staleLevel(days: number): "ok" | "attention" | "stale" {
  if (days > STALE_DAYS) return "stale";
  if (days >= STALE_ATTENTION_DAYS) return "attention";
  return "ok";
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  preparing: "Em preparação",
  available: "Disponível",
  reserved: "Reservado",
  away: "Fora da loja",
  sold: "Vendido",
};

export const AWAY_LABEL: Record<AwayReason, string> = { service: "Revisão", repair: "Oficina", body_shop: "Funilaria", other: "Outro" };

/** The status as shown on a car: an away car says why. */
export function statusLabel(car: Pick<StockVehicle, "status" | "away">): string {
  return car.away ? `${STATUS_LABEL.away} · ${AWAY_LABEL[car.away.reason]}` : STATUS_LABEL[car.status];
}

export type StockSummary = {
  total: number;
  noMargin: number;
  stale: number;
  /** Asking prices added up: what the yard is worth at sale. */
  worth: number;
  /** Cost added up; null when the viewer does not see cost. */
  invested: number | null;
  /** Profit at the minimum cash price added up; null when the viewer does not see cost. */
  expectedProfit: number | null;
  /** What the cars in the yard cost a day in money tied up; null when the viewer does not see cost. */
  yardCostPerDay: number | null;
};

export function stockSummary(cars: StockVehicle[]): StockSummary {
  const hidden = cars.some((car) => car.money === null);
  const sum = (pick: (car: StockVehicle) => number) => cars.reduce((total, car) => total + pick(car), 0);
  return {
    total: cars.length,
    noMargin: cars.filter((car) => car.minCashPrice === null).length,
    stale: cars.filter((car) => staleLevel(car.daysInStock) === "stale").length,
    worth: sum((car) => car.price),
    invested: hidden ? null : sum((car) => car.money!.cost),
    expectedProfit: hidden ? null : sum((car) => car.money!.profit),
    yardCostPerDay: hidden ? null : sum((car) => car.money!.perDay),
  };
}

const cents = (value: number) => Math.round(value * 100) / 100;

/** What the money in a parked car stops earning: a month of the store's rate spread over 30 days. */
export function moneyCost(cost: number, monthlyRate: number, days: number): { perDay: number; sinceEntry: number } {
  const perDay = (cost * monthlyRate) / 30;
  return { perDay: cents(perDay), sinceEntry: cents(perDay * days) };
}

export function oldestInStock(cars: StockVehicle[], n = 3): StockVehicle[] {
  return [...cars].sort((a, b) => b.daysInStock - a.daysInStock).slice(0, n);
}

export const EXPENSE_LABEL = {
  mechanical: "Mecânica",
  body_paint: "Funilaria e pintura",
  detailing: "Estética",
  tires: "Pneus",
  documents: "Documentação",
  transport: "Transporte",
  sourcing_commission: "Comissão de captação",
  other: "Outra",
} as const;
export type ExpenseCategory = keyof typeof EXPENSE_LABEL;
export type Expense = { id: string; category: ExpenseCategory; spentOn: string; amount: number; description: string };

export const DOCUMENT_ITEMS = ["ipva", "fines", "inspection_report", "lien", "transfer_document", "spare_key", "manual"] as const;
export type DocumentItem = (typeof DOCUMENT_ITEMS)[number];
export type DocumentStatus = "ok" | "pending" | "not_applicable";
/** `status` null: nobody checked this item yet. */
export type VehicleDocument = { item: DocumentItem; status: DocumentStatus | null; note: string | null };

export const DOCUMENT_LABEL: Record<DocumentItem, string> = {
  ipva: "IPVA do ano",
  fines: "Multas",
  inspection_report: "Laudo cautelar",
  lien: "Quitação ou gravame",
  transfer_document: "Documento de transferência",
  spare_key: "Chave reserva",
  manual: "Manual",
};
export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = { ok: "Em dia", pending: "Pendente", not_applicable: "Não se aplica" };

export const pendingDocsLabel = (n: number) => `${n} ${n === 1 ? "pendência" : "pendências"}`;
