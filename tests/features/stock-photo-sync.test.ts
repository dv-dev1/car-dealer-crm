import { expect, it, vi } from "vitest";
import { syncPhotos, type FormPhoto } from "@/features/stock/photo-sync";

const blob = (name: string) => new Blob([name], { type: "image/webp" });
const sentNames = async (add: ReturnType<typeof vi.fn>) =>
  Promise.all(add.mock.calls.map(([form]) => (form as FormData).get("photo") as Blob).map((b) => b.text()));

it("sends only the new photos, marks the sent ones as saved and keeps the failed ones to retry", async () => {
  const photos: FormPhoto[] = [
    { id: "a", url: "/fotos/a", savedId: "s1" },
    { id: "b", url: "blob:b", upload: blob("b") },
    { id: "c", url: "blob:c", upload: blob("c") },
  ];
  const add = vi.fn(async (form: FormData) => {
    const name = await (form.get("photo") as Blob).text();
    return name === "c" ? { error: "Limite de 20 fotos por carro." } : { error: null, id: `saved-${name}` };
  });
  const remove = vi.fn(async () => ({ error: null }));

  const first = await syncPhotos("car-1", photos, [], { add, remove });
  expect(await sentNames(add)).toEqual(["b", "c"]);
  expect(first).toMatchObject({ sent: 1, total: 2, error: "Limite de 20 fotos por carro." });
  expect(first.photos.map((p) => [p.id, p.savedId ?? null])).toEqual([["a", "s1"], ["b", "saved-b"], ["c", null]]);

  add.mockClear();
  await syncPhotos("car-1", first.photos, first.removed, { add, remove });
  expect(await sentNames(add)).toEqual(["c"]);
  expect((add.mock.calls[0][0] as FormData).get("vehicleId")).toBe("car-1");
});

it("forgets the removals that worked and keeps the ones that failed", async () => {
  const remove = vi.fn(async (form: FormData) => (form.get("photoId") === "r2" ? { error: "Carro não encontrado." } : { error: null }));
  const result = await syncPhotos("car-1", [], ["r1", "r2"], { add: vi.fn(), remove });
  expect(result).toMatchObject({ removed: ["r2"], error: "Carro não encontrado.", sent: 0, total: 0 });
});
