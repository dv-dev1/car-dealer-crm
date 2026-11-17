import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { afterSale, followUpMessage, setTransferDone } from "@/features/sales/after-sale";
import { AfterSaleView } from "@/features/sales/after-sale-view";
import { recordSale } from "@/features/sales/model";
import { getStoreSettings, setWarrantyDays } from "@/features/store/model";
import { withStore, type StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
vi.mock("@/features/sales/actions", () => ({ setTransferDoneAction: vi.fn() }));

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
let sales: string[];
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Maré Veículos", isDemo: true };
  manager = { ...owner, role: "manager" };
  await restoreDemoStore(owner, TODAY);
  const rows = await adminQuery(
    "select id, seller_id from sales where store_id = $1 and lead_id is not null and seller_id is not null order by sold_on, id limit 6",
    [owner.storeId],
  );
  sales = rows.map((r) => r.id);
  seller = { ...owner, membershipId: rows[0].seller_id, role: "seller", name: "Vendedor" };
});

/** Puts a sale on a quiet date, with the transfer done, so only what the test sets shows up. */
const set = (id: string, soldOn: string, warrantyUntil: string, transferDone = true) =>
  adminQuery("update sales set sold_on = $2, warranty_until = $3, transfer_done_on = $4 where id = $1", [
    id, soldOn, warrantyUntil, transferDone ? soldOn : null,
  ]);
const due = async (ctx: StoreMember, id: string, today = TODAY) =>
  (await afterSale(ctx, today)).today.filter((f) => f.saleId === id).map((f) => ({ kind: f.kind, dueOn: f.dueOn }));

it("a new sale takes the store's warranty days", async () => {
  expect((await getStoreSettings(owner)).warrantyDays).toBe(90);
  expect(await setWarrantyDays(manager, 30)).toEqual({ ok: true });
  const [car] = await adminQuery("select id from vehicles where store_id = $1 and status = 'available' limit 1", [owner.storeId]);
  const sold = await recordSale(owner, {
    vehicleId: car.id, leadId: null, sellerId: owner.membershipId, price: 60000, payment: "cash", bank: null, financedAmount: null,
    soldOn: TODAY, returnPct: null, tradeIn: null,
  }, TODAY);
  if (!sold.ok) throw new Error(sold.error);
  const [row] = await adminQuery("select to_char(warranty_until, 'YYYY-MM-DD') as w from sales where id = $1", [sold.id]);
  expect(row.w).toBe("2026-12-13");
  expect(await setWarrantyDays({ ...owner, role: "seller" }, 60)).toEqual({ ok: false, error: "forbidden" });
  for (const days of [-1, 366, 1.5]) expect(await setWarrantyDays(owner, days)).toEqual({ ok: false, error: "invalid" });
});

it("today's list takes the reminders of the last seven days", async () => {
  await set(sales[0], "2026-07-01", TODAY);
  await set(sales[1], "2026-07-01", "2026-11-07");
  await set(sales[2], "2026-07-01", "2026-11-06");
  await set(sales[3], "2025-11-13", "2026-02-11");
  await set(sales[4], "2026-05-31", "2026-08-29");
  expect(await due(owner, sales[0])).toEqual([{ kind: "warranty_end", dueOn: TODAY }]);
  expect(await due(owner, sales[1])).toEqual([{ kind: "warranty_end", dueOn: "2026-11-07" }]);
  expect(await due(owner, sales[2])).toEqual([]);
  expect(await due(owner, sales[3])).toEqual([{ kind: "one_year", dueOn: TODAY }]);
  // May 31 plus six months is the last day of November, not an invalid date.
  expect(await due(owner, sales[4])).toEqual([]);
  expect(await due(owner, sales[4], "2026-11-30")).toEqual([{ kind: "six_months", dueOn: "2026-11-30" }]);
});

it("a transfer not done after 20 days is late until someone marks it", async () => {
  await set(sales[0], "2026-10-23", "2027-01-21", false);
  await set(sales[1], "2026-10-25", "2027-01-23", false);
  expect(await due(owner, sales[0])).toEqual([{ kind: "transfer", dueOn: "2026-11-22" }]);
  expect(await due(owner, sales[1])).toEqual([]);
  const row = async () => (await afterSale(owner, TODAY)).sales.find((s) => s.saleId === sales[0])!;
  expect(await row()).toMatchObject({ transferDoneOn: null, transferLate: true, canMarkTransfer: true });

  expect(await setTransferDone(manager, sales[0], true, TODAY)).toEqual({ ok: true });
  expect(await row()).toMatchObject({ transferDoneOn: TODAY, transferLate: false });
  expect(await due(owner, sales[0])).toEqual([]);
  expect(await setTransferDone(owner, sales[0], false, TODAY)).toEqual({ ok: true });
  expect((await row()).transferDoneOn).toBeNull();
  expect(await setTransferDone(owner, "nope", true, TODAY)).toEqual({ ok: false, error: "not_found" });
});

