import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createAppLogin } from "../../scripts/create-app-login.ts";
import { createStore } from "../../scripts/create-store.ts";
import { TEST_ADMIN_URL, TEST_APP_PASSWORD } from "../setup/urls.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const dirs: string[] = [];

async function query(sql: string, params: unknown[] = [], url = TEST_ADMIN_URL) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

async function counts() {
  const { rows } = await query(
    "select (select count(*) from stores)::int as stores, (select count(*) from memberships)::int as memberships",
  );
  return rows[0];
}

const owner = { name: "Loja Ops", ownerName: "Ana", ownerEmail: "ana@lojaops.com" };

const CLEAN_ROLE = {
  rolcanlogin: true,
  rolsuper: false,
  rolbypassrls: false,
  rolcreatedb: false,
  rolcreaterole: false,
  member: true,
};

async function roleState() {
  const { rows } = await query(
    `select rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole,
            pg_has_role('crm_app', 'app_user', 'member') as member
       from pg_roles where rolname = 'crm_app'`,
  );
  return rows[0];
}

function run(script: string, args: string[]) {
  return spawnSync(process.execPath, [join(ROOT, "scripts", script), ...args], {
    encoding: "utf8",
    env: { ...process.env, MIGRATE_DATABASE_URL: TEST_ADMIN_URL },
  });
}

function tempFile() {
  const dir = mkdtempSync(join(tmpdir(), "ops-test-"));
  dirs.push(dir);
  return join(dir, "app.json");
}

const fileMode = (file: string) => statSync(file).mode & 0o777;
const urlInside = (file: string) => (JSON.parse(readFileSync(file, "utf8")) as { url: string }).url;

// Leave the shared database as the other test files expect: no stores of ours, crm_app as globalSetup made it.
afterAll(async () => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  await query("delete from stores where slug like 'ops-test-%'");
  const exists = (await query("select 1 from pg_roles where rolname = 'crm_app'")).rowCount;
  const password = `'${TEST_APP_PASSWORD}'`;
  await query(`${exists ? "alter" : "create"} role crm_app login nosuperuser nobypassrls password ${password}`);
  await query("grant app_user to crm_app");
});

describe("createStore", () => {
  it("creates a store with its owner and normalizes the e-mail", async () => {
    const { storeId } = await createStore(TEST_ADMIN_URL, {
      ...owner,
      slug: "ops-test-one",
      ownerEmail: "  Ana@LojaOps.COM ",
    });
    const stores = await query("select name, slug from stores where id = $1", [storeId]);
    expect(stores.rows).toEqual([{ name: "Loja Ops", slug: "ops-test-one" }]);
    const members = await query("select email, name, role, workos_user_id from memberships where store_id = $1", [storeId]);
    expect(members.rows).toEqual([{ email: "ana@lojaops.com", name: "Ana", role: "owner", workos_user_id: null }]);
  });

  it("fails on a duplicate slug and creates nothing", async () => {
    await createStore(TEST_ADMIN_URL, { ...owner, slug: "ops-test-dup" });
    const before = await counts();
    await expect(
      createStore(TEST_ADMIN_URL, { ...owner, slug: "ops-test-dup", ownerEmail: "other@lojaops.com" }),
    ).rejects.toThrow(/stores_slug_key/);
    expect(await counts()).toEqual(before);
  });

  it("rolls back the store when the owner cannot be created", async () => {
    const before = await counts();
    await expect(createStore(TEST_ADMIN_URL, { ...owner, slug: "ops-test-half", ownerName: "  " })).rejects.toThrow(
      /memberships_name_check/,
    );
    expect(await counts()).toEqual(before);
  });

  it("rejects an owner e-mail that is not an e-mail", async () => {
    const before = await counts();
    await expect(createStore(TEST_ADMIN_URL, { ...owner, slug: "ops-test-mail", ownerEmail: "ana" })).rejects.toThrow(
      /e-mail/,
    );
    expect(await counts()).toEqual(before);
  });

  it("rejects a slug outside a-z, 0-9 and hyphen", async () => {
    const before = await counts();
    await expect(createStore(TEST_ADMIN_URL, { ...owner, slug: "Ops Test" })).rejects.toThrow(/stores_slug_check/);
    expect(await counts()).toEqual(before);
  });
});

