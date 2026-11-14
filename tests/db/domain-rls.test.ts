import pg from "pg";
import { afterAll, beforeEach, expect, it } from "vitest";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";
import { seedDomainRows, seedTwoStores } from "./fixtures.ts";

const DOMAIN = [
  "vehicles", "vehicle_finances", "vehicle_photos", "vehicle_expenses", "vehicle_documents", "channels",
  "channel_costs", "leads", "lead_contacts", "sales", "sale_finances", "reservations", "commission_rules",
  "goals", "store_expenses",
];
const MANAGERS_ONLY = ["vehicle_finances", "vehicle_expenses", "sale_finances", "channel_costs", "commission_rules"];

const app = new pg.Pool({ connectionString: TEST_APP_URL, max: 1 });
afterAll(() => app.end());

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return await admin.query(sql, params);
  } finally {
    await admin.end();
  }
}

async function asApp<T>(
  who: { storeId: string; role: string; membershipId: string | null },
  fn: (db: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const db = await app.connect();
  try {
    await db.query("begin");
    await db.query(
      "select set_config('app.store_id', $1, true), set_config('app.role', $2, true), set_config('app.membership_id', $3, true)",
      [who.storeId, who.role, who.membershipId ?? ""],
    );
    const result = await fn(db);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback").catch(() => {}); // a dead connection must not hide the real error
    throw error;
  } finally {
    db.release();
  }
}

const byPolicy = { code: "42501", message: expect.stringMatching(/row-level security/) };
const count = async (db: pg.PoolClient, table: string, storeId: string) =>
  Number((await db.query(`select count(*) from ${table} where store_id = $1`, [storeId])).rows[0].count);

let a: { storeId: string; owner: string; seller: string; seller2: string; manager: string };
let b: { storeId: string; owner: string };
let rowsA: Awaited<ReturnType<typeof seedDomainRows>>;
let rowsB: Awaited<ReturnType<typeof seedDomainRows>>;
const owner = () => ({ storeId: a.storeId, role: "owner", membershipId: a.owner });
const manager = () => ({ storeId: a.storeId, role: "manager", membershipId: a.manager });
const seller = () => ({ storeId: a.storeId, role: "seller", membershipId: a.seller });

beforeEach(async () => {
  const seed = await seedTwoStores();
  const member = async (name: string, email: string, role: string) =>
    (
      await adminQuery("insert into memberships (store_id, name, email, role) values ($1, $2, $3, $4) returning id", [
        seed.a.storeId, name, email, role,
      ])
    ).rows[0].id as string;
  a = {
    storeId: seed.a.storeId,
    owner: seed.a.ana.id,
    seller: seed.a.beto.id,
    seller2: await member("Dani", "dani@lojaa.com", "seller"),
    manager: await member("Mara", "mara@lojaa.com", "manager"),
  };
  b = { storeId: seed.b.storeId, owner: seed.b.carla.id };
  rowsA = await seedDomainRows(a.storeId, { owner: a.owner, seller: a.seller, seller2: a.seller2 });
  rowsB = await seedDomainRows(b.storeId, { owner: b.owner, seller: b.owner, seller2: b.owner });
});

it("enables row level security on every domain table and leaves no public table without it", async () => {
  const { rows } = await adminQuery(
    "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'",
  );
  const secured = rows.filter((row) => row.relrowsecurity).map((row) => row.relname);
  const open = rows.filter((row) => !row.relrowsecurity).map((row) => row.relname);
  expect(secured).toEqual(expect.arrayContaining(DOMAIN));
  expect(open).toEqual(["schema_migrations"]);
});

it("shows a store none of another store's rows in any domain table", async () => {
  for (const table of DOMAIN) {
    expect(await asApp(owner(), (db) => count(db, table, a.storeId)), table).toBeGreaterThan(0);
    expect(await asApp({ storeId: b.storeId, role: "owner", membershipId: b.owner }, (db) => count(db, table, a.storeId)), table).toBe(0);
  }
});

it("hides from a seller every table private to owner and manager", async () => {
  for (const table of [...MANAGERS_ONLY, "store_expenses"]) {
    expect(await asApp(seller(), (db) => count(db, table, a.storeId)), table).toBe(0);
    expect(await asApp(owner(), (db) => count(db, table, a.storeId)), table).toBeGreaterThan(0);
  }
});

it("shows a manager every private table except store_expenses", async () => {
  for (const table of MANAGERS_ONLY) {
    expect(await asApp(manager(), (db) => count(db, table, a.storeId)), table).toBeGreaterThan(0);
  }
  expect(await asApp(manager(), (db) => count(db, "store_expenses", a.storeId))).toBe(0);
});

it("shows a seller the store goal and their own, not a colleague's", async () => {
  const { rows } = await asApp(seller(), (db) => db.query("select member_id from goals order by member_id nulls first"));
  expect(rows.map((row) => row.member_id)).toEqual([null, a.seller]);
});

it("lets a seller create a lead only for themselves", async () => {
  const sql = "insert into leads (store_id, name, seller_id) values ($1, 'Novo', $2)";
  await expect(asApp(seller(), (db) => db.query(sql, [a.storeId, a.seller2]))).rejects.toMatchObject(byPolicy);
  await expect(asApp(seller(), (db) => db.query(sql, [a.storeId, a.seller]))).resolves.toBeDefined();
});

it("lets a seller edit only their own leads and not hand one over", async () => {
  const note = "update leads set note = 'ligar' where id = $1";
  expect((await asApp(seller(), (db) => db.query(note, [rowsA.leadOfSeller2]))).rowCount).toBe(0);
  expect((await asApp(seller(), (db) => db.query(note, [rowsA.leadOfSeller]))).rowCount).toBe(1);
  const handOver = asApp(seller(), (db) => db.query("update leads set seller_id = $1 where id = $2", [a.seller2, rowsA.leadOfSeller]));
  await expect(handOver).rejects.toMatchObject(byPolicy);
});

it("lets a seller log a contact only on their own leads", async () => {
  const sql = "insert into lead_contacts (store_id, lead_id, member_id, kind) values ($1, $2, $3, 'call')";
  await expect(asApp(seller(), (db) => db.query(sql, [a.storeId, rowsA.leadOfSeller2, a.seller]))).rejects.toMatchObject(byPolicy);
  await expect(asApp(seller(), (db) => db.query(sql, [a.storeId, rowsA.leadOfSeller, a.seller]))).resolves.toBeDefined();
});

it("refuses a seller writing vehicles, sales, expenses or costs", async () => {
  const writes: [string, unknown[]][] = [
    [
      "insert into vehicles (store_id, slug, brand, model, version, model_year, manufacture_year, km, fuel, transmission, price, entered_on) values ($1, 'x', 'Fiat', 'Mobi', 'Like', 2020, 2020, 1, 'Flex', 'Manual', 40000, '2026-11-01')",
      [a.storeId],
    ],
    ["insert into vehicle_expenses (store_id, vehicle_id, category, spent_on, amount) values ($1, $2, 'other', '2026-11-01', 10)", [a.storeId, rowsA.vehicleId]],
    ["insert into vehicle_finances (store_id, vehicle_id, purchase_price) values ($1, $2, 1)", [a.storeId, rowsA.vehicleId]],
    ["update sales set price = 1 where id = $1 returning id", [rowsA.saleId]],
  ];
  for (const [sql, params] of writes) {
    const result = asApp(seller(), (db) => db.query(sql, params));
    if (sql.startsWith("update")) expect((await result).rowCount, sql).toBe(0);
    else await expect(result, sql).rejects.toMatchObject(byPolicy);
  }
});

it("lets a seller record a reservation only as themselves", async () => {
  const sql = "insert into reservations (store_id, vehicle_id, deposit, expires_on, created_by) values ($1, $2, 500, '2026-11-30', $3)";
  await expect(asApp(seller(), (db) => db.query(sql, [a.storeId, rowsA.vehicleId, a.seller2]))).rejects.toMatchObject(byPolicy);
  await expect(asApp(seller(), (db) => db.query(sql, [a.storeId, rowsA.vehicleId, a.seller]))).resolves.toBeDefined();
});

it("gives a seller without app.membership_id no lead to edit", async () => {
  const anonymous = { storeId: a.storeId, role: "seller", membershipId: null };
  const result = await asApp(anonymous, (db) => db.query("update leads set note = 'x' where id = $1", [rowsA.leadOfSeller]));
  expect(result.rowCount).toBe(0);
});

it("refuses a row pointing at another store's vehicle", async () => {
  const sql = "insert into vehicle_expenses (store_id, vehicle_id, category, spent_on, amount) values ($1, $2, 'other', '2026-11-01', 10)";
  await expect(asApp(owner(), (db) => db.query(sql, [a.storeId, rowsB.vehicleId]))).rejects.toMatchObject({ code: "23503" });
});

it("keeps sales and unassigns leads when a seller is removed", async () => {
  await adminQuery("delete from memberships where id = $1", [a.seller]);
  const sale = (await adminQuery("select seller_id, seller_name from sales where id = $1", [rowsA.saleId])).rows[0];
  expect(sale).toEqual({ seller_id: null, seller_name: "Beto" });
  const lead = (await adminQuery("select seller_id from leads where id = $1", [rowsA.leadOfSeller])).rows[0];
  expect(lead.seller_id).toBeNull();
});

it("reset_demo_store empties only the demo store and keeps its real members", async () => {
  await adminQuery("update stores set is_demo = true where id = $1", [a.storeId]);
  await adminQuery("insert into memberships (store_id, name, email, role) values ($1, 'Renata', 'renata@exemplo.invalid', 'manager')", [a.storeId]);
  await asApp(owner(), (db) => db.query("select reset_demo_store()"));
  for (const table of DOMAIN) {
    const left = await adminQuery(`select store_id from ${table} where store_id in ($1, $2)`, [a.storeId, b.storeId]);
    expect(left.rows.every((row) => row.store_id === b.storeId) && left.rowCount! > 0, table).toBe(true);
  }
  const members = await adminQuery("select email from memberships where store_id = $1 order by email", [a.storeId]);
  expect(members.rows.map((row) => row.email)).toEqual(["ana@lojaa.com", "beto@lojaa.com", "dani@lojaa.com", "mara@lojaa.com"]);
  const store = await adminQuery("select demo_restored_at from stores where id = $1", [a.storeId]);
  expect(store.rows[0].demo_restored_at).toBeInstanceOf(Date);
});

it("reset_demo_store refuses a store that is not a demo", async () => {
  await expect(asApp(owner(), (db) => db.query("select reset_demo_store()"))).rejects.toMatchObject({
    message: expect.stringMatching(/not a demo store/),
  });
});

it("reset_demo_store refuses a manager and a seller", async () => {
  await adminQuery("update stores set is_demo = true where id = $1", [a.storeId]);
  for (const who of [manager(), seller()]) {
    await expect(asApp(who, (db) => db.query("select reset_demo_store()"))).rejects.toMatchObject({ code: "42501" });
  }
  expect(await asApp(owner(), (db) => count(db, "vehicles", a.storeId))).toBe(2);
});
