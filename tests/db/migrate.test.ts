import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../db/migrate.ts";
import { TEST_ADMIN_URL } from "../setup/urls.ts";
import { createNeonLikeAdmin } from "./fixtures.ts";

async function query(sql: string, params: unknown[] = [], url = TEST_ADMIN_URL) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

async function tableExists(name: string) {
  const { rows } = await query("select to_regclass($1) is not null as found", [`public.${name}`]);
  return rows[0].found as boolean;
}

// Leave the shared database as the next test file expects to find it.
afterAll(async () => {
  await query("drop table if exists fixture_ok");
  await query("delete from schema_migrations where name = '0001_ok.sql'");
});

it("applies pending migrations once", async () => {
  expect(await migrate(TEST_ADMIN_URL)).toEqual([]); // globalSetup already applied them
});

it("rolls back a failing migration and keeps the earlier ones", async () => {
  await expect(migrate(TEST_ADMIN_URL, "tests/db/fixtures/bad")).rejects.toThrow(/fixture_does_not_exist/);
  expect(await tableExists("fixture_ok")).toBe(true); // 0001_ok.sql
  expect(await tableExists("fixture_broken")).toBe(false); // 0002_broken.sql
});

// Roles are cluster-wide, so the shared app_user is the "pre-existing" one; the schema goes to a database of its own.
describe("the migrations as a non-superuser owner, like Neon's", () => {
  const DATABASE = "crm_test_neon_like";
  let neon: Awaited<ReturnType<typeof createNeonLikeAdmin>>;
  beforeAll(async () => {
    neon = await createNeonLikeAdmin("migrate_test_neon_owner");
  });
  afterEach(async () => {
    await query(`drop database if exists ${DATABASE} with (force)`);
    await query("alter role app_user nologin nosuperuser nobypassrls");
  });
  afterAll(async () => {
    await neon.drop();
  });

  // The owner creates the database, as Neon's does, so it owns every table the migrations create.
  async function migrateFresh() {
    await query(`create database ${DATABASE}`, [], neon.url);
    const url = new URL(neon.url);
    url.pathname = `/${DATABASE}`;
    return migrate(url.toString());
  }

  const appUser = async () =>
    (await query("select rolsuper, rolbypassrls, rolcanlogin from pg_roles where rolname = 'app_user'")).rows;

  it("cleans a pre-existing app_user that can log in and bypass RLS", async () => {
    await query("alter role app_user login bypassrls");
    expect(await migrateFresh()).toEqual(["0001_stores_and_memberships.sql", "0002_store_domain.sql", "0003_vehicle_costs.sql"]);
    expect(await appUser()).toEqual([{ rolsuper: false, rolbypassrls: false, rolcanlogin: false }]);
  });

  it("fails clearly on a pre-existing superuser app_user", async () => {
    await query("alter role app_user superuser");
    await expect(migrateFresh()).rejects.toThrow(/app_user is a superuser/);
  });
});
