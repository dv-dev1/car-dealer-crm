import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { CAMBIOS, CATEGORIAS, COMBUSTIVEIS, CORES, OPCIONAIS } from "@/data/opcoes-veiculo";
import { COLORS, MODELS } from "@/features/demo/catalog";
import { createVehicle, getVehicle, listStock, updateVehicle, type VehicleInput } from "@/features/stock/model";
import { withStore, type StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const TODAY = "2026-11-13";

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

let seed: Awaited<ReturnType<typeof seedTwoStores>>;
let owner: StoreMember;
let seller: StoreMember;
let carla: StoreMember;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  carla = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla", storeName: "Loja B", isDemo: false };
  await restoreDemoStore(owner, TODAY);
});

it("lists the Maré's 22 cars in stock with cost and profit for the owner", async () => {
  const cars = await listStock(owner, TODAY);
  expect(cars).toHaveLength(22);
  for (const car of cars) {
    expect(car.money).not.toBeNull();
    expect(car.money!.profit).toBe((car.minCashPrice ?? car.price) - car.money!.cost);
  }
  expect(cars.filter((car) => car.status === "reserved")).toHaveLength(1);
  expect(cars.filter((car) => car.status === "away")).toHaveLength(1);
  expect(cars.filter((car) => car.daysInStock > 90)).toHaveLength(2);
  expect(cars.map((car) => car.daysInStock)).toEqual([...cars.map((car) => car.daysInStock)].sort((x, y) => y - x));
});

it("never sends cost or profit to a seller", async () => {
  expect((await listStock(seller, TODAY)).every((car) => car.money === null)).toBe(true);
  const slug = (await listStock(owner, TODAY))[0].slug;
  expect((await getVehicle(seller, slug, TODAY))!.money).toBeNull();
});

it("counts days in stock from the store day", async () => {
  for (const car of await listStock(owner, TODAY)) {
    expect(car.daysInStock).toBe(Math.round((Date.parse(TODAY) - Date.parse(car.enteredOn)) / 86_400_000));
  }
});

it("adds the car's expenses to its cost", async () => {
  const [row] = await adminQuery(
    `select v.slug, f.purchase_price::float8 + sum(e.amount)::float8 as cost
       from vehicles v join vehicle_finances f on f.vehicle_id = v.id join vehicle_expenses e on e.vehicle_id = v.id
      where v.store_id = $1 and v.source = 'purchase' and v.status in ('available', 'preparing')
      group by v.slug, f.purchase_price limit 1`,
    [seed.a.storeId],
  );
  expect((await getVehicle(owner, row.slug, TODAY))!.money!.cost).toBe(row.cost);
});

it("does not show another store's cars", async () => {
  const slug = (await listStock(owner, TODAY))[0].slug;
  expect(await listStock(carla, TODAY)).toEqual([]);
  expect(await getVehicle(carla, slug, TODAY)).toBeNull();
});

it("finds a sold car by slug but not a removed one", async () => {
  const [sold] = await adminQuery("select slug from vehicles where store_id = $1 and status = 'sold' limit 1", [seed.a.storeId]);
  expect((await getVehicle(owner, sold.slug, TODAY))!.status).toBe("sold");
  const slug = (await listStock(owner, TODAY))[0].slug;
  await adminQuery("update vehicles set status = 'removed', removed_reason = 'wrong_entry' where slug = $1", [slug]);
  expect(await getVehicle(owner, slug, TODAY)).toBeNull();
  expect(await listStock(owner, TODAY)).toHaveLength(21);
});

const INPUT: VehicleInput = {
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
  description: "Único dono.",
  features: ["Ar condicionado", "Câmera de ré"],
  featured: false,
  price: 72990,
  acquisitionCost: 61000,
  enteredOn: "2026-11-10",
  ready: true,
};

it("creates a car with its cost, visible in the stock", async () => {
  const result = await createVehicle(owner, INPUT, TODAY);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.slug).toMatch(/^chevrolet-onix-lt-1-0-2023-[0-9a-f]{6}$/);
  const car = (await listStock(owner, TODAY)).find((c) => c.id === result.id)!;
  expect(car).toMatchObject({ title: "Chevrolet Onix LT 1.0", status: "available", daysInStock: 3, minCashPrice: null, source: "purchase" });
  expect(car.money!.cost).toBe(61000);
  expect((await createVehicle(owner, { ...INPUT, ready: false }, TODAY)).ok && (await listStock(owner, TODAY)).some((c) => c.status === "preparing")).toBe(true);
});

it("refuses a seller, in the model and in the database", async () => {
  expect(await createVehicle(seller, INPUT, TODAY)).toEqual({ ok: false, error: "forbidden" });
  const insert = withStore(seller, (db) =>
    db.query(
      `insert into vehicles (store_id, slug, brand, model, version, model_year, manufacture_year, km, fuel, transmission, price, entered_on)
       values ($1, 'x', 'a', 'b', 'c', 2023, 2023, 0, 'Flex', 'Manual', 1000, $2)`,
      [seller.storeId, TODAY],
    ),
  );
  await expect(insert).rejects.toThrow(/row-level security/);
});

