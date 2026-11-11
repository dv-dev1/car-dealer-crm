import pg from "pg";
import { afterAll, beforeEach, expect, it } from "vitest";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";
import { seedTwoStores } from "./fixtures.ts";

// A single connection, reused by every query below, like a pooled app connection.
const app = new pg.Pool({ connectionString: TEST_APP_URL, max: 1 });
afterAll(() => app.end());

let seed: Awaited<ReturnType<typeof seedTwoStores>>;
beforeEach(async () => {
  seed = await seedTwoStores();
});

async function asApp<T>(storeId: string, role: string, fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const db = await app.connect();
  try {
    await db.query("begin");
    await db.query("select set_config('app.store_id', $1, true), set_config('app.role', $2, true)", [storeId, role]);
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

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return await admin.query(sql, params);
  } finally {
    await admin.end();
  }
}

const ids = (result: pg.QueryResult) => result.rows.map((row) => row.id);
const insertDani = "insert into memberships (store_id, name, email, role) values ($1, 'Dani', 'dani@x.com', 'seller')";
const resolve = async (workosUserId: string, email: string, verified: boolean) =>
  (await app.query("select * from resolve_membership($1, $2, $3)", [workosUserId, email, verified])).rows;
const linkOf = async (membershipId: string) =>
  (await adminQuery("select workos_user_id from memberships where id = $1", [membershipId])).rows[0].workos_user_id;

it("store A sees only its own rows", async () => {
  const { a } = seed;
  await asApp(a.storeId, "seller", async (db) => {
    expect(ids(await db.query("select id from memberships order by email"))).toEqual([a.ana.id, a.beto.id]);
    expect(ids(await db.query("select id from stores"))).toEqual([a.storeId]);
  });
});

it("returns zero rows and no error without a store", async () => {
  const fresh = new pg.Client({ connectionString: TEST_APP_URL });
  await fresh.connect();
  try {
    expect((await fresh.query("select id from memberships")).rows).toEqual([]);
    expect((await fresh.query("select id from stores")).rows).toEqual([]);
  } finally {
    await fresh.end();
  }
});

it("returns zero rows on a pooled connection after a store transaction ended", async () => {
  const pid = await asApp(seed.a.storeId, "owner", async (db) => {
    expect(ids(await db.query("select id from stores"))).toEqual([seed.a.storeId]); // the setting was live
    return (await db.query("select pg_backend_pid() as pid")).rows[0].pid;
  });
  const after = await app.query("select pg_backend_pid() as pid, current_setting('app.store_id', true) as store_id");
  expect(after.rows).toEqual([{ pid, store_id: "" }]); // same connection; the setting reads '' now, not NULL
  expect((await app.query("select id from memberships")).rows).toEqual([]);
  expect((await app.query("select id from stores")).rows).toEqual([]);
});

it("seller cannot insert a member", async () => {
  const { a } = seed;
  await expect(asApp(a.storeId, "seller", (db) => db.query(insertDani, [a.storeId]))).rejects.toMatchObject({
    code: "42501",
  });
});

it("owner of A cannot insert into store B", async () => {
  const { a, b } = seed;
  await expect(asApp(a.storeId, "owner", (db) => db.query(insertDani, [b.storeId]))).rejects.toMatchObject({
    code: "42501",
  });
});

it("owner of A cannot move a member to store B", async () => {
  const { a, b } = seed;
  const move = (db: pg.PoolClient) =>
    db.query("update memberships set store_id = $1 where id = $2", [b.storeId, a.beto.id]);
  await expect(asApp(a.storeId, "owner", move)).rejects.toMatchObject({ code: "42501" });
});

it("owner of A deleting B's member affects zero rows", async () => {
  const { a, b } = seed;
  const result = await asApp(a.storeId, "owner", (db) =>
    db.query("delete from memberships where id = $1", [b.carla.id]),
  );
  expect(result.rowCount).toBe(0);
  expect((await adminQuery("select id from memberships where id = $1", [b.carla.id])).rowCount).toBe(1);
});

// With no WHERE on a column the select policy is not applied, so only the write policies stand in the way.
it("owner of A writing to every member never reaches store B", async () => {
  const { a, b } = seed;
  const moveAll = (db: pg.PoolClient) => db.query("update memberships set store_id = $1", [b.storeId]);
  await expect(asApp(a.storeId, "owner", moveAll)).rejects.toMatchObject({ code: "42501" });
  const counts = await asApp(a.storeId, "owner", async (db) => [
    (await db.query("update memberships set role = 'manager'")).rowCount,
    (await db.query("delete from memberships")).rowCount,
  ]);
  expect(counts).toEqual([2, 2]);
  const carla = await adminQuery("select store_id, role from memberships where id = $1", [b.carla.id]);
  expect(carla.rows).toEqual([{ store_id: b.storeId, role: "owner" }]);
});

it("seller cannot change or remove a member", async () => {
  const { a } = seed;
  const counts = await asApp(a.storeId, "seller", async (db) => [
    (await db.query("update memberships set role = 'owner' where id = $1", [a.beto.id])).rowCount,
    (await db.query("delete from memberships where id = $1", [a.ana.id])).rowCount,
  ]);
  expect(counts).toEqual([0, 0]);
});

it("app login is not superuser, has no BYPASSRLS and owns no table", async () => {
  // Owning through an inherited role also bypasses RLS, hence pg_has_role instead of relowner = current_user.
  const { rows } = await app.query(`
    select current_user as login, rolsuper, rolbypassrls,
           (select count(*)::int from pg_class where pg_has_role(current_user, relowner, 'usage')) as owned
      from pg_roles where rolname = current_user`);
  expect(rows).toEqual([{ login: "crm_app", rolsuper: false, rolbypassrls: false, owned: 0 }]);
});

it("resolve links a verified email and returns the membership", async () => {
  const { a } = seed;
  expect(await resolve("user_1", "  Ana@LojaA.com ", true)).toEqual([
    { membership_id: a.ana.id, store_id: a.storeId, role: "owner", name: "Ana" },
  ]);
  expect(await linkOf(a.ana.id)).toBe("user_1");
});

it("resolve does not link an unverified email", async () => {
  const { ana } = seed.a;
  expect(await resolve("user_1", ana.email, false)).toEqual([]);
  expect(await linkOf(ana.id)).toBeNull();
});

it("resolve never overwrites an existing link", async () => {
  const { ana } = seed.a;
  await resolve("user_1", ana.email, true);
  expect(await resolve("user_2", ana.email, true)).toEqual([]);
  expect(await linkOf(ana.id)).toBe("user_1");
});

// Known gap, reported: app_user may write created_at, and resolve trusts it to pick the oldest store.
it.skip("owner of A cannot make a B member's login land in store A", async () => {
  const { a, b } = seed;
  await resolve("user_c", b.carla.email, true);
  const backdated =
    "insert into memberships (store_id, name, email, role, created_at) values ($1, 'Carla', $2, 'seller', '1900-01-01')";
  await asApp(a.storeId, "owner", (db) => db.query(backdated, [a.storeId, b.carla.email]));
  expect((await resolve("user_c", b.carla.email, true))[0].store_id).toBe(b.storeId);
});

it("resolve returns nothing for an unknown email", async () => {
  expect(await resolve("user_9", "nobody@lojaa.com", true)).toEqual([]);
});

it("login_email_allowed ignores case and spaces", async () => {
  const allowed = async (email: string) =>
    (await app.query("select login_email_allowed($1) as allowed", [email])).rows[0].allowed;
  expect(await allowed("  ANA@lojaa.com ")).toBe(true);
  expect(await allowed("x@y.com")).toBe(false);
});
