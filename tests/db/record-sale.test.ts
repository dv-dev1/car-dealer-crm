import pg from "pg";
import { afterAll, beforeEach, expect, it } from "vitest";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";
import { seedDomainRows, seedTwoStores } from "./fixtures.ts";

const app = new pg.Pool({ connectionString: TEST_APP_URL, max: 1 });
afterAll(() => app.end());

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return await admin.query(sql, params);
  } finally {
    await admin.end();
  }
}

type Who = { storeId: string; role: string; membershipId: string };

async function asApp<T>(who: Who, fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const db = await app.connect();
  try {
    await db.query("begin");
    await db.query(
      "select set_config('app.store_id', $1, true), set_config('app.role', $2, true), set_config('app.membership_id', $3, true)",
      [who.storeId, who.role, who.membershipId],
    );
    const result = await fn(db);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

type Sale = {
  vehicle: string; lead?: string | null; seller?: string | null; price?: number; payment?: string;
  bank?: string | null; financed?: number | null; soldOn?: string; returnPct?: number | null;
};

const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const TOMORROW = new Date(Date.parse(`${TODAY}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

function sell(who: Who, s: Sale) {
  return asApp(who, async (db) => {
    const { rows } = await db.query(
      "select record_sale($1, $2, $3, $4, $5, $6, $7, $8, $9, null) as id",
      [s.vehicle, s.lead ?? null, s.seller ?? null, s.price ?? 68000, s.payment ?? "cash", s.bank ?? null, s.financed ?? null, s.soldOn ?? TODAY,
       s.returnPct ?? null],
    );
    return rows[0].id as string;
  });
}

const refused = (message: string) => ({ code: "P0001", message });

let a: { storeId: string; owner: string; seller: string; seller2: string; manager: string };
let rows: Awaited<ReturnType<typeof seedDomainRows>>;
let rowsB: Awaited<ReturnType<typeof seedDomainRows>>;
const owner = (): Who => ({ storeId: a.storeId, role: "owner", membershipId: a.owner });
const manager = (): Who => ({ storeId: a.storeId, role: "manager", membershipId: a.manager });
const seller = (): Who => ({ storeId: a.storeId, role: "seller", membershipId: a.seller });

beforeEach(async () => {
  const seed = await seedTwoStores();
  const member = async (name: string, email: string, role: string) =>
    (await adminQuery("insert into memberships (store_id, name, email, role) values ($1, $2, $3, $4) returning id", [
      seed.a.storeId, name, email, role,
    ])).rows[0].id as string;
  a = {
    storeId: seed.a.storeId,
    owner: seed.a.ana.id,
    seller: seed.a.beto.id,
    seller2: await member("Dani", "dani@lojaa.com", "seller"),
    manager: await member("Mara", "mara@lojaa.com", "manager"),
  };
  rows = await seedDomainRows(a.storeId, { owner: a.owner, seller: a.seller, seller2: a.seller2 });
  rowsB = await seedDomainRows(seed.b.storeId, { owner: seed.b.carla.id, seller: seed.b.carla.id, seller2: seed.b.carla.id });
  // The fixture's reservation holds the car for seller2's lead; these tests are about the sale, not the reservation.
  await adminQuery("update reservations set canceled_at = now()");
});

it("refuses the financing return from a seller, also when called directly", async () => {
  const financed = { vehicle: rows.vehicleId, lead: rows.leadOfSeller, payment: "financing", bank: "BV", financed: 40000, returnPct: 0.02 };
  await expect(sell(seller(), financed)).rejects.toMatchObject(refused("forbidden"));
  await expect(sell(manager(), financed)).resolves.toEqual(expect.any(String));
});

it("refuses a car reserved for another client, also when called directly", async () => {
  await adminQuery("update reservations set canceled_at = null, expires_on = '2099-01-01' where vehicle_id = $1", [rows.vehicleId]);
  await expect(sell(seller(), { vehicle: rows.vehicleId, lead: rows.leadOfSeller })).rejects.toMatchObject(refused("reserved"));
});

it("a seller sells their own lead's car", async () => {
  const id = await sell(seller(), { vehicle: rows.vehicleId, lead: rows.leadOfSeller, payment: "financing", bank: "BV", financed: 40000 });
  const [sale] = (await adminQuery(
    "select seller_id, seller_name, payment, financed_amount::int, warranty_until - sold_on as days from sales where id = $1", [id],
  )).rows;
  expect(sale).toEqual({ seller_id: a.seller, seller_name: "Beto", payment: "financing", financed_amount: 40000, days: 90 });
  const [car] = (await adminQuery("select status from vehicles where id = $1", [rows.vehicleId])).rows;
  expect(car.status).toBe("sold");
  const [lead] = (await adminQuery("select stage, closed_at is not null as closed, vehicle_id from leads where id = $1", [rows.leadOfSeller])).rows;
  expect(lead).toEqual({ stage: "won", closed: true, vehicle_id: rows.vehicleId });
});

it("refuses a seller selling a colleague's lead or naming another seller", async () => {
  await expect(sell(seller(), { vehicle: rows.vehicleId, lead: rows.leadOfSeller2 })).rejects.toMatchObject(refused("forbidden"));
  await expect(sell(seller(), { vehicle: rows.vehicleId, seller: a.seller2 })).rejects.toMatchObject(refused("forbidden"));
  expect((await adminQuery("select status from vehicles where id = $1", [rows.vehicleId])).rows[0].status).toBe("available");
});

it("refuses a seller recording a sale without their own lead", async () => {
  await expect(sell(seller(), { vehicle: rows.vehicleId })).rejects.toMatchObject(refused("forbidden"));
  expect((await adminQuery("select status from vehicles where id = $1", [rows.vehicleId])).rows[0].status).toBe("available");
});

it("a manager names the seller, or it comes from the lead", async () => {
  const named = await sell(manager(), { vehicle: rows.vehicleId, seller: a.seller2 });
  expect((await adminQuery("select seller_id, seller_name from sales where id = $1", [named])).rows[0]).toEqual({ seller_id: a.seller2, seller_name: "Dani" });
  await adminQuery("delete from sales where id = $1", [named]);
  await adminQuery("update vehicles set status = 'available' where id = $1", [rows.vehicleId]);
  const fromLead = await sell(owner(), { vehicle: rows.vehicleId, lead: rows.leadOfSeller2 });
  expect((await adminQuery("select seller_id from sales where id = $1", [fromLead])).rows[0].seller_id).toBe(a.seller2);
});

it("refuses to sell a car twice", async () => {
  await sell(owner(), { vehicle: rows.vehicleId });
  await expect(sell(manager(), { vehicle: rows.vehicleId })).rejects.toMatchObject(refused("not_available"));
  expect((await adminQuery("select count(*)::int as n from sales where vehicle_id = $1", [rows.vehicleId])).rows[0].n).toBe(1);
});

it("refuses a closed lead, another store's car or lead", async () => {
  await adminQuery("update leads set stage = 'lost', closed_at = now() where id = $1", [rows.leadOfSeller]);
  await expect(sell(owner(), { vehicle: rows.vehicleId, lead: rows.leadOfSeller })).rejects.toMatchObject(refused("lead_closed"));
  await expect(sell(owner(), { vehicle: rowsB.vehicleId })).rejects.toMatchObject(refused("not_found"));
  await expect(sell(owner(), { vehicle: rows.vehicleId, lead: rowsB.leadOfSeller })).rejects.toMatchObject(refused("not_found"));
});

it("checks payment, financing and date", async () => {
  const bad: Sale[] = [
    { vehicle: rows.vehicleId, payment: "financing", financed: null },
    { vehicle: rows.vehicleId, payment: "financing", financed: 90000, price: 68000 },
    { vehicle: rows.vehicleId, payment: "cash", bank: "BV" },
    { vehicle: rows.vehicleId, soldOn: TOMORROW },
    { vehicle: rows.vehicleId, price: 0 },
    { vehicle: rows.vehicleId, payment: "pix" },
  ];
  for (const s of bad) await expect(sell(owner(), s), JSON.stringify(s)).rejects.toMatchObject(refused("invalid"));
});

it("the app role cannot insert a sale directly as a seller", async () => {
  await expect(asApp(seller(), (db) => db.query(
    `insert into sales (store_id, vehicle_id, seller_id, seller_name, sold_on, price, payment, warranty_until)
     values ($1, $2, $3, 'Beto', current_date, 68000, 'cash', current_date + 90)`,
    [a.storeId, rows.vehicleId, a.seller],
  ))).rejects.toMatchObject({ code: "42501" });
});
