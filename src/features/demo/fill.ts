import type { Db } from "../../shared/db/client.ts";
import { DEMO_STAFF, DEMO_TABLES, buildDemoData, type DemoData, type StaffKey } from "./seed.ts";

const COLUMN = /^[a-z_]+$/;

// One insert per table, in DEMO_TABLES order; the rows travel as one JSON parameter.
export async function writeDemoData(db: Db, storeId: string, data: DemoData): Promise<void> {
  for (const table of DEMO_TABLES) {
    const rows = data[table];
    if (rows.length === 0) continue;
    const columns = ["store_id", ...Object.keys(rows[0])];
    const bad = columns.find((column) => !COLUMN.test(column));
    if (bad) throw new Error(`writeDemoData: bad column "${bad}" in ${table}`);
    const list = columns.join(", ");
    await db.query(`insert into ${table} (${list}) select ${list} from json_populate_recordset(null::${table}, $1::json)`, [
      JSON.stringify(rows.map((row) => ({ ...row, store_id: storeId }))),
    ]);
  }
}

// Wipes the demo (reset_demo_store checks owner and demo flag) and writes a fresh one dated `today`.
export async function fillDemoStore(db: Db, storeId: string, today: string): Promise<void> {
  await db.query("select reset_demo_store()");
  const inserted = await db.query<{ id: string; email: string }>(
    `insert into memberships (store_id, email, name, role)
       select $1, x.email, x.name, x.role from json_to_recordset($2::json) as x(email text, name text, role text)
       returning id, email`,
    [storeId, JSON.stringify(DEMO_STAFF.map(({ email, name, role }) => ({ email, name, role })))],
  );
  const idOf = new Map(inserted.map((row) => [row.email, row.id]));
  const staff = Object.fromEntries(DEMO_STAFF.map((member) => [member.key, idOf.get(member.email)!])) as Record<StaffKey, string>;
  await writeDemoData(db, storeId, buildDemoData({ today, staff, newId: () => crypto.randomUUID() }));
}
