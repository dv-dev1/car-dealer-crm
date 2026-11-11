import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import { parseArgs } from "node:util";
import pg from "pg";
import { createPool } from "../db/migrate.ts";

const USAGE = "Usage: MIGRATE_DATABASE_URL=<url> node scripts/create-app-login.ts --out <file>";
// No NOSUPERUSER here: in ALTER ROLE it needs a superuser even as a no-op, and Neon's owner is not one.
const ATTRIBUTES = "login nobypassrls nocreatedb nocreaterole noreplication inherit";

// The server stores this verifier as given, so the plaintext never reaches the SQL text, the server log or pg_stat_activity.
// The password is base64url, hence ASCII: SASLprep would leave it unchanged.
function scramVerifier(password: string): string {
  const salt = randomBytes(16);
  const salted = pbkdf2Sync(password, salt, 4096, 32, "sha256");
  const hmac = (data: string) => createHmac("sha256", salted).update(data).digest();
  const storedKey = createHash("sha256").update(hmac("Client Key")).digest("base64");
  return `SCRAM-SHA-256$4096:${salt.toString("base64")}$${storedKey}:${hmac("Server Key").toString("base64")}`;
}

// Proves the new password logs in, as the app would, and that the login sees no row without a store.
async function checkAppLogin(appUrl: string): Promise<void> {
  const pool = createPool(appUrl);
  let me: { login: string; rolsuper: boolean; rolbypassrls: boolean; visible: number };
  try {
    const { rows } = await pool.query<typeof me>(
      `select current_user as login, rolsuper, rolbypassrls, (select count(*) from memberships)::int as visible
         from pg_roles where rolname = current_user`,
    );
    me = rows[0];
  } catch (error) {
    // pg names the user and the host in its messages, never the password
    throw new Error(`The new crm_app login failed its check: ${(error as Error).message}`);
  } finally {
    await pool.end();
  }
  if (me.login !== "crm_app" || me.rolsuper || me.rolbypassrls || me.visible !== 0) {
    const expected = "crm_app, no SUPERUSER, no BYPASSRLS, 0 rows visible without a store";
    throw new Error(`The new crm_app login failed its check: expected ${expected}, got ${JSON.stringify(me)}`);
  }
}

// Creates the `crm_app` login (or rotates its password) and returns its connection URL.
// `adminUrl` needs CREATEROLE with ADMIN OPTION on app_user and crm_app, as Neon's owner has; not a superuser.
export async function createAppLogin(adminUrl: string): Promise<string> {
  const password = randomBytes(32).toString("base64url");
  const pool = createPool(adminUrl);
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query<{ group_exists: boolean; login_super: boolean | null }>(
        `select exists (select from pg_roles where rolname = 'app_user') as group_exists,
                (select rolsuper from pg_roles where rolname = 'crm_app') as login_super`,
      );
      const [{ group_exists, login_super }] = rows;
      if (!group_exists) throw new Error("Role app_user does not exist: run the migrations first (npm run db:migrate)");
      // Only a superuser may alter a superuser role, so this one is fixed by hand.
      if (login_super) throw new Error('Role crm_app is a superuser: a superuser must run "alter role crm_app nosuperuser" first');
      // create/alter role take no bind parameters, so the verifier goes in as an escaped literal
      const role = login_super === null ? "create role crm_app nosuperuser" : "alter role crm_app";
      await client.query(`${role} ${ATTRIBUTES} password ${pg.escapeLiteral(scramVerifier(password))}`);
      await client.query("grant app_user to crm_app");
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => {}); // a dead connection must not hide the real error
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
  const url = new URL(adminUrl);
  url.username = "crm_app";
  url.password = password;
  await checkAppLogin(url.toString());
  return url.toString();
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ options: { out: { type: "string" } } });
    const adminUrl = process.env.MIGRATE_DATABASE_URL;
    if (!adminUrl || !values.out) {
      console.error(USAGE);
      process.exit(1);
    }
    // Opened before touching the database so a bad path fails first; 0600 is set before any secret is written.
    const existed = existsSync(values.out);
    const file = await open(values.out, "a", 0o600);
    try {
      await file.chmod(0o600);
      const url = await createAppLogin(adminUrl);
      await file.truncate(0);
      await file.writeFile(JSON.stringify({ url }));
    } catch (error) {
      if (!existed) await rm(values.out, { force: true }); // do not leave an empty file that looks like a result
      throw error;
    } finally {
      await file.close();
    }
    console.log(`App login URL written to ${values.out}`);
  } catch (error) {
    console.error((error as Error).message); // message only: never the stack or the properties of the error
    process.exit(1);
  }
}
