import pg from "pg";
import { beforeEach, expect, it } from "vitest";
import { convertToDemoStore, createDemoStore } from "../../scripts/demo-store.ts";
import { seedDomainRows, seedTwoStores } from "../db/fixtures.ts";
import { TEST_ADMIN_URL } from "../setup/urls.ts";

async function query(sql: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}

let seed: Awaited<ReturnType<typeof seedTwoStores>>;
beforeEach(async () => {
  seed = await seedTwoStores();
});

it("createDemoStore creates a demo store with its owner and the Maré data", async () => {
  const { storeId } = await createDemoStore(TEST_ADMIN_URL, { slug: "mare-teste", ownerName: "Dono", ownerEmail: " Dono@Exemplo.com " });
  const [store] = await query("select name, slug, city, whatsapp, is_demo, demo_restored_at from stores where id = $1", [storeId]);
  expect(store).toMatchObject({ name: "Maré Veículos", slug: "mare-teste", city: "João Pessoa - PB", whatsapp: "558390000000", is_demo: true });
  expect(store.demo_restored_at).toBeInstanceOf(Date);
  const owners = await query("select email from memberships where store_id = $1 and role = 'owner'", [storeId]);
  expect(owners).toEqual([{ email: "dono@exemplo.com" }]);
  const [{ n }] = await query("select count(*)::int as n from vehicles where store_id = $1 and status <> 'sold'", [storeId]);
  expect(n).toBe(22);
});

it("convertToDemoStore marks a store as demo, renames it and fills it", async () => {
  await convertToDemoStore(TEST_ADMIN_URL, seed.a.storeId);
  const [store] = await query("select name, is_demo from stores where id = $1", [seed.a.storeId]);
  expect(store).toEqual({ name: "Maré Veículos", is_demo: true });
  const [{ n }] = await query("select count(*)::int as n from sales where store_id = $1", [seed.a.storeId]);
  expect(n).toBeGreaterThan(50);
  const kept = await query("select email from memberships where store_id = $1 and email like '%@lojaa.com' order by email", [seed.a.storeId]);
  expect(kept.map((row) => row.email)).toEqual(["ana@lojaa.com", "beto@lojaa.com"]);
});

it("convertToDemoStore refuses a store with its own data that is not a demo yet, and changes nothing", async () => {
  await seedDomainRows(seed.a.storeId, { owner: seed.a.ana.id, seller: seed.a.beto.id, seller2: seed.a.beto.id });
  await expect(convertToDemoStore(TEST_ADMIN_URL, seed.a.storeId)).rejects.toThrow(/already has data/);
  const [store] = await query("select name, is_demo from stores where id = $1", [seed.a.storeId]);
  expect(store).toEqual({ name: "Loja A", is_demo: false });
  const [{ n }] = await query("select count(*)::int as n from vehicles where store_id = $1", [seed.a.storeId]);
  expect(n).toBe(2);
});

it("convertToDemoStore refills a store that is already a demo", async () => {
  await convertToDemoStore(TEST_ADMIN_URL, seed.a.storeId);
  await convertToDemoStore(TEST_ADMIN_URL, seed.a.storeId);
  const [{ n }] = await query("select count(*)::int as n from vehicles where store_id = $1 and status <> 'sold'", [seed.a.storeId]);
  expect(n).toBe(22);
});

it("convertToDemoStore refuses a store that does not exist", async () => {
  await expect(convertToDemoStore(TEST_ADMIN_URL, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(/No store/);
});

it("rejects an owner e-mail that is not an e-mail and creates nothing", async () => {
  await expect(createDemoStore(TEST_ADMIN_URL, { slug: "mare-x", ownerName: "Dono", ownerEmail: "dono" })).rejects.toThrow(/e-mail/);
  expect(await query("select 1 from stores where slug = 'mare-x'")).toEqual([]);
});
