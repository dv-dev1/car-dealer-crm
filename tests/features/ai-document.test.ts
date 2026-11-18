import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readDocumentAction } from "@/features/ai/actions";
import { readVehicleDocument } from "@/features/ai/document";
import { cleanDocumentFields } from "@/features/ai/rules";
import { createVehicle, getVehicle, updateVehicle, type VehicleInput } from "@/features/stock/model";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
const guard = vi.hoisted(() => ({ requireMember: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/features/auth/guard", () => guard);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), redirect: vi.fn(), notFound: vi.fn() }));

const TODAY = "2026-11-13";
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

const fetchMock = vi.fn<typeof fetch>();
const answer = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const READ = {
  plate: "abc-1d23", renavam: "0123456789-0", chassis: "9bwzzz377vt004251", brand: " Volkswagen ", model: "Gol",
  manufactureYear: 2019, modelYear: "2020", color: "PRATA",
};
const CLEAN = {
  plate: "ABC1D23", renavam: "01234567890", chassis: "9BWZZZ377VT004251", brand: "Volkswagen", model: "Gol",
  manufactureYear: "2019", modelYear: "2020", color: "Prata",
};
const EMPTY = { plate: "", renavam: "", chassis: "", brand: "", model: "", manufactureYear: "", modelYear: "", color: "" };

let owner: StoreMember;
let seller: StoreMember;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: false };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("keeps only what reads as a plate, a renavam, a chassis, a year and a known color", () => {
  expect(cleanDocumentFields(READ, 2026)).toEqual(CLEAN);
  expect(
    cleanDocumentFields(
      { plate: "AB-123", renavam: "12345", chassis: "9BWZZZ377VT00425O", brand: "x".repeat(41), model: 7, manufactureYear: 1800, modelYear: 2028, color: "Roxo" },
      2026,
    ),
  ).toEqual(EMPTY);
  for (const broken of [null, undefined, "texto", 3, [READ], { plate: { a: 1 }, color: null }]) {
    expect(cleanDocumentFields(broken, 2026)).toEqual(EMPTY);
  }
  expect(cleanDocumentFields({ ...READ, modelYear: 2027 }, 2026).modelYear).toBe("2027");
});

it("reads the document from the photo and returns the cleaned fields", async () => {
  fetchMock.mockResolvedValueOnce(answer(JSON.stringify(READ)));
  expect(await readVehicleDocument(owner, TODAY, { type: "image/jpeg", base64: "QUJD" })).toEqual({ ok: true, fields: CLEAN });
  const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  const parts = body.messages.at(-1).content;
  expect(parts).toContainEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } });
  expect(body.response_format.json_schema.strict).toBe(true);
  expect(Object.keys(body.response_format.json_schema.schema.properties).sort()).toEqual(Object.keys(CLEAN).sort());
});

it("an answer that is not the fields is a failure, and a seller never reaches the AI", async () => {
  fetchMock.mockResolvedValueOnce(answer("não consegui ler"));
  expect(await readVehicleDocument(owner, TODAY, { type: "image/png", base64: "QUJD" })).toEqual({ ok: false, reason: "failed" });
  fetchMock.mockClear();
  expect(await readVehicleDocument(seller, TODAY, { type: "image/png", base64: "QUJD" })).toEqual({ ok: false, reason: "failed" });
  expect(fetchMock).not.toHaveBeenCalled();
});

const upload = (type: string, bytes: number) => {
  const form = new FormData();
  form.set("document", new File([new Uint8Array(bytes)], "doc", { type }));
  return form;
};

