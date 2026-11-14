import type { PhotoBucket } from "@/features/stock/photos";

// An in-memory R2 bucket with the three calls the app makes.
export function fakeBucket(): PhotoBucket & { objects: Map<string, { bytes: Uint8Array; contentType: string }> } {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    objects,
    async put(key, value, options) {
      objects.set(key, { bytes: value, contentType: options.httpMetadata.contentType });
    },
    async get(key) {
      const object = objects.get(key);
      return object ? { body: new Blob([object.bytes as Uint8Array<ArrayBuffer>]).stream(), httpMetadata: { contentType: object.contentType } } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
