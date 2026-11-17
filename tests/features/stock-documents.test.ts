import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { Documentos } from "@/app/gestao/estoque/[slug]/Documentos";
import { FecharNegocioDialog } from "@/components/gestao/clientes/FecharNegocioDialog";
import { restoreDemoStore } from "@/features/demo/model";
import type { Lead } from "@/features/leads/types";
import { listDocuments, setDocument } from "@/features/stock/documents";
import { listStock } from "@/features/stock/model";
import { withStore, type StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
vi.mock("@/features/stock/actions", () => ({ setDocumentAction: vi.fn() }));
vi.mock("@/features/leads/actions", () => ({ loseLeadAction: vi.fn() }));
vi.mock("@/features/sales/actions", () => ({ recordSaleAction: vi.fn() }));

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

let owner: StoreMember;
let manager: StoreMember;
let seller: StoreMember;
let pending: string;
let clean: string;
let otherStoreCar: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  manager = { ...owner, role: "manager" };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  otherStoreCar = (
    await adminQuery(
      `insert into vehicles (store_id, slug, brand, model, version, model_year, manufacture_year, km, fuel, transmission, price, entered_on, status)
       values ($1, 'onix-b', 'Chevrolet', 'Onix', 'LT 1.0', 2022, 2021, 30000, 'Flex', 'Manual', 70000, '2026-10-01', 'available') returning id`,
      [seed.b.storeId],
    )
  )[0].id;
  await restoreDemoStore(owner, TODAY);
  const car = (item: string, having: string) =>
    adminQuery(
      `select v.id from vehicles v where v.store_id = $1 and v.status = 'available'
          and (select count(*) from vehicle_documents d where d.vehicle_id = v.id and d.status = 'pending' and d.item = $2) ${having}
          and (select count(*) from vehicle_documents d where d.vehicle_id = v.id and d.status = 'pending') ${having} limit 1`,
      [owner.storeId, item],
    ).then((rows) => rows[0].id as string);
  pending = await car("ipva", "= 1");
  clean = await car("ipva", "= 0");
});

const pendingDocs = async (ctx: StoreMember, id: string) => (await listStock(ctx, TODAY)).find((v) => v.id === id)!.pendingDocs;

it("lists the seven documents of a car and counts the pending ones", async () => {
  const docs = await listDocuments(seller, pending);
  expect(docs.map((d) => d.item)).toEqual(["ipva", "fines", "inspection_report", "lien", "transfer_document", "spare_key", "manual"]);
  expect(docs[0]).toEqual({ item: "ipva", status: "pending", note: null });
  expect(docs[3].status).toBe("not_applicable");
  expect(await pendingDocs(seller, pending)).toBe(1);
  expect(await pendingDocs(owner, clean)).toBe(0);
});

it("a car with no document row is not checked yet, and not pending", async () => {
  await adminQuery("delete from vehicle_documents where vehicle_id = $1", [pending]);
  const docs = await listDocuments(owner, pending);
  expect(docs).toHaveLength(7);
  expect(docs.every((d) => d.status === null)).toBe(true);
  expect(await pendingDocs(owner, pending)).toBe(0);
});

it("owner and manager set a document; a seller only reads", async () => {
  expect(await setDocument(manager, { vehicleId: pending, item: "ipva", status: "ok", note: " Pago em novembro " })).toEqual({ ok: true });
  expect((await listDocuments(owner, pending))[0]).toEqual({ item: "ipva", status: "ok", note: "Pago em novembro" });
  expect(await pendingDocs(owner, pending)).toBe(0);
  // A car with no row yet takes the first one.
  await adminQuery("delete from vehicle_documents where vehicle_id = $1", [clean]);
  expect(await setDocument(owner, { vehicleId: clean, item: "manual", status: "pending", note: "" })).toEqual({ ok: true });
  expect(await pendingDocs(owner, clean)).toBe(1);

  expect(await setDocument(seller, { vehicleId: pending, item: "ipva", status: "pending", note: "" })).toEqual({ ok: false, error: "forbidden" });
  const direct = await withStore(seller, (db) => db.query("update vehicle_documents set status = 'pending' where vehicle_id = $1 returning id", [pending]));
  expect(direct).toEqual([]);
});

it("refuses a bad document", async () => {
  const ok = { vehicleId: pending, item: "ipva", status: "ok", note: "" };
  for (const over of [{ item: "crlv" }, { status: "late" }, { note: "x".repeat(201) }]) {
    expect(await setDocument(owner, { ...ok, ...over } as never)).toEqual({ ok: false, error: "invalid" });
  }
  for (const vehicleId of [otherStoreCar, "nope"]) {
    expect(await setDocument(owner, { ...ok, vehicleId } as never)).toEqual({ ok: false, error: "not_found" });
  }
});

it("the car page shows each document; only who manages gets the form", async () => {
  const docs = await listDocuments(owner, pending);
  const render = (canManage: boolean) => text(renderToStaticMarkup(createElement(Documentos, { vehicleId: pending, documents: docs, canManage })));
  for (const html of [render(true), render(false)]) {
    expect(html).toContain("IPVA do ano");
    expect(html).toContain("Pendente");
    expect(html).toContain("1 pendência");
  }
  expect(renderToStaticMarkup(createElement(Documentos, { vehicleId: pending, documents: docs, canManage: true }))).toContain("<select");
  expect(renderToStaticMarkup(createElement(Documentos, { vehicleId: pending, documents: docs, canManage: false }))).not.toContain("<select");
});

it("the sale dialog warns about pending documents and does not block", () => {
  const lead: Lead = {
    id: "l1", nome: "Joana Lima", telefone: "5583991110000", telefoneLabel: "(83) 99111-0000", estagio: "negociando",
    sellerId: "m2", sellerName: "Dani", vehicleId: "v1", carro: "Fiat Argo Drive", canEdit: true,
  };
  const dialog = (pendingDocs: number) =>
    renderToStaticMarkup(createElement(FecharNegocioDialog, {
      fechamento: { lead, tipo: "vendeu" }, veiculos: [{ id: "v1", titulo: "Fiat Argo Drive", preco: 68990, pendingDocs }], sellers: null,
      memberId: "m1", onConfirmar: () => {}, onCancelar: () => {},
    }));
  expect(text(dialog(2))).toContain("Este carro tem 2 pendências de documentação");
  expect(text(dialog(1))).toContain("Este carro tem 1 pendência de documentação");
  // The warning does not change the confirm button: it is the same with and without pending documents.
  const submit = (html: string) => html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
  expect(submit(dialog(2))).toBeDefined();
  expect(submit(dialog(2))).toBe(submit(dialog(0)));
  expect(text(dialog(0))).not.toContain("documentação");
});
