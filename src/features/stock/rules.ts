// Stock rules shared by server and browser: nothing here reads the database.
import type { StockStatus, StockVehicle } from "./model";

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
  };
}

export function oldestInStock(cars: StockVehicle[], n = 3): StockVehicle[] {
  return [...cars].sort((a, b) => b.daysInStock - a.daysInStock).slice(0, n);
}
