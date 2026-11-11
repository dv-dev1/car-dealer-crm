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
const insertDani = "insert into memberships (store_id, name, email, role) values ($1, 'Dani', 'dani@x.com', $2)";
const resolve = async (workosUserId: string | null, email: string, verified: boolean) =>
  (await app.query("select * from resolve_membership($1, $2, $3)", [workosUserId, email, verified])).rows;
const linkOf = async (membershipId: string) =>
  (await adminQuery("select workos_user_id from memberships where id = $1", [membershipId])).rows[0].workos_user_id;
// The owner of `storeId` adds a seller through the app, as a store would.
const invite = async (storeId: string, name: string, email: string) => {
  const sql = "insert into memberships (store_id, name, email, role) values ($1, $2, $3, 'seller') returning id";
  return (await asApp(storeId, "owner", (db) => db.query(sql, [storeId, name, email]))).rows[0].id as string;
};
// 42501 is raised both by a policy and by a missing column grant; the message tells which one stopped the write.
const byPolicy = { code: "42501", message: expect.stringMatching(/row-level security/) };
const byGrant = { code: "42501", message: expect.stringMatching(/permission denied/) };

// Keeps a first login's transaction open, starts `second`, waits until it blocks on a lock, then commits.
async function whileFirstLoginHolds<T>(workosUserId: string, email: string, second: () => Promise<T>) {
  const first = new pg.Client({ connectionString: TEST_APP_URL });
  await first.connect();
  try {
    await first.query("begin");
    await first.query("select * from resolve_membership($1, $2, true)", [workosUserId, email]);
    const pending = second();
    pending.catch(() => {}); // awaited below; this only stops an early rejection from being reported as unhandled
    const waiting = "select exists (select from pg_stat_activity where wait_event_type = 'Lock') as waiting";
    for (let i = 0; i < 100 && !(await adminQuery(waiting)).rows[0].waiting; i++) {
      await new Promise((done) => setTimeout(done, 20));
    }
    await first.query("commit");
    return await pending;
  } finally {
    await first.end();
  }
}

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
  const add = (db: pg.PoolClient) => db.query(insertDani, [a.storeId, "seller"]);
  await expect(asApp(a.storeId, "seller", add)).rejects.toMatchObject(byPolicy);
});

it("owner of A cannot insert into store B", async () => {
  const { a, b } = seed;
  const add = (db: pg.PoolClient) => db.query(insertDani, [b.storeId, "seller"]);
  await expect(asApp(a.storeId, "owner", add)).rejects.toMatchObject(byPolicy);
});

