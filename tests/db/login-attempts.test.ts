import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { useLoginAttempt, withoutStore } from "@/shared/db/client";
import { seedTwoStores } from "./fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

const attempt = (email: string) => useLoginAttempt(email, 10, 15);

beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  await seedTwoStores();
  await adminQuery("truncate login_attempts");
});

it("lets 10 code attempts through per e-mail in the window, wherever they come from, and counts each e-mail apart", async () => {
  for (let i = 1; i <= 10; i++) expect(await attempt("ana@lojaa.com"), `attempt ${i}`).toBe(true);
  expect(await attempt("ana@lojaa.com")).toBe(false);
  expect(await attempt("ana@lojaa.com")).toBe(false);
  expect(await attempt("beto@lojaa.com")).toBe(true);
});

it("starts over when the window has passed", async () => {
  for (let i = 0; i < 11; i++) await attempt("ana@lojaa.com");
  expect(await attempt("ana@lojaa.com")).toBe(false);
  await adminQuery("update login_attempts set window_start = now() - interval '16 minutes'");
  expect(await attempt("ana@lojaa.com")).toBe(true);
  expect(await adminQuery("select attempts from login_attempts")).toEqual([{ attempts: 1 }]);
});

it("20 attempts at the same instant let 10 through", async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => attempt("ana@lojaa.com")));
  expect(results.filter(Boolean)).toHaveLength(10);
});

it("keeps no e-mail in the table, drops the windows that ended long ago and gives the app no row to read", async () => {
  await attempt("velho@exemplo.invalid");
  await adminQuery("update login_attempts set window_start = now() - interval '2 days'");
  await attempt("ana@lojaa.com");
  const rows = await adminQuery("select * from login_attempts");
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain("ana@");
  await expect(withoutStore((db) => db.query("select count(*) from login_attempts"))).rejects.toThrow(/permission denied/);
  expect(await useLoginAttempt("ana@lojaa.com", 0, 15)).toBe(false);
});
