import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { withoutStore } from "@/shared/db/client";
import { seedTwoStores } from "./fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const TODAY = "2026-11-13";

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

async function car(storeId: string, slug: string, over: Record<string, unknown> = {}): Promise<string> {
  const row = {
    store_id: storeId, slug, brand: "Fiat", model: "Argo", version: "Drive 1.0", model_year: 2023, manufacture_year: 2022, km: 30000,
    fuel: "Flex", transmission: "Manual", price: 68900, min_cash_price: 66000, plate: "ABC1D23", status: "available", entered_on: "2026-10-01", ...over,
  };
  const keys = Object.keys(row);
  const [{ id }] = await adminQuery(`insert into vehicles (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(row));
  return id;
}

/** The anonymous path of the app: `crm_app` with no store in the session. */
const site = <T>(sql: string, params: unknown[] = []) => withoutStore((db) => db.query<T>(sql, params));
const slugs = async (store: string) => (await site<{ slug: string }>("select slug from site_vehicles($1, $2)", [store, TODAY])).map((row) => row.slug);
const interest = async (store: string, vehicle: string, name = "Joana Lima", phone = "5583991112222") =>
  (await site<{ ok: boolean }>("select create_site_lead($1, $2, $3, $4) as ok", [store, vehicle, name, phone]))[0].ok;
const leads = (storeId: string) =>
  adminQuery(
    `select l.name, l.phone, l.stage, l.seller_id, l.interest, v.slug as vehicle, c.name as channel
       from leads l left join vehicles v on v.id = l.vehicle_id left join channels c on c.id = l.channel_id where l.store_id = $1 order by l.created_at`,
    [storeId],
  );

let a: string;
let b: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  a = seed.a.storeId;
  b = seed.b.storeId;
});

it("a visitor reads no table, only the cars for sale through the function", async () => {
  await car(a, "argo-a");
  await car(a, "em-preparo", { status: "preparing" });
  await car(a, "na-oficina", { status: "away", away_reason: "repair" });
  await car(a, "vendido", { status: "sold" });
  await car(a, "removido", { status: "removed", removed_reason: "wrong_entry" });
  await car(b, "argo-b");

  for (const table of ["vehicles", "stores", "leads", "reservations", "vehicle_photos", "channels"]) {
    expect(await site<{ n: number }>(`select count(*)::int as n from ${table}`), table).toEqual([{ n: 0 }]);
  }
  expect(await slugs("loja-a")).toEqual(["argo-a"]);
  expect(await slugs("loja-b")).toEqual(["argo-b"]);
  expect(await slugs("nao-existe")).toEqual([]);
});

it("answers the public sheet and nothing else: no cost, no cash minimum, no plate", async () => {
  const id = await car(a, "argo-a", { color: "Prata", doors: 4, features: ["Ar condicionado"], description: "Único dono.", featured: true });
  await adminQuery("insert into vehicle_photos (store_id, vehicle_id, position, path) values ($1, $2, 1, 'b.webp'), ($1, $2, 0, 'a.webp')", [a, id]);
  const [row] = await site<Record<string, unknown>>("select * from site_vehicles($1, $2)", ["loja-a", TODAY]);
  expect(Object.keys(row).sort()).toEqual(
    ["body_type", "brand", "color", "description", "doors", "engine", "featured", "features", "fuel", "id", "km", "model", "model_year", "photos", "power", "price", "reserved", "slug", "transmission", "version"],
  );
  expect(row).toMatchObject({ slug: "argo-a", brand: "Fiat", price: "68900.00", featured: true, reserved: false, photos: ["a.webp", "b.webp"], features: ["Ar condicionado"] });
  expect(JSON.stringify(row)).not.toMatch(/66000|ABC1D23/);
});

it("an open reservation reads as reserved, an expired or canceled one does not, and featured cars come first", async () => {
  const open = await car(a, "com-reserva", { entered_on: "2026-11-01" });
  const expired = await car(a, "reserva-vencida", { entered_on: "2026-10-20" });
  const canceled = await car(a, "reserva-cancelada", { entered_on: "2026-10-10" });
  await car(a, "destaque", { featured: true, entered_on: "2026-09-01" });
  await adminQuery("insert into reservations (store_id, vehicle_id, deposit, expires_on) values ($1, $2, 500, $3)", [a, open, TODAY]);
  await adminQuery("insert into reservations (store_id, vehicle_id, deposit, expires_on) values ($1, $2, 500, '2026-11-12')", [a, expired]);
  await adminQuery("insert into reservations (store_id, vehicle_id, deposit, expires_on, canceled_at) values ($1, $2, 500, '2026-11-20', now())", [a, canceled]);
  const rows = await site<{ slug: string; reserved: boolean }>("select slug, reserved from site_vehicles($1, $2)", ["loja-a", TODAY]);
  expect(rows).toEqual([
    { slug: "destaque", reserved: false },
    { slug: "com-reserva", reserved: true },
    { slug: "reserva-vencida", reserved: false },
    { slug: "reserva-cancelada", reserved: false },
  ]);
});

it("the interest of a visitor becomes a new client of the store, by the channel Site, once", async () => {
  await car(a, "argo-a");
  expect(await interest("loja-a", "argo-a", "  Joana Lima  ")).toBe(true);
  expect(await leads(a)).toEqual([
    { name: "Joana Lima", phone: "5583991112222", stage: "new", seller_id: null, interest: "Fiat Argo Drive 1.0", vehicle: "argo-a", channel: "Site" },
  ]);
  // The same person about the same car again: answered as received, not written twice.
  expect(await interest("loja-a", "argo-a")).toBe(true);
  expect(await leads(a)).toHaveLength(1);
  expect(await adminQuery("select count(*)::int as n from channels where store_id = $1 and name = 'Site'", [a])).toEqual([{ n: 1 }]);
  // Another car is another interest; a store that already has the channel reuses it.
  await car(a, "outro");
  expect(await interest("loja-a", "outro")).toBe(true);
  expect(await leads(a)).toHaveLength(2);
  expect(await adminQuery("select count(*)::int as n from channels where store_id = $1", [a])).toEqual([{ n: 1 }]);
  expect(await leads(b)).toEqual([]);
});

it("refuses a car that is not on the site and a name or phone that is not one, writing nothing", async () => {
  await car(a, "argo-a");
  await car(a, "vendido", { status: "sold" });
  await car(a, "em-preparo", { status: "preparing" });
  await car(b, "argo-b");
  expect(await interest("loja-a", "vendido")).toBe(false);
  expect(await interest("loja-a", "em-preparo")).toBe(false);
  expect(await interest("loja-a", "argo-b")).toBe(false);
  expect(await interest("loja-a", "nao-existe")).toBe(false);
  expect(await interest("nao-existe", "argo-a")).toBe(false);
  for (const name of ["", " ", "J", "x".repeat(81)]) expect(await interest("loja-a", "argo-a", name), name).toBe(false);
  for (const phone of ["", "83991112222", "55839911122", "5583991112222x", "558399111222233"]) expect(await interest("loja-a", "argo-a", "Joana", phone), phone).toBe(false);
  expect(await leads(a)).toEqual([]);
  expect(await adminQuery("select count(*)::int as n from channels")).toEqual([{ n: 0 }]);
});
