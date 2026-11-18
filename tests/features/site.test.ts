import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { listSiteVehicles, siteStoreSlug } from "@/features/site/model";
import { contarVeiculos, getDestaques, getOutrosVeiculos, getVeiculoBySlug, getVeiculos } from "@/lib/veiculos";
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

let storeId: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  storeId = seed.a.storeId;
  await adminQuery("update stores set is_demo = true where id = $1", [storeId]);
  const owner: StoreMember = { membershipId: seed.a.ana.id, storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  await restoreDemoStore(owner, TODAY);
  vi.stubEnv("SITE_STORE_SLUG", "loja-a");
});
afterEach(() => vi.unstubAllEnvs());

it("the site shows the configured store, the Maré when nothing is set", () => {
  expect(siteStoreSlug()).toBe("loja-a");
  vi.stubEnv("SITE_STORE_SLUG", "");
  expect(siteStoreSlug()).toBe("mare-veiculos");
});

it("the site lists the store's cars for sale as the database has them, with nothing of the cost", async () => {
  const forSale = await adminQuery(
    "select slug, brand, model, version, model_year, km, price::float as price, min_cash_price::float as min from vehicles where store_id = $1 and status = 'available'",
    [storeId],
  );
  const [costs] = await adminQuery("select array_agg(distinct purchase_price::float) as values from vehicle_finances where store_id = $1 and purchase_price > 0", [storeId]);
  const cars = await getVeiculos();
  expect(cars.map((car) => car.slug).sort()).toEqual(forSale.map((row) => row.slug).sort());
  expect(await contarVeiculos()).toBe(forSale.length);
  for (const row of forSale) {
    expect(cars.find((car) => car.slug === row.slug)).toMatchObject({
      marca: row.brand, modelo: row.model, titulo: `${row.brand} ${row.model} ${row.version}`, ano: row.model_year, km: row.km, preco: row.price,
    });
  }
  const sent = JSON.stringify(cars);
  expect(sent).not.toMatch(/cost|custo|minCash|plate|placa|consign/i);
  const secret = new Set<number>([...costs.values, ...forSale.map((row) => row.min)].filter((value) => value && !forSale.some((row) => row.price === value)));
  expect(secret.size).toBeGreaterThan(0);
  for (const value of secret) expect(sent).not.toContain(String(value));
});

it("a reserved car reads as reserved, photos come from /fotos and a sold car is gone", async () => {
  const [first, second] = await adminQuery("select id, slug from vehicles where store_id = $1 and status = 'available' order by slug limit 2", [storeId]);
  await adminQuery("update reservations set canceled_at = now() where store_id = $1", [storeId]);
  await adminQuery("insert into reservations (store_id, vehicle_id, deposit, expires_on) values ($1, $2, 500, $3)", [storeId, first.id, TODAY]);
  await adminQuery("delete from vehicle_photos where vehicle_id = $1", [first.id]);
  await adminQuery("insert into vehicle_photos (store_id, vehicle_id, position, path) values ($1, $2, 0, 'lojas/x/capa.webp')", [storeId, first.id]);
  await adminQuery("update vehicles set status = 'sold' where id = $1", [second.id]);

  const cars = await listSiteVehicles(TODAY);
  expect(cars.find((car) => car.slug === first.slug)).toMatchObject({ status: "reservado", fotos: ["/fotos/lojas/x/capa.webp"] });
  expect(cars.filter((car) => car.status === "reservado")).toHaveLength(1);
  expect(cars.every((car) => car.status === "disponivel" || car.status === "reservado")).toBe(true);
  expect(await getVeiculoBySlug(second.slug)).toBeNull();
  expect(await getVeiculoBySlug(first.slug)).toMatchObject({ slug: first.slug });
  expect((await getOutrosVeiculos(first.slug, 4)).map((car) => car.slug)).not.toContain(first.slug);
});

it("the home shows full rows of featured cars, and an unknown store shows none", async () => {
  await adminQuery("update vehicles set featured = (slug in (select slug from vehicles where store_id = $1 and status = 'available' order by slug limit 6)) where store_id = $1", [storeId]);
  expect(await getDestaques()).toHaveLength(4);
  await adminQuery("update vehicles set featured = (slug in (select slug from vehicles where store_id = $1 and status = 'available' order by slug limit 3)) where store_id = $1", [storeId]);
  expect(await getDestaques()).toHaveLength(3);
  vi.stubEnv("SITE_STORE_SLUG", "nao-existe");
  expect(await getVeiculos()).toEqual([]);
  expect(await getDestaques()).toEqual([]);
});