describe("createAppLogin", () => {
  it("creates a login that connects and cannot bypass RLS", async () => {
    await createStore(TEST_ADMIN_URL, { ...owner, slug: "ops-test-rls" }); // a row the login must not see
    await query("drop role crm_app");
    const url = await createAppLogin(TEST_ADMIN_URL);
    expect(await roleState()).toEqual(CLEAN_ROLE);
    const me = await query("select rolbypassrls from pg_roles where rolname = current_user", [], url);
    expect(me.rows).toEqual([{ rolbypassrls: false }]);
    expect((await query("select * from memberships", [], url)).rows).toEqual([]);
  });

  it("returns the admin URL with the login and a 32-byte URL-safe password", async () => {
    const url = new URL(await createAppLogin(TEST_ADMIN_URL));
    const admin = new URL(TEST_ADMIN_URL);
    expect([url.username, url.host, url.pathname]).toEqual(["crm_app", admin.host, admin.pathname]);
    expect(url.password).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("rotates the password when the login exists", async () => {
    const verifier = async () => (await query("select rolpassword from pg_authid where rolname = 'crm_app'")).rows[0];
    const first = await createAppLogin(TEST_ADMIN_URL);
    const before = await verifier();
    const second = await createAppLogin(TEST_ADMIN_URL);
    expect(new URL(second).password).not.toBe(new URL(first).password);
    expect((await query("select 1 as ok", [], second)).rows).toEqual([{ ok: 1 }]);
    expect(await verifier()).not.toEqual(before); // trust auth never checks the old password, so compare the stored verifier
  });

  it("restores the attributes and the membership when it rotates", async () => {
    await createAppLogin(TEST_ADMIN_URL);
    await query("alter role crm_app nologin superuser bypassrls createdb createrole");
    await query("revoke app_user from crm_app");
    await createAppLogin(TEST_ADMIN_URL);
    expect(await roleState()).toEqual(CLEAN_ROLE);
  });

  it("fails clearly when app_user does not exist", async () => {
    await query("alter role app_user rename to app_user_off");
    try {
      await expect(createAppLogin(TEST_ADMIN_URL)).rejects.toThrow(/run the migrations first/);
    } finally {
      await query("alter role app_user_off rename to app_user");
    }
  });
});

describe("create-app-login CLI", () => {
  it("writes the URL to a file only the owner can read, also when the file exists", async () => {
    const out = tempFile();
    expect(run("create-app-login.ts", ["--out", out]).status).toBe(0);
    expect(fileMode(out)).toBe(0o600);
    expect((await query("select 1 as ok", [], urlInside(out))).rows).toEqual([{ ok: 1 }]);

    chmodSync(out, 0o644);
    expect(run("create-app-login.ts", ["--out", out]).status).toBe(0);
    expect(fileMode(out)).toBe(0o600);
    expect((await query("select 1 as ok", [], urlInside(out))).rows).toEqual([{ ok: 1 }]);
  });

  it("prints a confirmation naming the file and never the URL or the password", () => {
    const out = tempFile();
    const result = run("create-app-login.ts", ["--out", out]);
    const url = urlInside(out);
    expect(result.stdout).toContain(out);
    for (const text of [result.stdout, result.stderr]) {
      expect(text).not.toContain(url);
      expect(text).not.toContain(new URL(url).password);
    }
  });

  it("requires --out", () => {
    const result = run("create-app-login.ts", []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage");
  });
});

describe("create-store CLI", () => {
  const args = ["--name", "Loja Ops", "--slug", "ops-test-cli", "--owner-name", "Ana", "--owner-email", "ana@lojaops.com"];

  it("prints the new store id", async () => {
    const result = run("create-store.ts", args);
    expect(result.status).toBe(0);
    const id = result.stdout.trim();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await query("select slug from stores where id = $1", [id])).rows).toEqual([{ slug: "ops-test-cli" }]);
  });

  it("prints usage and exits 1 when an argument is missing", () => {
    const result = run("create-store.ts", args.slice(0, -2));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage");
  });
});
