import type { StockVehicle } from "@/features/stock/model";

let next = 0;
// A car in stock for screen and rule tests; override what the test is about.
export function car(over: Partial<StockVehicle> = {}): StockVehicle {
  next += 1;
  return {
    id: `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`,
    slug: `chevrolet-onix-lt-2023-${next}`,
    title: "Chevrolet Onix LT 1.0",
    brand: "Chevrolet",
    model: "Onix",
    version: "LT 1.0",
    modelYear: 2023,
    manufactureYear: 2022,
    km: 32000,
    color: "Prata",
    fuel: "Flex",
    transmission: "Manual",
    bodyType: "Hatch",
    doors: 4,
    engine: "1.0",
    power: "82 cv",
    description: "",
    features: [],
    featured: false,
    price: 72990,
    minCashPrice: 70990,
    status: "available",
    source: "purchase",
    enteredOn: "2026-10-01",
    daysInStock: 43,
    photos: [],
    money: { cost: 61000, profit: 9990 },
    ...over,
  };
}
