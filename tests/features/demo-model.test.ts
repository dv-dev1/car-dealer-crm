import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { DEMO_TABLES, buildDemoData } from "@/features/demo/seed";
import type { StoreMember } from "@/shared/db/client";
import { seedDomainRows, seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const TODAY = "2026-11-13";
const any = "00000000-0000-4000-8000-000000000000";
const EXPECTED = Object.fromEntries(
  Object.entries(buildDemoData({ today: TODAY, staff: { renata: any, bruno: any, larissa: any, tiago: any }, newId: () => any })).map(
    ([table, rows]) => [table, rows.length],
  ),
);

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

async function countsOf(storeId: string) {
  const counts: Record<string, number> = {};
  for (const table of DEMO_TABLES) {
    counts[table] = (await adminQuery(`select count(*)::int as n from ${table} where store_id = $1`, [storeId]))[0].n;
  }
  return counts;
}
const emails = async (storeId: string) =>
  (await adminQuery("select email from memberships where store_id = $1 order by email", [storeId])).map((row) => row.email);

let seed: Awaited<ReturnType<typeof seedTwoStores>>;
let ana: StoreMember;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  ana = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
});
afterEach(async () => {
  await adminQuery("alter table sales drop constraint if exists t_fail");
});

it("restores the demo through the owner's RLS with every generated row", async () => {
  expect(await restoreDemoStore(ana, TODAY)).toEqual({ ok: true });
  expect(await countsOf(seed.a.storeId)).toEqual(EXPECTED);
  expect(await emails(seed.a.storeId)).toEqual([
    "ana@lojaa.com", "beto@lojaa.com", "bruno@exemplo.invalid", "larissa@exemplo.invalid", "renata@exemplo.invalid",
    "tiago@exemplo.invalid",
  ]);
  const [car] = await adminQuery("select features from vehicles where store_id = $1 limit 1", [seed.a.storeId]);
  expect(car.features.length).toBeGreaterThan(0);
});

it("refuses a store that is not a demo", async () => {
  const carla: StoreMember = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla", storeName: "Loja B", isDemo: false };
  expect(await restoreDemoStore(carla, TODAY)).toEqual({ ok: false, error: "not_demo" });
  expect((await countsOf(seed.b.storeId)).vehicles).toBe(0);
});

it("refuses a manager and a seller", async () => {
  for (const role of ["manager", "seller"] as const) {
    expect(await restoreDemoStore({ ...ana, role }, TODAY)).toEqual({ ok: false, error: "forbidden" });
  }
  expect((await countsOf(seed.a.storeId)).vehicles).toBe(0);
});

it("restoring twice keeps one demo and the real members, and drops what was added", async () => {
  await restoreDemoStore(ana, TODAY);
  await adminQuery("insert into leads (store_id, name, seller_id) values ($1, 'Lead da visita', $2)", [seed.a.storeId, seed.a.beto.id]);
  await restoreDemoStore(ana, TODAY);
  expect(await countsOf(seed.a.storeId)).toEqual(EXPECTED);
  expect(await adminQuery("select 1 from leads where name = 'Lead da visita'")).toEqual([]);
  expect(await emails(seed.a.storeId)).toHaveLength(6);
});

it("leaves another store untouched", async () => {
  await seedDomainRows(seed.b.storeId, { owner: seed.b.carla.id, seller: seed.b.carla.id, seller2: seed.b.carla.id });
  const before = await countsOf(seed.b.storeId);
  await restoreDemoStore(ana, TODAY);
  expect(await countsOf(seed.b.storeId)).toEqual(before);
});

it("keeps the old demo when an insert fails midway", async () => {
  await restoreDemoStore(ana, TODAY);
  const before = await countsOf(seed.a.storeId);
  await adminQuery("alter table sales add constraint t_fail check (price < 0) not valid");
  await expect(restoreDemoStore(ana, TODAY)).rejects.toMatchObject({ code: "23514" });
  expect(await countsOf(seed.a.storeId)).toEqual(before);
  expect(await emails(seed.a.storeId)).toHaveLength(6);
});

it("ends with one full demo when two restores run at once", async () => {
  expect(await Promise.all([restoreDemoStore(ana, TODAY), restoreDemoStore(ana, TODAY)])).toEqual([{ ok: true }, { ok: true }]);
  expect(await countsOf(seed.a.storeId)).toEqual(EXPECTED);
  expect(await emails(seed.a.storeId)).toHaveLength(6);
});

it("records when the demo was restored", async () => {
  const started = Date.now();
  await restoreDemoStore(ana, TODAY);
  const [{ demo_restored_at: at }] = await adminQuery("select demo_restored_at from stores where id = $1", [seed.a.storeId]);
  expect(at.getTime()).toBeGreaterThanOrEqual(started - 1000);
  expect(at.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
});
