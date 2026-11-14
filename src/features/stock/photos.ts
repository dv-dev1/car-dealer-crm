import { getCloudflareContext } from "@opennextjs/cloudflare";

import { UUID, withStore, type MemberContext } from "@/shared/db/client";

// Car photos live in R2 (binding PHOTOS); the app serves them from /fotos/<key>.
export type PhotoBucket = {
  put(key: string, value: Uint8Array, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
};

export const MAX_PHOTO_BYTES = 2_000_000;
export const MAX_PHOTOS_PER_VEHICLE = 20;

const ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const PHOTO_KEY = new RegExp(`^(demo/[a-z0-9-]+|stores/${ID}/vehicles/${ID})/[a-z0-9-]+\\.(webp|jpg|png)$`);

const EXTENSION = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } as const;
type ImageType = keyof typeof EXTENSION;

export function photoUrl(path: string): string {
  return `/fotos/${path}`;
}

export function photoBucket(): PhotoBucket {
  return (getCloudflareContext().env as { PHOTOS: PhotoBucket }).PHOTOS;
}

/** The image type by the file's first bytes, never by its name. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const text = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (text(0, 4) === "RIFF" && text(8, 12) === "WEBP") return "image/webp";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => bytes[i] === byte)) return "image/png";
  return null;
}

type AddPhotoError = "forbidden" | "not_found" | "too_big" | "not_image" | "too_many";

// RLS lets only owner and manager write vehicle_photos; the checks here pick the error to show.
export async function addVehiclePhoto(
  ctx: MemberContext,
  bucket: PhotoBucket,
  vehicleId: string,
  bytes: Uint8Array,
): Promise<{ ok: true; id: string } | { ok: false; error: AddPhotoError }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, error: "too_big" };
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: "not_image" };
  if (!UUID.test(vehicleId)) return { ok: false, error: "not_found" };

  return withStore(ctx, async (db) => {
    const [car] = await db.query<{ count: number }>(
      `select (select count(*)::int from vehicle_photos p where p.vehicle_id = v.id) as count
         from vehicles v where v.id = $1 and v.store_id = $2 and v.status <> 'removed' for update`,
      [vehicleId, ctx.storeId],
    );
    if (!car) return { ok: false, error: "not_found" } as const;
    if (car.count >= MAX_PHOTOS_PER_VEHICLE) return { ok: false, error: "too_many" } as const;

    const id = crypto.randomUUID();
    const key = `stores/${ctx.storeId}/vehicles/${vehicleId}/${id}.${EXTENSION[type]}`;
    await bucket.put(key, bytes, { httpMetadata: { contentType: type } });
    try {
      await db.query(
        `insert into vehicle_photos (id, store_id, vehicle_id, position, path)
         values ($1, $2, $3, (select coalesce(max(position) + 1, 0) from vehicle_photos where vehicle_id = $3), $4)`,
        [id, ctx.storeId, vehicleId, key],
      );
    } catch (error) {
      await bucket.delete(key).catch(() => {}); // an orphan object costs little; the real error matters
      throw error;
    }
    return { ok: true, id } as const;
  });
}

export async function removeVehiclePhoto(
  ctx: MemberContext,
  bucket: PhotoBucket,
  photoId: string,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "not_found" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (!UUID.test(photoId)) return { ok: false, error: "not_found" };

  const path = await withStore(ctx, async (db) => {
    const [photo] = await db.query<{ vehicle_id: string; position: number; path: string }>(
      "delete from vehicle_photos where id = $1 and store_id = $2 returning vehicle_id, position, path",
      [photoId, ctx.storeId],
    );
    if (!photo) return null;
    // (vehicle_id, position) is unique and not deferrable: move the later ones out of the way, then back one down.
    await db.query("update vehicle_photos set position = position + 1000 where vehicle_id = $1 and position > $2", [
      photo.vehicle_id,
      photo.position,
    ]);
    await db.query("update vehicle_photos set position = position - 1001 where vehicle_id = $1 and position > 1000", [
      photo.vehicle_id,
    ]);
    return photo.path;
  });
  if (path === null) return { ok: false, error: "not_found" };
  await bucket.delete(path).catch(() => {}); // the row is gone; an object left behind is only storage
  return { ok: true };
}
