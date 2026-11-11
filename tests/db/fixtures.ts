import pg from "pg";
import { TEST_ADMIN_URL } from "../setup/urls.ts";

type Person = { id: string; email: string };

// Resets the shared database to store A (Ana owner, Beto seller) and store B (Carla owner).
export async function seedTwoStores(): Promise<{
  a: { storeId: string; ana: Person; beto: Person };
  b: { storeId: string; carla: Person };
}> {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    await admin.query("truncate stores cascade");
    const store = async (name: string, slug: string) => {
      const sql = "insert into stores (name, slug) values ($1, $2) returning id";
      return (await admin.query<{ id: string }>(sql, [name, slug])).rows[0].id;
    };
    const member = async (storeId: string, name: string, email: string, role: string) => {
      const sql = "insert into memberships (store_id, name, email, role) values ($1, $2, $3, $4) returning id";
      const { rows } = await admin.query<{ id: string }>(sql, [storeId, name, email, role]);
      return { id: rows[0].id, email };
    };
    const a = await store("Loja A", "loja-a");
    const b = await store("Loja B", "loja-b");
    return {
      a: {
        storeId: a,
        ana: await member(a, "Ana", "ana@lojaa.com", "owner"),
        beto: await member(a, "Beto", "beto@lojaa.com", "seller"),
      },
      b: { storeId: b, carla: await member(b, "Carla", "carla@lojab.com", "owner") },
    };
  } finally {
    await admin.end();
  }
}
