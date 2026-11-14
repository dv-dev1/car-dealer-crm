import { expect, it } from "vitest";
import { oldestInStock, staleLevel, stockSummary } from "@/features/stock/rules";
import { car } from "./stock-car.ts";

it("grades days in stock at 60 and 90", () => {
  expect([0, 59, 60, 90, 91].map(staleLevel)).toEqual(["ok", "ok", "attention", "attention", "stale"]);
});

it("sums the stock and leaves money out when the viewer has none", () => {
  const owner = stockSummary([
    car({ price: 100, minCashPrice: 90, money: { acquisitionCost: 70, cost: 70, profit: 20 } }),
    car({ price: 50, minCashPrice: null, daysInStock: 95, money: { acquisitionCost: 40, cost: 40, profit: 10 } }),
  ]);
  expect(owner).toEqual({ total: 2, noMargin: 1, stale: 1, worth: 150, invested: 110, expectedProfit: 30 });
  expect(stockSummary([car({ money: null })]).invested).toBeNull();
  expect(stockSummary([car({ money: null })]).expectedProfit).toBeNull();
  expect(stockSummary([])).toEqual({ total: 0, noMargin: 0, stale: 0, worth: 0, invested: 0, expectedProfit: 0 });
});

it("puts the longest in stock first", () => {
  const cars = [car({ daysInStock: 3 }), car({ daysInStock: 120 }), car({ daysInStock: 61 }), car({ daysInStock: 10 })];
  expect(oldestInStock(cars).map((c) => c.daysInStock)).toEqual([120, 61, 10]);
});
