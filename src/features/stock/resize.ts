// Runs in the browser: shrinks a photo before upload, so a phone picture fits the 2 MB limit and loads fast on 4G.
export async function resizePhoto(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Safari writes PNG when asked for WebP (a browser writes PNG for any type it cannot encode): then JPEG.
  for (const type of ["image/webp", "image/jpeg"]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (blob?.type === type) return blob;
  }
  throw new Error("resize failed");
}