it("owner of A cannot move a member to store B", async () => {
  const { a, b } = seed;
  const move = (db: pg.PoolClient) =>
    db.query("update memberships set store_id = $1 where id = $2", [b.storeId, a.beto.id]);
  await expect(asApp(a.storeId, "owner", move)).rejects.toMatchObject(byGrant); // store_id is not updatable
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
  await expect(asApp(a.storeId, "owner", moveAll)).rejects.toMatchObject(byGrant);
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

it("manager can add a seller", async () => {
  const { a } = seed;
  const result = await asApp(a.storeId, "manager", (db) => db.query(insertDani, [a.storeId, "seller"]));
  expect(result.rowCount).toBe(1);
});

it("manager cannot add a manager", async () => {
  const { a } = seed;
  const add = (db: pg.PoolClient) => db.query(insertDani, [a.storeId, "manager"]);
  await expect(asApp(a.storeId, "manager", add)).rejects.toMatchObject(byPolicy);
});

it("manager cannot promote a seller to owner", async () => {
  const { a } = seed;
  const promote = (db: pg.PoolClient) => db.query("update memberships set role = 'owner' where id = $1", [a.beto.id]);
  await expect(asApp(a.storeId, "manager", promote)).rejects.toMatchObject(byPolicy);
});

it("manager cannot change or remove an owner", async () => {
  const { a } = seed;
  const counts = await asApp(a.storeId, "manager", async (db) => [
    (await db.query("update memberships set name = 'Ana X' where id = $1", [a.ana.id])).rowCount,
    (await db.query("delete from memberships where id = $1", [a.ana.id])).rowCount,
  ]);
  expect(counts).toEqual([0, 0]);
  const ana = await adminQuery("select name, role from memberships where id = $1", [a.ana.id]);
  expect(ana.rows).toEqual([{ name: "Ana", role: "owner" }]);
});

it("owner can add, promote, change and remove any member", async () => {
  const { a } = seed;
  const insertEva = "insert into memberships (store_id, name, email, role) values ($1, 'Eva', 'eva@x.com', 'manager')";
  const counts = await asApp(a.storeId, "owner", async (db) => [
    (await db.query(insertDani, [a.storeId, "seller"])).rowCount,
    (await db.query(insertEva, [a.storeId])).rowCount,
    (await db.query("update memberships set role = 'owner' where id = $1", [a.beto.id])).rowCount,
    (await db.query("update memberships set name = 'Beto X' where id = $1", [a.beto.id])).rowCount,
    (await db.query("delete from memberships where id = $1", [a.beto.id])).rowCount,
  ]);
  expect(counts).toEqual([1, 1, 1, 1, 1]);
});

it("app login is not superuser, has no BYPASSRLS and owns no table", async () => {
  // Owning through an inherited role also bypasses RLS, hence pg_has_role instead of relowner = current_user.
  const { rows } = await app.query(`
    select current_user as login, rolsuper, rolbypassrls,
           (select count(*)::int from pg_class where pg_has_role(current_user, relowner, 'usage')) as owned
      from pg_roles where rolname = current_user`);
  expect(rows).toEqual([{ login: "crm_app", rolsuper: false, rolbypassrls: false, owned: 0 }]);
  const group = await app.query("select rolsuper, rolbypassrls, rolcanlogin from pg_roles where rolname = 'app_user'");
  expect(group.rows).toEqual([{ rolsuper: false, rolbypassrls: false, rolcanlogin: false }]);
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

// The reviewer's P2: A plants an invite for someone B already has, then waits for B to re-add them.
it("store A cannot capture the login of a person already linked in store B", async () => {
  const { a, b } = seed;
  const eliInB = await invite(b.storeId, "Eli", "eli@lojab.com");
  await resolve("user_e", "eli@lojab.com", true);
  const eliInA = await invite(a.storeId, "Eli", "eli@lojab.com");
  const landed = await resolve("user_e", "eli@lojab.com", true);
  expect(landed).toMatchObject([{ membership_id: eliInB, store_id: b.storeId }]);
  expect(await linkOf(eliInA)).toBeNull();
  await asApp(b.storeId, "owner", (db) => db.query("delete from memberships where id = $1", [eliInB]));
  const eliInBAgain = await invite(b.storeId, "Eli", "eli@lojab.com");
  expect(await resolve("user_e", "eli@lojab.com", true)).toEqual([]); // two open invites: neither store wins
  expect([await linkOf(eliInA), await linkOf(eliInBAgain)]).toEqual([null, null]);
});

// Accepted behavior, asserted to document it: with one open invite, the store that sent it is where the person lands.
it("a person invited only by store A lands in store A", async () => {
  const { a } = seed;
  const eli = await invite(a.storeId, "Eli", "eli@lojab.com");
  expect(await resolve("user_e", "eli@lojab.com", true)).toEqual([
    { membership_id: eli, store_id: a.storeId, role: "seller", name: "Eli" },
  ]);
  expect(await linkOf(eli)).toBe("user_e");
});

it("a person invited by two stores before the first login lands nowhere", async () => {
  const { a, b } = seed;
  const eliInA = await invite(a.storeId, "Eli", "eli@lojab.com");
  const eliInB = await invite(b.storeId, "Eli", "eli@lojab.com");
  expect(await resolve("user_e", "eli@lojab.com", true)).toEqual([]);
  expect([await linkOf(eliInA), await linkOf(eliInB)]).toEqual([null, null]);
});

it("a linked person's invite to another store never changes where they land", async () => {
  const { a, b } = seed;
  await resolve("user_a", a.ana.email, true);
  const anaInB = await invite(b.storeId, "Ana", a.ana.email);
  const logins = [[a.ana.email, true], [a.ana.email, false], ["ana@elsewhere.com", true]] as const;
  for (const [email, verified] of logins) {
    expect(await resolve("user_a", email, verified)).toMatchObject([{ membership_id: a.ana.id }]);
  }
  expect(await linkOf(anaInB)).toBeNull();
});

it("only open invites count when a new identity links", async () => {
  const { a, b } = seed;
  await resolve("user_a", a.ana.email, true);
  const anaInB = await invite(b.storeId, "Ana", a.ana.email);
  expect(await resolve("user_z", a.ana.email, true)).toMatchObject([{ membership_id: anaInB }]);
  expect(await linkOf(a.ana.id)).toBe("user_a");
});

it("resolve ignores a missing, empty or blank user id", async () => {
  const { a, b } = seed;
  for (const workosUserId of [null, "", "   "]) {
    expect(await resolve(workosUserId, a.ana.email, true)).toEqual([]);
    expect(await resolve(workosUserId, b.carla.email, true)).toEqual([]);
  }
  expect([await linkOf(a.ana.id), await linkOf(b.carla.id)]).toEqual([null, null]);
});

it("the schema refuses an empty or shared workos_user_id", async () => {
  const { a, b } = seed;
  const empty = adminQuery("update memberships set workos_user_id = '' where id = $1", [a.ana.id]);
  await expect(empty).rejects.toMatchObject({ code: "23514" });
  const sql = "update memberships set workos_user_id = 'user_x' where id = any($1)";
  const shared = adminQuery(sql, [[a.ana.id, b.carla.id]]);
  await expect(shared).rejects.toMatchObject({ code: "23505" });
});

it("two concurrent first logins of the same person both get the one row", async () => {
  const { ana } = seed.a;
  expect(await whileFirstLoginHolds("user_1", ana.email, () => resolve("user_1", ana.email, true))).toMatchObject([
    { membership_id: ana.id },
  ]);
  expect(await linkOf(ana.id)).toBe("user_1");
});

it("a concurrent first login under another e-mail gets the row that won", async () => {
  const { a, b } = seed;
  const second = () => resolve("user_1", b.carla.email, true); // would link Carla's row to the same person
  expect(await whileFirstLoginHolds("user_1", a.ana.email, second)).toMatchObject([{ membership_id: a.ana.id }]);
  expect(await linkOf(b.carla.id)).toBeNull();
});

it("a concurrent first login by another identity cannot take the row being linked", async () => {
  const { ana } = seed.a;
  expect(await whileFirstLoginHolds("user_1", ana.email, () => resolve("user_2", ana.email, true))).toEqual([]);
  expect(await linkOf(ana.id)).toBe("user_1");
});

it("owner cannot backdate a membership", async () => {
  const { a } = seed;
  const backdated =
    "insert into memberships (store_id, name, email, role, created_at) " +
    "values ($1, 'Dani', 'dani@x.com', 'seller', '1900-01-01')";
  const plant = (db: pg.PoolClient) => db.query(backdated, [a.storeId]);
  await expect(asApp(a.storeId, "owner", plant)).rejects.toMatchObject(byGrant);
});

it("owner cannot set workos_user_id on insert or update", async () => {
  const { a } = seed;
  const preLinked =
    "insert into memberships (store_id, name, email, role, workos_user_id) " +
    "values ($1, 'Dani', 'dani@x.com', 'seller', 'user_c')";
  const plant = (db: pg.PoolClient) => db.query(preLinked, [a.storeId]);
  await expect(asApp(a.storeId, "owner", plant)).rejects.toMatchObject(byGrant);
  const link = (db: pg.PoolClient) =>
    db.query("update memberships set workos_user_id = 'user_c' where id = $1", [a.beto.id]);
  await expect(asApp(a.storeId, "owner", link)).rejects.toMatchObject(byGrant);
});

it("owner cannot change a member's e-mail", async () => {
  const { a } = seed;
  const rename = (db: pg.PoolClient) =>
    db.query("update memberships set email = 'beto2@lojaa.com' where id = $1", [a.beto.id]);
  await expect(asApp(a.storeId, "owner", rename)).rejects.toMatchObject(byGrant);
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
