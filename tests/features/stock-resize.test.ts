import { afterEach, expect, it, vi } from "vitest";
import { resizePhoto } from "@/features/stock/resize";

// A canvas that writes only the given types; anything else comes out as PNG, as browsers do.
function useCanvas(writes: string[]) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: () => {} }),
    toBlob: (done: (blob: Blob) => void, type: string) => done(new Blob([new Uint8Array(10)], { type: writes.includes(type) ? type : "image/png" })),
  };
  vi.stubGlobal("createImageBitmap", async () => ({ width: 4000, height: 3000, close: () => {} }));
  vi.stubGlobal("document", { createElement: () => canvas });
  return canvas;
}

afterEach(() => vi.unstubAllGlobals());

const photo = new File([new Uint8Array(10)], "carro.jpg", { type: "image/jpeg" });

it("shrinks to 1600px in WebP where the browser writes WebP", async () => {
  const canvas = useCanvas(["image/webp", "image/jpeg"]);
  expect((await resizePhoto(photo)).type).toBe("image/webp");
  expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
});

it("falls back to JPEG where the browser cannot write WebP, as Safari on the iPhone", async () => {
  useCanvas(["image/jpeg"]);
  expect((await resizePhoto(photo)).type).toBe("image/jpeg");
});

it("fails when the browser writes neither", async () => {
  useCanvas([]);
  await expect(resizePhoto(photo)).rejects.toThrow("resize failed");
});