it("a seller sees only their own sales and does not mark the transfer", async () => {
  const [{ n }] = await adminQuery(
    "select count(*)::int as n from sales where store_id = $1 and seller_id = $2 and sold_on > $3::date - interval '1 year' - interval '7 days'",
    [owner.storeId, seller.membershipId, TODAY],
  );
  const own = await afterSale(seller, TODAY);
  expect(own.sales).toHaveLength(n);
  expect(own.sales.length).toBeLessThan((await afterSale(owner, TODAY)).sales.length);
  expect(own.sales.every((s) => !s.canMarkTransfer)).toBe(true);

  await set(sales[0], "2026-10-23", "2027-01-21", false);
  expect(await setTransferDone(seller, sales[0], true, TODAY)).toEqual({ ok: false, error: "forbidden" });
  const direct = await withStore(seller, (db) => db.query("update sales set transfer_done_on = $2 where id = $1 returning id", [sales[0], TODAY]));
  expect(direct).toEqual([]);
});

it("a client with no phone, or a sale with no client, still gets the reminder", async () => {
  await set(sales[0], "2026-07-01", TODAY);
  await set(sales[1], "2026-07-01", TODAY);
  await adminQuery("update leads set phone = null where id = (select lead_id from sales where id = $1)", [sales[0]]);
  await adminQuery("update sales set lead_id = null where id = $1", [sales[1]]);
  const list = (await afterSale(owner, TODAY)).today;
  expect(list.find((f) => f.saleId === sales[0])).toMatchObject({ phone: null, customer: expect.any(String) });
  expect(list.find((f) => f.saleId === sales[1])).toMatchObject({ phone: null, customer: null });
});

it("each reminder has its message with the first name, the car and the store", () => {
  const about = { customer: "Joana Lima", car: "Fiat Argo", store: "Maré Veículos", dueOn: "2026-11-20" };
  for (const kind of ["warranty_end", "six_months", "one_year", "transfer"] as const) {
    const message = followUpMessage(kind, about);
    expect(message).toContain("Joana");
    expect(message).not.toContain("Lima");
    expect(message).toContain("Fiat Argo");
    expect(message).toContain("Maré Veículos");
  }
  expect(followUpMessage("warranty_end", about)).toContain("20/11/2026");
  expect(followUpMessage("six_months", { ...about, customer: null })).toMatch(/^Olá, aqui é da Maré Veículos/);
});

it("the screen shows today's reminders, the WhatsApp link only with a phone, and the transfer button to who manages", () => {
  const today = [
    { saleId: "s1", kind: "transfer" as const, dueOn: "2026-11-22", customer: "Joana Lima", phone: "5583900001111", car: "Fiat Argo",
      label: "Transferência pendente há 21 dias", message: "Olá Joana" },
    { saleId: "s2", kind: "warranty_end" as const, dueOn: TODAY, customer: "Caio Reis", phone: null, car: "VW Polo",
      label: "Garantia termina em 13/11/2026", message: "Olá Caio" },
  ];
  const row = {
    saleId: "s1", soldOn: "2026-10-23", customer: "Joana Lima", car: "Fiat Argo", sellerName: "Bruno Farias", warrantyUntil: "2027-01-21",
    transferDoneOn: null, transferLate: true,
  };
  const render = (canMarkTransfer: boolean) =>
    renderToStaticMarkup(createElement(AfterSaleView, { data: { today, sales: [{ ...row, canMarkTransfer }] } }));
  const html = render(true);
  expect(text(html)).toContain("Pós-venda de hoje");
  expect(text(html)).toContain("Transferência pendente há 21 dias");
  expect(html.match(/wa\.me\/5583900001111\?text=/g)).toHaveLength(1);
  expect(text(html)).toContain("Marcar transferência feita");
  expect(text(render(false))).not.toContain("Marcar transferência feita");
  expect(text(renderToStaticMarkup(createElement(AfterSaleView, { data: { today: [], sales: [] } })))).toContain("Nada para hoje");
});
