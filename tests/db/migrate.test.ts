import pg from "pg";
import { afterAll, expect, it } from "vitest";
import { migrate } from "../../db/migrate.ts";
import { TEST_ADMIN_URL } from "../setup/urls.ts";

async function query(sql: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: TEST_ADMIN_URL });
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
