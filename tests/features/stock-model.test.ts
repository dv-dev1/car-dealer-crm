import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { getVehicle, listStock } from "@/features/stock/model";
import type { StoreMember } from "@/shared/db/client";
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
