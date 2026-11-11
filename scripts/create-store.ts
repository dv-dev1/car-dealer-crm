import { parseArgs } from "node:util";
import { createPool } from "../db/migrate.ts";
import { normalizeEmail } from "../src/shared/email.ts";

type StoreInput = { name: string; slug: string; ownerName: string; ownerEmail: string };

const USAGE = "Usage: MIGRATE_DATABASE_URL=<url> node scripts/create-store.ts --name <n> --slug <s> --owner-name <n> --owner-email <e>";

// Creates a store and its owner in one transaction; `adminUrl` must be a role that bypasses RLS.
export async function createStore(adminUrl: string, input: StoreInput): Promise<{ storeId: string }> {
  const ownerEmail = normalizeEmail(input.ownerEmail);
  if (!ownerEmail) throw new Error(`Invalid owner e-mail: "${input.ownerEmail}"`);
  const pool = createPool(adminUrl);
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows } = await client.query<{ id: string }>(
        "insert into stores (name, slug) values ($1, $2) returning id",
        [input.name, input.slug],
      );
      await client.query("insert into memberships (store_id, email, name, role) values ($1, $2, $3, 'owner')", [
        rows[0].id,
        ownerEmail,
        input.ownerName,
      ]);
      await client.query("commit");
      return { storeId: rows[0].id };
    } catch (error) {
      await client.query("rollback").catch(() => {}); // a dead connection must not hide the real error
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({
      options: { name: { type: "string" }, slug: { type: "string" }, "owner-name": { type: "string" }, "owner-email": { type: "string" } },
    });
    const adminUrl = process.env.MIGRATE_DATABASE_URL;
    if (!adminUrl || !values.name || !values.slug || !values["owner-name"] || !values["owner-email"]) {
      console.error(USAGE);
      process.exit(1);
    }
    const { storeId } = await createStore(adminUrl, {
      name: values.name,
      slug: values.slug,
      ownerName: values["owner-name"],
      ownerEmail: values["owner-email"],
    });
    console.log(storeId);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
