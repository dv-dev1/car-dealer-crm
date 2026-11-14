import { PHOTO_KEY, photoBucket } from "@/features/stock/photos";

// Car photos are public (the store's site shows them); keys are unique, so they never change.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!PHOTO_KEY.test(key)) return new Response("Not found", { status: 404 });
  const object = await photoBucket().get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
