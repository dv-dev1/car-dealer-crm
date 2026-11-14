// Runs in the browser: shrinks a photo before upload, so a phone picture fits the 2 MB limit and loads fast on 4G.
export async function resizeToWebp(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  // Safari before 17 writes PNG when asked for WebP; anything but WebP counts as a failure here.
  if (!blob || blob.type !== "image/webp") throw new Error("resize failed");
  return blob;
}
