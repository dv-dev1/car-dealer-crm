import { beforeEach, expect, it, vi } from "vitest";

import { addPhotoAction, removePhotoAction, removeVehicleAction, saveVehicleAction, setMarginAction } from "@/features/stock/actions";
import type { MemberContext } from "@/shared/db/client";

const guard = vi.hoisted(() => ({ requireMember: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/features/auth/guard", () => guard);

const model = vi.hoisted(() => ({ createVehicle: vi.fn(), updateVehicle: vi.fn(), getVehicle: vi.fn(), setMargin: vi.fn(), removeVehicle: vi.fn() }));
vi.mock("@/features/stock/model", () => model);

const photos = vi.hoisted(() => ({
  photoBucket: vi.fn(() => "bucket"),
  addVehiclePhoto: vi.fn(),
  removeVehiclePhoto: vi.fn(),
  MAX_PHOTO_BYTES: 2_000_000,
}));
vi.mock("@/features/stock/photos", () => photos);

const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));
vi.mock("next/navigation", () => navigation);

const ctx: MemberContext = { storeId: "store-a", membershipId: "member-a", role: "owner", name: "Ana" };
const CAR = "11111111-1111-4111-8111-111111111111";
const FIELDS = {
  brand: "Chevrolet", model: "Onix", version: "LT 1.0", manufactureYear: "2022", modelYear: "2023", km: "32000",
  color: "Prata", fuel: "Flex", transmission: "Manual", bodyType: "", doors: "4", description: "", price: "72990",
  acquisitionCost: "61000", enteredOn: "2026-11-10", ready: "on",
};

function form(fields: Record<string, string | Blob | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  }
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  guard.requireMember.mockResolvedValue(ctx);
  photos.photoBucket.mockReturnValue("bucket");
  model.createVehicle.mockResolvedValue({ ok: true, id: CAR, slug: "chevrolet-onix-lt-1-0-2023-111111" });
  model.updateVehicle.mockResolvedValue({ ok: true, id: CAR, slug: "chevrolet-onix-lt-1-0-2023-111111" });
});

it("rejects a price that is not digits", async () => {
  const state = await saveVehicleAction({ error: null }, form({ ...FIELDS, price: "139.990" }));
  expect(state).toEqual({ error: "Confira o campo: Preço de venda.", field: "price" });
  expect(model.createVehicle).not.toHaveBeenCalled();
});

it("creates when there is no id and edits when there is one", async () => {
  const created = await saveVehicleAction({ error: null }, form({ ...FIELDS, features: ["Ar condicionado", "ABS"] }));
  expect(created).toEqual({ error: null, id: CAR, slug: "chevrolet-onix-lt-1-0-2023-111111" });
  expect(model.createVehicle).toHaveBeenCalledWith(ctx, {
    brand: "Chevrolet", model: "Onix", version: "LT 1.0", manufactureYear: 2022, modelYear: 2023, km: 32000, color: "Prata",
    fuel: "Flex", transmission: "Manual", bodyType: null, doors: 4, description: "", features: ["Ar condicionado", "ABS"],
    featured: false, price: 72990, acquisitionCost: 61000, enteredOn: "2026-11-10", ready: true,
  });
  await saveVehicleAction({ error: null }, form({ ...FIELDS, id: CAR }));
  expect(model.updateVehicle).toHaveBeenCalledWith(ctx, CAR, expect.objectContaining({ price: 72990 }));
  expect(cache.revalidatePath).toHaveBeenCalledWith("/gestao", "layout");
});

it("shows the owner-and-manager message to a seller", async () => {
  model.createVehicle.mockResolvedValue({ ok: false, error: "forbidden" });
  expect(await saveVehicleAction({ error: null }, form(FIELDS))).toEqual({ error: "Só o dono e o gerente mexem no estoque." });
  model.updateVehicle.mockResolvedValue({ ok: false, error: "not_editable" });
  expect(await saveVehicleAction({ error: null }, form({ ...FIELDS, id: CAR }))).toEqual({
    error: "Este carro já foi vendido ou removido e não pode ser editado.",
  });
});

