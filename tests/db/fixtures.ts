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

// Neon's database owner is not a superuser; these are the attributes it has there.
export async function createNeonLikeAdmin(name: string): Promise<{ url: string; drop(): Promise<void> }> {
  const run = async (sql: string) => {
    const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
    await admin.connect();
    try {
      await admin.query(sql);
    } finally {
      await admin.end();
    }
  };
  await run(`create role ${name} login createrole createdb bypassrls replication`);
  // On Neon the owner creates app_user and so holds ADMIN OPTION on it; here the superuser created it.
  await run(`grant app_user to ${name} with admin option`);
  const url = new URL(TEST_ADMIN_URL);
  url.username = name;
  // DROP OWNED also revokes the memberships this role granted, which would otherwise block DROP ROLE.
  const drop = async () => {
    await run(`drop owned by ${name}`);
    await run(`drop role ${name}`);
  };
  return { url: url.toString(), drop };
}
