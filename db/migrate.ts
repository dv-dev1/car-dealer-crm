import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool as NeonPool } from "@neondatabase/serverless";
import pg from "pg";

const DEFAULT_DIR = fileURLToPath(new URL("./migrations", import.meta.url));

// Port 5432 is blocked on some networks; Neon is reached through its WebSocket driver on 443.
function createPool(databaseUrl: string): pg.Pool {
  const isNeon = new URL(databaseUrl).hostname.endsWith(".neon.tech");
  const Pool = isNeon ? (NeonPool as unknown as typeof pg.Pool) : pg.Pool;
  return new Pool({ connectionString: databaseUrl });
}

// Applies the pending .sql files of `dir` in name order, each in its own transaction.
export async function migrate(databaseUrl: string, dir = DEFAULT_DIR): Promise<string[]> {
  const files = (await readdir(resolve(dir))).filter((name) => name.endsWith(".sql")).sort();
  const pool = createPool(databaseUrl);
  const applied: string[] = [];
  try {
    await pool.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const { rows } = await pool.query<{ name: string }>("select name from schema_migrations");
    const done = new Set(rows.map((row) => row.name));
    for (const name of files.filter((file) => !done.has(file))) {
      const sql = await readFile(join(resolve(dir), name), "utf8");
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [name]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback").catch(() => {}); // a dead connection must not hide the real error
        throw error;
      } finally {
        client.release();
      }
      applied.push(name);
    }
  } finally {
    await pool.end();
  }
  return applied;
}

if (import.meta.main) {
  const url = process.env.MIGRATE_DATABASE_URL;
  if (!url) throw new Error("MIGRATE_DATABASE_URL is not set");
  const applied = await migrate(url);
  console.log(applied.length ? `applied: ${applied.join(", ")}` : "nothing to apply");
}