it("sends the photo's bytes and names the photo errors", async () => {
  photos.addVehiclePhoto.mockResolvedValue({ ok: true, id: "p1" });
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "carro.heic", { type: "image/heic" });
  expect(await addPhotoAction(form({ vehicleId: CAR, photo: file }))).toEqual({ error: null });
  expect(photos.addVehiclePhoto).toHaveBeenCalledWith(ctx, "bucket", CAR, new Uint8Array([0xff, 0xd8, 0xff]));
  for (const [error, text] of [
    ["too_big", "Foto acima de 2 MB."],
    ["not_image", "Formato de foto não aceito; use JPG, PNG ou WebP."],
    ["too_many", "Limite de 20 fotos por carro."],
  ]) {
    photos.addVehiclePhoto.mockResolvedValue({ ok: false, error });
    expect(await addPhotoAction(form({ vehicleId: CAR, photo: file }))).toEqual({ error: text });
  }
  expect(await addPhotoAction(form({ vehicleId: CAR }))).toEqual({ error: "Formato de foto não aceito; use JPG, PNG ou WebP." });
  photos.removeVehiclePhoto.mockResolvedValue({ ok: true });
  expect(await removePhotoAction(form({ photoId: "p1" }))).toEqual({ error: null });
});

it("the add and edit pages ask for owner or manager", async () => {
  guard.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
  const add = (await import("@/app/gestao/estoque/novo/page")).default;
  const edit = (await import("@/app/gestao/estoque/[slug]/editar/page")).default;
  await expect(add()).rejects.toThrow("NEXT_REDIRECT");
  await expect(edit({ params: Promise.resolve({ slug: "x" }) })).rejects.toThrow("NEXT_REDIRECT");
  expect(guard.requireRole.mock.calls).toEqual([[["owner", "manager"]], [["owner", "manager"]]]);
  expect(model.getVehicle).not.toHaveBeenCalled();
});

it("redirects to the stock after removing", async () => {
  model.removeVehicle.mockResolvedValue({ ok: true });
  await expect(removeVehicleAction({ error: null }, form({ vehicleId: CAR, reason: "wrong_entry" }))).rejects.toThrow(
    "NEXT_REDIRECT /gestao/estoque",
  );
  expect(model.removeVehicle).toHaveBeenCalledWith(ctx, CAR, "wrong_entry");
  model.removeVehicle.mockResolvedValue({ ok: false, error: "invalid" });
  expect(await removeVehicleAction({ error: null }, form({ vehicleId: CAR, reason: "returned_to_consignor" }))).toEqual({
    error: "Este carro não pode sair do estoque por esse motivo.",
  });
});

it("shows the error text when the margin is invalid", async () => {
  model.setMargin.mockResolvedValue({ ok: true });
  expect(await setMarginAction({ error: null }, form({ vehicleId: CAR, discount: "3000" }))).toEqual({ error: null });
  expect(model.setMargin).toHaveBeenCalledWith(ctx, CAR, 3000);
  expect(await setMarginAction({ error: null }, form({ vehicleId: CAR, discount: "3.000" }))).toEqual({
    error: "O desconto precisa ser menor que o preço.",
  });
  model.setMargin.mockResolvedValue({ ok: false, error: "invalid" });
  expect(await setMarginAction({ error: null }, form({ vehicleId: CAR, discount: "99999999" }))).toEqual({
    error: "O desconto precisa ser menor que o preço.",
  });
  model.setMargin.mockResolvedValue({ ok: false, error: "forbidden" });
  expect(await setMarginAction({ error: null }, form({ vehicleId: CAR, discount: "1" }))).toEqual({
    error: "Só o dono e o gerente mexem no estoque.",
  });
});
