import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/fotos/[...key]/route";
import { restoreDemoStore } from "@/features/demo/model";
import { getVehicle, listStock, type StockVehicle } from "@/features/stock/model";
import { MAX_PHOTO_BYTES, PHOTO_KEY, addVehiclePhoto, removeVehiclePhoto, sniffImageType } from "@/features/stock/photos";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { fakeBucket } from "../setup/bucket.ts";
import { useDatabase, usePhotoBucket } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const TODAY = "2026-11-13";
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const WEBP = new Uint8Array([...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBPVP8 "), 9, 9]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const PDF = new Uint8Array(ascii("%PDF-1.7 not a photo"));

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

let owner: StoreMember;
let seller: StoreMember;
let carla: StoreMember;
let car: StockVehicle;
let bucket: ReturnType<typeof fakeBucket>;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  bucket = fakeBucket();
  usePhotoBucket(bucket);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  carla = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla", storeName: "Loja B", isDemo: false };
  await restoreDemoStore(owner, TODAY);
  car = (await listStock(owner, TODAY))[0];
});

const photosOf = async (slug: string) => (await getVehicle(owner, slug, TODAY))!.photos;

it("stores a webp photo under the store and the car, at the next position", async () => {
  const first = await addVehiclePhoto(owner, bucket, car.id, WEBP);
  const second = await addVehiclePhoto(owner, bucket, car.id, WEBP);
  expect(first.ok && second.ok).toBe(true);
  const keys = [...bucket.objects.keys()];
  expect(keys).toHaveLength(2);
  for (const key of keys) {
    expect(key).toMatch(PHOTO_KEY);
    expect(key.startsWith(`stores/${owner.storeId}/vehicles/${car.id}/`)).toBe(true);
    expect(bucket.objects.get(key)!.contentType).toBe("image/webp");
  }
  const photos = await photosOf(car.slug);
  expect(photos.map((photo) => photo.id)).toEqual([first.ok && first.id, second.ok && second.id]);
  expect(photos.every((photo) => photo.url.startsWith("/fotos/stores/"))).toBe(true);
});

it("accepts JPEG and PNG and refuses bytes that are not an image, whatever the name", async () => {
  expect([WEBP, JPEG, PNG, PDF].map(sniffImageType)).toEqual(["image/webp", "image/jpeg", "image/png", null]);
  expect((await addVehiclePhoto(owner, bucket, car.id, JPEG)).ok).toBe(true);
  expect((await addVehiclePhoto(owner, bucket, car.id, PNG)).ok).toBe(true);
  expect(await addVehiclePhoto(owner, bucket, car.id, PDF)).toEqual({ ok: false, error: "not_image" });
  expect([...bucket.objects.keys()].map((key) => key.split(".").pop()).sort()).toEqual(["jpg", "png"]);
});

it("refuses a photo over 2 MB", async () => {
  const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
  big.set(JPEG);
  expect(await addVehiclePhoto(owner, bucket, car.id, big)).toEqual({ ok: false, error: "too_big" });
  expect(bucket.objects.size).toBe(0);
});

it("refuses the 21st photo", async () => {
  for (let i = 0; i < 20; i++) expect((await addVehiclePhoto(owner, bucket, car.id, WEBP)).ok).toBe(true);
  expect(await addVehiclePhoto(owner, bucket, car.id, WEBP)).toEqual({ ok: false, error: "too_many" });
  expect(bucket.objects.size).toBe(20);
});

it("refuses a seller and a car of another store", async () => {
  expect(await addVehiclePhoto(seller, bucket, car.id, WEBP)).toEqual({ ok: false, error: "forbidden" });
  expect(await addVehiclePhoto(carla, bucket, car.id, WEBP)).toEqual({ ok: false, error: "not_found" });
  expect(await addVehiclePhoto(owner, bucket, "not-a-uuid", WEBP)).toEqual({ ok: false, error: "not_found" });
  expect(bucket.objects.size).toBe(0);
  const added = await addVehiclePhoto(owner, bucket, car.id, WEBP);
  expect(await removeVehiclePhoto(seller, bucket, added.ok ? added.id : "")).toEqual({ ok: false, error: "forbidden" });
  expect(await removeVehiclePhoto(carla, bucket, added.ok ? added.id : "")).toEqual({ ok: false, error: "not_found" });
  expect(bucket.objects.size).toBe(1);
});

it("removing a photo deletes the row and the object and closes the gap in positions", async () => {
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const added = await addVehiclePhoto(owner, bucket, car.id, WEBP);
    ids.push(added.ok ? added.id : "");
  }
  expect(await removeVehiclePhoto(owner, bucket, ids[0])).toEqual({ ok: true });
  expect((await photosOf(car.slug)).map((photo) => photo.id)).toEqual(ids.slice(1));
  expect(bucket.objects.size).toBe(2);
  const rows = await adminQuery("select position from vehicle_photos where vehicle_id = $1 order by position", [car.id]);
  expect(rows.map((row) => row.position)).toEqual([0, 1]);
});

it("serves a stored photo with its type and a year of cache", async () => {
  await addVehiclePhoto(owner, bucket, car.id, PNG);
  const [key] = bucket.objects.keys();
  const response = await GET(new Request(`http://x/fotos/${key}`), { params: Promise.resolve({ key: key.split("/") }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
});

it("answers 404 for a key outside the photo folders or missing", async () => {
  for (const key of ["../secrets/x.webp", "stores/abc/x.webp", "demo/onix/../../x.webp", `demo/onix/missing.webp`]) {
    const response = await GET(new Request("http://x/fotos/"), { params: Promise.resolve({ key: key.split("/") }) });
    expect(response.status).toBe(404);
  }
});

it("removing a demo photo keeps the shared object, used by every car of the model", async () => {
  bucket.objects.set("demo/chevrolet-onix/01.webp", { bytes: WEBP, contentType: "image/webp" });
  const [row] = await adminQuery(
    "insert into vehicle_photos (store_id, vehicle_id, position, path) values ($1, $2, 0, 'demo/chevrolet-onix/01.webp') returning id",
    [owner.storeId, car.id],
  );
  expect(await removeVehiclePhoto(owner, bucket, row.id)).toEqual({ ok: true });
  expect(await photosOf(car.slug)).toEqual([]);
  expect(bucket.objects.has("demo/chevrolet-onix/01.webp")).toBe(true);
});
