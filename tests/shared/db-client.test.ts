import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  UnsafeDatabaseRoleError,
  isLoginEmailAllowed,
  resolveMembership,
  withStore,
  type Role,
} from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { TEST_ADMIN_URL, TEST_APP_URL, TEST_DATABASE, TEST_PORT } from "../setup/urls.ts";

// Like the real module outside a Worker, it throws unless a test hands it a context.
const getCloudflareContext = vi.hoisted(() =>
  vi.fn((): unknown => {
    throw new Error("no Worker context");
  }),
);
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

const UNREACHABLE_URL = "postgres://nobody@127.0.0.1:1/none";
const urlFor = (login: string) => `postgres://${login}@127.0.0.1:${TEST_PORT}/${TEST_DATABASE}`;

let seed: Awaited<ReturnType<typeof seedTwoStores>>;
beforeEach(async () => {
  vi.stubEnv("APP_DATABASE_URL", TEST_APP_URL);
  seed = await seedTwoStores();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

const insertDani = "insert into memberships (store_id, email, name, role) values ($1, 'dani@x.com', 'Dani', 'seller')";
const emails = (storeId: string) =>
  withStore({ storeId, role: "seller" }, async (db) =>
    (await db.query<{ email: string }>("select email from memberships order by email")).map((row) => row.email),
  );

it("runs fn inside the store and commits", async () => {
  const { a } = seed;
  await withStore({ storeId: a.storeId, role: "owner" }, (db) => db.query(insertDani, [a.storeId]));
  expect(await emails(a.storeId)).toEqual(["ana@lojaa.com", "beto@lojaa.com", "dani@x.com"]);
});

it("rolls back when fn throws", async () => {
  const { a } = seed;
  const boom = new Error("boom");
  const insertThenThrow = withStore({ storeId: a.storeId, role: "owner" }, async (db) => {
    await db.query(insertDani, [a.storeId]);
    throw boom;
  });
  await expect(insertThenThrow).rejects.toBe(boom);
  expect(await emails(a.storeId)).toEqual(["ana@lojaa.com", "beto@lojaa.com"]);
});

// PostgreSQL answers COMMIT with ROLLBACK, and no error, once a statement failed.
it("rejects instead of committing when fn swallowed a database error", async () => {
  const { a } = seed;
  const swallowed = withStore({ storeId: a.storeId, role: "owner" }, async (db) => {
    await db.query(insertDani, [a.storeId]);
    await db.query("select 1/0").catch(() => {});
    return "ok";
  });
  await expect(swallowed).rejects.toThrow(/aborted/);
  expect(await emails(a.storeId)).toEqual(["ana@lojaa.com", "beto@lojaa.com"]);
});

it("rejects with the server's error when the connection drops inside fn", async () => {
  const dropped = withStore({ storeId: seed.a.storeId, role: "seller" }, async (db) => {
    const [{ pid }] = await db.query<{ pid: number }>("select pg_backend_pid() as pid");
    await adminQuery("select pg_terminate_backend($1, 5000)", [pid]);
    return db.query("select 1");
  });
  await expect(dropped).rejects.toMatchObject({ code: "57P01" });
});

// Hyperdrive hands the same origin connection to later requests, so the store must end with the transaction.
it("keeps the store setting local to the transaction", async () => {
  const after = await withStore({ storeId: seed.a.storeId, role: "owner" }, async (db) => {
    await db.query("commit");
    return db.query(`select current_setting('app.store_id', true) as store_id,
                            current_setting('app.role', true) as role,
                            (select count(*)::int from memberships) as members`);
  });
  expect(after).toEqual([{ store_id: "", role: "", members: 0 }]);
});

it("does not leak the store between calls", async () => {
  const { a, b } = seed;
  expect(await emails(a.storeId)).toEqual(["ana@lojaa.com", "beto@lojaa.com"]);
  expect(await emails(b.storeId)).toEqual(["carla@lojab.com"]);
});

it("refuses an unsafe role before running fn", async () => {
  vi.stubEnv("APP_DATABASE_URL", TEST_ADMIN_URL);
  const fn = vi.fn();
  await expect(withStore({ storeId: seed.a.storeId, role: "owner" }, fn)).rejects.toBeInstanceOf(
    UnsafeDatabaseRoleError,
  );
  expect(fn).not.toHaveBeenCalled();
});

// Roles are cluster-wide, so the teardown runs even when the check fails.
async function expectLoginRefused(login: string, setup: string, teardown: string) {
  await adminQuery(setup);
  try {
    vi.stubEnv("APP_DATABASE_URL", urlFor(login));
    const fn = vi.fn();
    await expect(withStore({ storeId: seed.a.storeId, role: "owner" }, fn)).rejects.toBeInstanceOf(
      UnsafeDatabaseRoleError,
    );
    expect(fn).not.toHaveBeenCalled();
  } finally {
    await adminQuery(teardown);
  }
}

it("refuses a role with BYPASSRLS", () =>
  expectLoginRefused("crm_bypass", "create role crm_bypass login bypassrls", "drop role crm_bypass"));

// SET ROLE needs no INHERIT, so any membership in a BYPASSRLS role is as good as having it.
it("refuses a login that can switch to a BYPASSRLS role", () =>
  expectLoginRefused(
    "crm_climber",
    "create role crm_bypassers nologin bypassrls; create role crm_climber login noinherit in role crm_bypassers",
    "drop role crm_climber; drop role crm_bypassers",
  ));

it("refuses a role that owns a table through an inherited role", () =>
  expectLoginRefused(
    "crm_heir",
    `create role crm_owners nologin;
     create role crm_heir login in role crm_owners;
     create table public.owned_probe (id int);
     alter table public.owned_probe owner to crm_owners`,
    "drop table public.owned_probe; drop role crm_heir; drop role crm_owners",
  ));

it("refuses a login with a NOINHERIT membership in a table owner", () =>
  expectLoginRefused(
    "crm_noinherit",
    `create role crm_owners_ni nologin;
     create role crm_noinherit login noinherit in role crm_owners_ni;
     create table public.owned_probe_ni (id int);
     alter table public.owned_probe_ni owner to crm_owners_ni`,
    "drop table public.owned_probe_ni; drop role crm_noinherit; drop role crm_owners_ni",
  ));

it("UnsafeDatabaseRoleError names itself in logs", () => {
  expect(String(new UnsafeDatabaseRoleError("x"))).toBe("UnsafeDatabaseRoleError: x");
});

it("rejects a store id that is not a uuid before connecting", async () => {
  vi.stubEnv("APP_DATABASE_URL", UNREACHABLE_URL);
  const fn = vi.fn();
  for (const storeId of ["", "not-a-uuid", `${seed.a.storeId}' or true --`, ` ${seed.a.storeId}`]) {
    await expect(withStore({ storeId, role: "owner" }, fn)).rejects.toThrow(/storeId/);
  }
  expect(fn).not.toHaveBeenCalled();
});

it("rejects a role outside owner, manager and seller before connecting", async () => {
  vi.stubEnv("APP_DATABASE_URL", UNREACHABLE_URL);
  const fn = vi.fn();
  for (const role of ["", "admin", "Owner", "owner "]) {
    await expect(withStore({ storeId: seed.a.storeId, role: role as Role }, fn)).rejects.toThrow(/role/);
  }
  expect(fn).not.toHaveBeenCalled();
});

it("surfaces the connection error when the database is unreachable", async () => {
  vi.stubEnv("APP_DATABASE_URL", UNREACHABLE_URL);
  const fn = vi.fn();
  await expect(withStore({ storeId: seed.a.storeId, role: "owner" }, fn)).rejects.toMatchObject({
    code: "ECONNREFUSED",
  });
  expect(fn).not.toHaveBeenCalled();
});

it("closes its connection whether fn succeeds or throws", async () => {
  const { a } = seed;
  await withStore({ storeId: a.storeId, role: "owner" }, (db) => db.query("select 1"));
  await withStore({ storeId: a.storeId, role: "owner" }, async () => {
    throw new Error("boom");
  }).catch(() => {});
  // The server ends a backend shortly after the client leaves, hence the wait.
  await vi.waitFor(async () => {
    expect(await adminQuery("select pid from pg_stat_activity where usename = 'crm_app'")).toEqual([]);
  });
});

it("reads the Hyperdrive binding when APP_DATABASE_URL is unset", async () => {
  vi.stubEnv("APP_DATABASE_URL", undefined);
  getCloudflareContext.mockReturnValueOnce({ env: { HYPERDRIVE: { connectionString: TEST_APP_URL } } });
  expect(await emails(seed.b.storeId)).toEqual(["carla@lojab.com"]);
});

it("resolveMembership maps the row", async () => {
  const { a } = seed;
  const ana = { membershipId: a.ana.id, storeId: a.storeId, role: "owner", name: "Ana" };
  expect(await resolveMembership({ workosUserId: "user_1", email: a.ana.email, emailVerified: true })).toEqual(ana);
  // The link was committed: the same WorkOS user now resolves without a verified email.
  expect(await resolveMembership({ workosUserId: "user_1", email: "other@x.com", emailVerified: false })).toEqual(ana);
});

it("resolveMembership returns null when nothing matches", async () => {
  expect(await resolveMembership({ workosUserId: "user_9", email: "nobody@lojaa.com", emailVerified: true })).toBeNull();
});

it("isLoginEmailAllowed is true only for invited emails", async () => {
  expect(await isLoginEmailAllowed(seed.a.ana.email)).toBe(true);
  expect(await isLoginEmailAllowed(seed.b.carla.email)).toBe(true);
  expect(await isLoginEmailAllowed("x@y.com")).toBe(false);
});

it("login lookups refuse an unsafe role before calling the database function", async () => {
  const { ana } = seed.a;
  vi.stubEnv("APP_DATABASE_URL", TEST_ADMIN_URL);
  await expect(
    resolveMembership({ workosUserId: "user_1", email: ana.email, emailVerified: true }),
  ).rejects.toBeInstanceOf(UnsafeDatabaseRoleError);
  await expect(isLoginEmailAllowed(ana.email)).rejects.toBeInstanceOf(UnsafeDatabaseRoleError);
  expect(await adminQuery("select workos_user_id from memberships where id = $1", [ana.id])).toEqual([
    { workos_user_id: null },
  ]);
});
