import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import { parseArgs } from "node:util";
import pg from "pg";
import { createPool } from "../db/migrate.ts";

const USAGE = "Usage: MIGRATE_DATABASE_URL=<url> node scripts/create-app-login.ts --out <file>";
const ATTRIBUTES = "login nosuperuser nobypassrls nocreatedb nocreaterole noreplication inherit";

// The server stores this verifier as given, so the plaintext never reaches the SQL text, the server log or pg_stat_activity.
// The password is base64url, hence ASCII: SASLprep would leave it unchanged.
function scramVerifier(password: string): string {
  const salt = randomBytes(16);
  const salted = pbkdf2Sync(password, salt, 4096, 32, "sha256");
  const hmac = (data: string) => createHmac("sha256", salted).update(data).digest();
  const storedKey = createHash("sha256").update(hmac("Client Key")).digest("base64");
  return `SCRAM-SHA-256$4096:${salt.toString("base64")}$${storedKey}:${hmac("Server Key").toString("base64")}`;
}

// Creates the `crm_app` login (or rotates its password) and returns its connection URL; `adminUrl` must be a superuser.
export async function createAppLogin(adminUrl: string): Promise<string> {
  const password = randomBytes(32).toString("base64url");
  const pool = createPool(adminUrl);
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query<{ group_exists: boolean; login_exists: boolean }>(
        `select exists (select from pg_roles where rolname = 'app_user') as group_exists,
                exists (select from pg_roles where rolname = 'crm_app') as login_exists`,
      );
      if (!rows[0].group_exists) throw new Error("Role app_user does not exist: run the migrations first (npm run db:migrate)");
      // create/alter role take no bind parameters, so the verifier goes in as an escaped literal
      const verb = rows[0].login_exists ? "alter" : "create";
      await client.query(`${verb} role crm_app ${ATTRIBUTES} password ${pg.escapeLiteral(scramVerifier(password))}`);
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