it("the action takes a photo up to 2 MB, answers the fields and stores nothing", async () => {
  guard.requireMember.mockResolvedValue(owner);
  expect(await readDocumentAction(upload("application/pdf", 1000))).toEqual({ error: "Envie uma foto do documento em JPG, PNG ou WebP." });
  expect(await readDocumentAction(upload("image/jpeg", 3 * 1024 * 1024))).toEqual({ error: "A foto do documento passa de 2 MB." });
  expect(await readDocumentAction(new FormData())).toEqual({ error: "Envie uma foto do documento em JPG, PNG ou WebP." });
  expect(fetchMock).not.toHaveBeenCalled();

  fetchMock.mockResolvedValueOnce(answer(JSON.stringify(READ)));
  expect(await readDocumentAction(upload("image/webp", 3))).toEqual({ fields: CLEAN });
  const sent = JSON.parse(fetchMock.mock.calls[0][1]!.body as string).messages.at(-1).content;
  expect(sent).toContainEqual({ type: "image_url", image_url: { url: "data:image/webp;base64,AAAA" } });
  expect(await adminQuery("select count(*)::int as n from vehicles")).toEqual([{ n: 0 }]);
  expect(await adminQuery("select count(*)::int as n from vehicle_photos")).toEqual([{ n: 0 }]);

  guard.requireMember.mockResolvedValue(seller);
  expect(await readDocumentAction(upload("image/webp", 3))).toEqual({ error: "Só o dono e o gerente cadastram carro." });
  vi.stubEnv("OPENAI_API_KEY", "");
  guard.requireMember.mockResolvedValue(owner);
  expect(await readDocumentAction(upload("image/webp", 3))).toEqual({ error: "A IA ainda não está ligada nesta loja." });
});

const INPUT: VehicleInput = {
  brand: "Volkswagen", model: "Gol", version: "1.0", modelYear: 2020, manufactureYear: 2019, km: 60000, color: "Prata", fuel: "Flex",
  transmission: "Manual", bodyType: "Hatch", doors: 4, description: "", features: [], featured: false, price: 52000,
  acquisitionCost: 44000, enteredOn: "2026-11-10", ready: true, source: "purchase", consignorName: null, consignorPhone: null,
};

it("a car keeps its plate, renavam and chassis, shown only to who manages", async () => {
  const created = await createVehicle(owner, { ...INPUT, plate: "ABC1D23", renavam: "01234567890", chassis: "9BWZZZ377VT004251" }, TODAY);
  if (!created.ok) throw new Error(created.error);
  expect(await adminQuery("select plate, renavam, chassis from vehicles where id = $1", [created.id])).toEqual([
    { plate: "ABC1D23", renavam: "01234567890", chassis: "9BWZZZ377VT004251" },
  ]);
  expect((await getVehicle(owner, created.slug, TODAY))!.registration).toEqual({ plate: "ABC1D23", renavam: "01234567890", chassis: "9BWZZZ377VT004251" });
  expect((await getVehicle(seller, created.slug, TODAY))!.registration).toBeNull();

  expect(await updateVehicle(owner, created.id, { ...INPUT, plate: "XYZ9876", renavam: "", chassis: null }, TODAY)).toMatchObject({ ok: true });
  expect(await adminQuery("select plate, renavam, chassis from vehicles where id = $1", [created.id])).toEqual([
    { plate: "XYZ9876", renavam: null, chassis: null },
  ]);
  // An edit that says nothing about them (a script, an older form) leaves them as they are.
  expect(await updateVehicle(owner, created.id, INPUT, TODAY)).toMatchObject({ ok: true });
  expect(await adminQuery("select plate from vehicles where id = $1", [created.id])).toEqual([{ plate: "XYZ9876" }]);

  for (const [field, value] of [["plate", "AB123"], ["renavam", "12ab"], ["chassis", "9BWZZZ377VT00425O"]] as const) {
    expect(await createVehicle(owner, { ...INPUT, [field]: value }, TODAY)).toEqual({ ok: false, error: "invalid", field });
  }
  expect(await createVehicle(owner, INPUT, TODAY)).toMatchObject({ ok: true });
});

it("the new car form offers to read the document and has the three fields", async () => {
  const { AdicionarCarro } = await import("@/app/gestao/estoque/novo/AdicionarCarro");
  const html = renderToStaticMarkup(createElement(AdicionarCarro, { today: TODAY }));
  expect(text(html)).toContain("Ler o documento");
  for (const id of ["placa", "renavam", "chassi"]) expect(html).toContain(`id="${id}"`);
  expect(html).toMatch(/type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*id="documento"|id="documento"[^>]*type="file"/);
});