it.each([
  ["brand", { brand: " " }],
  ["version", { version: "x".repeat(61) }],
  ["manufactureYear", { manufactureYear: 2028, modelYear: 2028 }],
  ["modelYear", { modelYear: 2024 }],
  ["km", { km: -1 }],
  ["color", { color: "Rosa choque" }],
  ["fuel", { fuel: "Gasolina aditivada" }],
  ["transmission", { transmission: "Sequencial" }],
  ["doors", { doors: 7 }],
  ["features", { features: ["Turbo de verdade"] }],
  ["price", { price: 0 }],
  ["acquisitionCost", { acquisitionCost: -5 }],
  ["enteredOn", { enteredOn: "2026-11-14" }],
  ["enteredOn", { enteredOn: "14/11/2026" }],
] as const)("names the invalid field %s", async (field, over) => {
  expect(await createVehicle(owner, { ...INPUT, ...over } as VehicleInput, TODAY)).toEqual({ ok: false, error: "invalid", field });
});

it("updates a car and its cost, keeping the slug", async () => {
  const created = await createVehicle(owner, INPUT, TODAY);
  if (!created.ok) throw new Error("create failed");
  const updated = await updateVehicle(owner, created.id, { ...INPUT, km: 33000, price: 70990, acquisitionCost: 60000, ready: false }, TODAY);
  expect(updated).toEqual({ ok: true, id: created.id, slug: created.slug });
  const car = (await getVehicle(owner, created.slug, TODAY))!;
  expect(car).toMatchObject({ km: 33000, price: 70990, status: "preparing" });
  expect(car.money!.cost).toBe(60000);
});

it("keeps the discount when the price changes", async () => {
  const created = await createVehicle(owner, INPUT, TODAY);
  if (!created.ok) throw new Error("create failed");
  await adminQuery("update vehicles set min_cash_price = price - 2000 where id = $1", [created.id]);
  await updateVehicle(owner, created.id, { ...INPUT, price: 1500 }, TODAY);
  expect((await getVehicle(owner, created.slug, TODAY))!.minCashPrice).toBeNull();
  await adminQuery("update vehicles set min_cash_price = price - 500 where id = $1", [created.id]);
  await updateVehicle(owner, created.id, { ...INPUT, price: 80000 }, TODAY);
  expect((await getVehicle(owner, created.slug, TODAY))!.minCashPrice).toBe(79500);
});

it("refuses to edit a sold or removed car", async () => {
  const [sold] = await adminQuery("select id from vehicles where store_id = $1 and status = 'sold' limit 1", [seed.a.storeId]);
  expect(await updateVehicle(owner, sold.id, INPUT, TODAY)).toEqual({ ok: false, error: "not_editable" });
  const car = (await listStock(owner, TODAY))[0];
  await adminQuery("update vehicles set status = 'removed', removed_reason = 'wrong_entry' where id = $1", [car.id]);
  expect(await updateVehicle(owner, car.id, INPUT, TODAY)).toEqual({ ok: false, error: "not_editable" });
});

it("does not edit another store's car", async () => {
  const car = (await listStock(owner, TODAY))[0];
  expect(await updateVehicle(carla, car.id, INPUT, TODAY)).toEqual({ ok: false, error: "not_found" });
  expect(await updateVehicle(owner, "not-a-uuid", INPUT, TODAY)).toEqual({ ok: false, error: "not_found" });
  expect(await updateVehicle(seller, car.id, INPUT, TODAY)).toEqual({ ok: false, error: "forbidden" });
});

it("keeps the consignment cost in the consignor payout", async () => {
  const consigned = (await listStock(owner, TODAY)).find((c) => c.source === "consignment")!;
  const expenses = consigned.money!.cost - Number((await adminQuery("select consignor_payout from vehicle_finances where vehicle_id = $1", [consigned.id]))[0].consignor_payout);
  await updateVehicle(owner, consigned.id, { ...INPUT, acquisitionCost: 50000 }, TODAY);
  expect((await getVehicle(owner, consigned.slug, TODAY))!.money!.cost).toBe(50000 + expenses);
  expect(await updateVehicle(owner, consigned.id, { ...INPUT, acquisitionCost: 0 }, TODAY)).toEqual({ ok: false, error: "invalid", field: "acquisitionCost" });
});

it("the demo catalog uses the form's option lists, so a demo car can be edited", () => {
  const within = (list: readonly string[], values: string[]) => values.filter((value) => !list.includes(value));
  expect(within(OPCIONAIS, MODELS.flatMap((m) => m.features))).toEqual([]);
  expect(within(CORES, COLORS)).toEqual([]);
  expect(within(CATEGORIAS, MODELS.map((m) => m.bodyType))).toEqual([]);
  expect(within(COMBUSTIVEIS, MODELS.map((m) => m.fuel))).toEqual([]);
  expect(within(CAMBIOS, MODELS.map((m) => m.transmission))).toEqual([]);
});

it("tells the purchase price apart from the cost with expenses, for the edit form", async () => {
  const [row] = await adminQuery(
    `select v.slug, f.purchase_price::float8 as purchase from vehicles v join vehicle_finances f on f.vehicle_id = v.id
      where v.store_id = $1 and v.source = 'purchase' and v.status = 'available'
        and exists (select from vehicle_expenses e where e.vehicle_id = v.id) limit 1`,
    [seed.a.storeId],
  );
  const money = (await getVehicle(owner, row.slug, TODAY))!.money!;
  expect(money.acquisitionCost).toBe(row.purchase);
  expect(money.cost).toBeGreaterThan(money.acquisitionCost);
  const consigned = (await listStock(owner, TODAY)).find((c) => c.source === "consignment")!;
  const [payout] = await adminQuery("select consignor_payout::float8 as v from vehicle_finances where vehicle_id = $1", [consigned.id]);
  expect(consigned.money!.acquisitionCost).toBe(payout.v);
});
