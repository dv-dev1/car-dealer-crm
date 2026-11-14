import { parseArgs } from "node:util";
import type pg from "pg";
import { createPool } from "../db/migrate.ts";
import { fillDemoStore } from "../src/features/demo/fill.ts";
import { DEMO_STORE } from "../src/features/demo/seed.ts";
import { normalizeEmail } from "../src/shared/email.ts";
import { todayIso } from "../src/shared/today.ts";

type DemoStoreInput = { slug: string; ownerName: string; ownerEmail: string };

const USAGE = `Usage: MIGRATE_DATABASE_URL=<url> node scripts/demo-store.ts --slug <s> --owner-name <n> --owner-email <e>
       MIGRATE_DATABASE_URL=<url> node scripts/demo-store.ts --store-id <uuid>`;

// Runs `fn` in one transaction acting as the store's owner, so reset_demo_store and the RLS checks pass.
async function asOwner<T>(adminUrl: string, fn: (client: pg.PoolClient) => Promise<{ storeId: string; ownerId: string | null; result: T }>) {
  const pool = createPool(adminUrl);
  try {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const { storeId, ownerId, result } = await fn(client);
      await client.query("select set_config('app.store_id', $1, true), set_config('app.role', 'owner', true), set_config('app.membership_id', $2, true)", [
        storeId,
        ownerId ?? "",
      ]);
      await fillDemoStore({ query: async (text, values) => (await client.query(text, values)).rows }, storeId, todayIso());
      await client.query("commit");
      return result;
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

// A new demo store (the Maré) with its owner; `adminUrl` must be a role that bypasses RLS.
export async function createDemoStore(adminUrl: string, input: DemoStoreInput): Promise<{ storeId: string }> {
  const ownerEmail = normalizeEmail(input.ownerEmail);
  if (!ownerEmail) throw new Error(`Invalid owner e-mail: "${input.ownerEmail}"`);
  return asOwner(adminUrl, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      "insert into stores (name, slug, city, whatsapp, is_demo) values ($1, $2, $3, $4, true) returning id",
      [DEMO_STORE.name, input.slug, DEMO_STORE.city, DEMO_STORE.whatsapp],
    );
    const owner = await client.query<{ id: string }>(
      "insert into memberships (store_id, email, name, role) values ($1, $2, $3, 'owner') returning id",
      [rows[0].id, ownerEmail, input.ownerName],
    );
    return { storeId: rows[0].id, ownerId: owner.rows[0].id, result: { storeId: rows[0].id } };
  });
}

// Turns an existing store into the Maré: real members stay, its data is replaced by the demo's.
// A store that is not a demo yet and already has cars, clients or sales is refused: a mistyped id must not wipe a client.
export async function convertToDemoStore(adminUrl: string, storeId: string): Promise<void> {
  await asOwner(adminUrl, async (client) => {
    const { rows: [found] } = await client.query<{ is_demo: boolean; has_data: boolean }>(
      `select is_demo, exists (select from vehicles where store_id = $1) or exists (select from leads where store_id = $1)
              or exists (select from sales where store_id = $1) as has_data
         from stores where id = $1 for update`,
      [storeId],
    );
    if (found && !found.is_demo && found.has_data) {
      throw new Error(`Store ${storeId} already has data and is not a demo store: refusing to replace it`);
    }
    const { rows } = await client.query<{ id: string; owner_id: string | null }>(
      `update stores set is_demo = true, name = $2, city = $3, whatsapp = $4 where id = $1
       returning id, (select m.id from memberships m where m.store_id = $1 and m.role = 'owner' limit 1) as owner_id`,
      [storeId, DEMO_STORE.name, DEMO_STORE.city, DEMO_STORE.whatsapp],
    );
    if (rows.length === 0) throw new Error(`No store with id ${storeId}`);
    return { storeId, ownerId: rows[0].owner_id, result: undefined };
  });
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({
      options: {
        slug: { type: "string" },
        "owner-name": { type: "string" },
        "owner-email": { type: "string" },
        "store-id": { type: "string" },
      },
    });
    const adminUrl = process.env.MIGRATE_DATABASE_URL;
    if (adminUrl && values["store-id"]) {
      await convertToDemoStore(adminUrl, values["store-id"]);
      console.log(values["store-id"]);
    } else if (adminUrl && values.slug && values["owner-name"] && values["owner-email"]) {
      const { storeId } = await createDemoStore(adminUrl, {
        slug: values.slug,
        ownerName: values["owner-name"],
        ownerEmail: values["owner-email"],
      });
      console.log(storeId);
    } else {
      console.error(USAGE);
      process.exit(1);
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
