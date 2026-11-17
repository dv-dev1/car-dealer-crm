import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { buyingReport } from "@/features/buying/model";
import { buyingVerdict, type BuyingRow } from "@/features/buying/rules";
import { BuyingView } from "@/features/buying/view";
import { restoreDemoStore } from "@/features/demo/model";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

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
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  manager = { ...owner, role: "manager" };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  await restoreDemoStore(owner, TODAY);
});

const BY_MODEL = `
  select v.brand || ' ' || v.model as label, count(*)::int as sold,
         avg(greatest(s.sold_on - v.entered_on, 1))::float8 as "avgDays", avg(p.profit)::float8 as "avgProfit",
         (sum(p.profit) / sum(greatest(s.sold_on - v.entered_on, 1)))::float8 as "profitPerDay"
    from sales s join vehicles v on v.id = s.vehicle_id join sale_profits p on p.sale_id = s.id
   where s.store_id = $1 and s.sold_on > $2::date - interval '1 year' and s.sold_on <= $2::date
   group by 1`;

it("each model's sales, days, profit and profit per day match the store's sales", async () => {
  const rows = await adminQuery(BY_MODEL, [owner.storeId, TODAY]);
  const report = (await buyingReport(owner, TODAY))!;
  expect(report.byModel).toHaveLength(rows.length);
  for (const r of rows) {
    const got = report.byModel.find((m) => m.label === r.label)!;
    expect(got.sold).toBe(r.sold);
    expect(got.avgDays).toBeCloseTo(r.avgDays, 1);
    expect(got.avgProfit).toBeCloseTo(r.avgProfit, 0);
    expect(got.profitPerDay).toBeCloseTo(r.profitPerDay, 1);
  }
  const total = rows.reduce((sum, r) => sum + r.sold, 0);
  expect(report.byBand.reduce((sum, b) => sum + b.sold, 0)).toBe(total);
  expect(report.store!.sold).toBe(total);
  expect(report.byModel.map((m) => m.profitPerDay)).toEqual([...report.byModel.map((m) => m.profitPerDay)].sort((a, b) => b - a));
});

it("a manager reads the report; a seller gets none", async () => {
  expect(await buyingReport(manager, TODAY)).not.toBeNull();
  expect(await buyingReport(seller, TODAY)).toBeNull();
});

it("a car sold the day it came in counts one day; a store with no sale has no report rows", async () => {
  await adminQuery("delete from sales where store_id = $1 and id <> (select id from sales where store_id = $1 limit 1)", [owner.storeId]);
  await adminQuery("update sales set sold_on = $2 where store_id = $1", [owner.storeId, TODAY]);
  await adminQuery("update vehicles set entered_on = $2 where id = (select vehicle_id from sales where store_id = $1)", [owner.storeId, TODAY]);
  const one = (await buyingReport(owner, TODAY))!;
  expect(one.byModel).toHaveLength(1);
  expect(one.byModel[0].avgDays).toBe(1);
  expect(one.byModel[0].profitPerDay).toBeCloseTo(one.byModel[0].avgProfit, 2);

  await adminQuery("delete from sales where store_id = $1", [owner.storeId]);
  expect(await buyingReport(owner, TODAY)).toEqual({ byModel: [], byBand: [], store: null });
});

it("says what to buy more and what to avoid", () => {
  expect(buyingVerdict({ sold: 1, avgProfit: 9000, profitPerDay: 900 }, 100)).toBeNull();
  expect(buyingVerdict({ sold: 3, avgProfit: -100, profitPerDay: -5 }, 100)).toBe("avoid");
  expect(buyingVerdict({ sold: 2, avgProfit: 5000, profitPerDay: 130 }, 100)).toBe("buy");
  expect(buyingVerdict({ sold: 2, avgProfit: 5000, profitPerDay: 50 }, 100)).toBe("avoid");
  expect(buyingVerdict({ sold: 2, avgProfit: 5000, profitPerDay: 100 }, 100)).toBeNull();
});

it("the screen marks what to buy more and what to avoid", () => {
  const row = (label: string, verdict: BuyingRow["verdict"]): BuyingRow => ({ key: label, label, sold: 3, avgDays: 22.4, avgProfit: 6400, profitPerDay: 285.7, verdict });
  const report = {
    byModel: [row("Fiat Argo", "buy"), row("VW Polo", null), row("Jeep Renegade", "avoid")],
    byBand: [row("Até R$ 50 mil", null)],
    store: { sold: 9, avgDays: 30, avgProfit: 5000, profitPerDay: 166 },
  };
  const html = text(renderToStaticMarkup(createElement(BuyingView, { report })));
  expect(html).toMatch(/Fiat Argo[^J]*Comprar mais/);
  expect(html).toMatch(/Jeep Renegade.*Evitar/);
  expect(html).toContain("22 dias");
  expect(html).toMatch(/R\$\s?6\.400/);
  expect(html).toContain("Até R$ 50 mil");
  expect(text(renderToStaticMarkup(createElement(BuyingView, { report: { byModel: [], byBand: [], store: null } })))).toContain("Sem vendas ainda");
});
