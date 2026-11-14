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

type DomainIds = { vehicleId: string; leadOfSeller: string; leadOfSeller2: string; saleId: string };

// One row in every domain table of `storeId`, inserted as admin (RLS does not apply).
export async function seedDomainRows(
  storeId: string,
  people: { owner: string; seller: string; seller2: string },
): Promise<DomainIds> {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  const insert = async (table: string, row: Record<string, unknown>) => {
    const columns = ["store_id", ...Object.keys(row)];
    const values = [storeId, ...Object.values(row)];
    const sql = `insert into ${table} (${columns.join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) returning *`;
    return (await admin.query(sql, values)).rows[0] as { id: string };
  };
  try {
    const channel = await insert("channels", { name: "OLX" });
    await insert("channel_costs", { channel_id: channel.id, month: "2026-11-01", amount: 500 });
    const car = { brand: "Chevrolet", model: "Onix", version: "LT 1.0", model_year: 2022, manufacture_year: 2021 };
    const common = { ...car, km: 30000, fuel: "Flex", transmission: "Manual", price: 70000, entered_on: "2026-10-01" };
    const vehicle = await insert("vehicles", { ...common, slug: "onix-1", status: "available" });
    const sold = await insert("vehicles", { ...common, slug: "onix-2", status: "sold" });
    await insert("vehicle_finances", { vehicle_id: vehicle.id, purchase_price: 60000 });
    await insert("vehicle_photos", { vehicle_id: vehicle.id, position: 0, path: "/demo/onix.webp" });
    await insert("vehicle_expenses", { vehicle_id: vehicle.id, category: "mechanical", spent_on: "2026-10-05", amount: 800, created_by: people.owner });
    await insert("vehicle_documents", { vehicle_id: vehicle.id, item: "ipva", status: "pending" });
    const lead = (seller: string, name: string) => insert("leads", { name, phone: "558390000001", channel_id: channel.id, seller_id: seller });
    const leadOfSeller = await lead(people.seller, "Cliente do vendedor");
    const leadOfSeller2 = await lead(people.seller2, "Cliente do colega");
    await insert("lead_contacts", { lead_id: leadOfSeller.id, member_id: people.seller, kind: "whatsapp" });
    const sale = await insert("sales", {
      vehicle_id: sold.id, lead_id: leadOfSeller.id, seller_id: people.seller, seller_name: "Beto",
      sold_on: "2026-11-01", price: 70000, payment: "financing", bank: "BV", financed_amount: 40000, warranty_until: "2027-01-30",
    });
    await insert("sale_finances", { sale_id: sale.id, financing_return_pct: 0.03 });
    await insert("sale_trade_ins", { sale_id: sale.id, trade_in_value: 30000 });
    await insert("reservations", { vehicle_id: vehicle.id, lead_id: leadOfSeller2.id, deposit: 1000, expires_on: "2026-11-20", created_by: people.seller2 });
    await insert("commission_rules", { kind: "fixed", value: 350 });
    for (const member_id of new Set([null, people.seller, people.seller2])) await insert("goals", { month: "2026-11-01", member_id, cars: 4 });
    await insert("store_expenses", { month: "2026-11-01", category: "rent", amount: 6500 });
    return { vehicleId: vehicle.id, leadOfSeller: leadOfSeller.id, leadOfSeller2: leadOfSeller2.id, saleId: sale.id };
  } finally {
    await admin.end();
  }
}
