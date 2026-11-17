import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { appraiseAction } from "@/features/buying/actions";
import { appraisalDefaults } from "@/features/buying/appraisal";
import { AppraisalResult, ConditionSelect } from "@/features/buying/appraisal-view";
import { TRADE_IN_KEY, appraise, keepAppraisalForSale, referencePrice, takeAppraisalForSale } from "@/features/buying/rules";
import { MODELS } from "@/features/demo/catalog";
import { restoreDemoStore } from "@/features/demo/model";
import type { StoreMember } from "@/shared/db/client";
import { formData } from "@/shared/form";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
const guard = vi.hoisted(() => ({ requireMember: vi.fn() }));
vi.mock("@/features/auth/guard", () => guard);

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
let seller: StoreMember;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  await restoreDemoStore(owner, TODAY);
});

it("the example reference price runs between the catalog's two years", () => {
  const onix = MODELS[0];
  expect(referencePrice("chevrolet", " ONIX ", onix.years[0])).toBe(onix.prices[0]);
  expect(referencePrice(onix.brand, onix.model, onix.years[1])).toBe(onix.prices[1]);
  const middle = referencePrice(onix.brand, onix.model, onix.years[0] + 1)!;
  expect(middle).toBeGreaterThan(onix.prices[0]);
  expect(middle).toBeLessThan(onix.prices[1]);
  expect(referencePrice("Marca Inexistente", "Carro", 2020)).toBeNull();
  expect(referencePrice(onix.brand, onix.model, onix.years[0] - 10)).toBeNull();
});

const base = { reference: 80000, year: 2020, km: 72000, condition: "good" as const, days: 40, marginPct: 10, monthlyRate: 0.01 };

it("the offer leaves the target margin after preparation and the cost of money", () => {
  const result = appraise(base, 2026)!;
  expect(result.salePrice).toBe(77600); // 80.000 x 0,97; 72.000 km is what six years ask
  expect(result.offer).toBe(67400); // (77.600 x 0,9 - 1.500) / (1 + 0,01 x 40 / 30) = 67.440, down to the hundred
  expect(result.prep).toBe(1500);
  expect(result.days).toBe(40);
  expect(result.moneyCost).toBeCloseTo(67400 * 0.01 * (40 / 30), 2);
  expect(result.offer + result.prep + result.moneyCost + result.profit).toBeCloseTo(result.salePrice, 2);
  expect(result.profit).toBeGreaterThanOrEqual(77600 * 0.1);
});

it("high mileage takes at most ten percent, and a car not worth it gets no offer", () => {
  expect(appraise({ ...base, km: 102000 }, 2026)!.salePrice).toBe(75300); // 3% off for 30.000 km over: 77.600 x 0,97 = 75.272
  expect(appraise({ ...base, km: 900000 }, 2026)!.salePrice).toBe(69800); // capped: 77.600 x 0,9 = 69.840
  expect(appraise({ ...base, km: 10000 }, 2026)!.salePrice).toBe(77600);
  expect(appraise({ ...base, reference: 6000, condition: "poor" }, 2026)).toBeNull();
});

it("the defaults come from the store's sales of the model, then the store, then fixed values", async () => {
  const [sold] = await adminQuery(
    `select v.brand, v.model, round(avg(greatest(s.sold_on - v.entered_on, 1)))::int as days, count(*)::int as n
       from sales s join vehicles v on v.id = s.vehicle_id
      where s.store_id = $1 and s.sold_on > $2::date - interval '1 year' group by 1, 2 order by n desc limit 1`,
    [owner.storeId, TODAY],
  );
  const [store] = await adminQuery(
    `select round(avg(greatest(s.sold_on - v.entered_on, 1)))::int as days, (sum(p.profit) / sum(s.price) * 100)::float8 as margin
       from sales s join vehicles v on v.id = s.vehicle_id join sale_profits p on p.sale_id = s.id
      where s.store_id = $1 and s.sold_on > $2::date - interval '1 year'`,
    [owner.storeId, TODAY],
  );
  const margin = Math.min(20, Math.max(5, Math.round(store.margin)));
  expect(await appraisalDefaults(owner, sold.brand.toUpperCase(), sold.model, TODAY)).toEqual({
    days: sold.days, marginPct: margin, monthlyRate: 0.01, modelSales: sold.n,
  });
  expect(await appraisalDefaults(owner, "Marca Inexistente", "Carro", TODAY)).toEqual({
    days: store.days, marginPct: margin, monthlyRate: 0.01, modelSales: 0,
  });
  expect(await appraisalDefaults(seller, sold.brand, sold.model, TODAY)).toBeNull();

  await adminQuery("delete from sales where store_id = $1", [owner.storeId]);
  expect(await appraisalDefaults(owner, sold.brand, sold.model, TODAY)).toEqual({ days: 45, marginPct: 10, monthlyRate: 0.01, modelSales: 0 });
});

const form = (over: Record<string, string> = {}) =>
  formData({ brand: "Chevrolet", model: "Onix", year: "2022", km: "48.000", condition: "good", reference: "", marginPct: "", ...over });

it("the action appraises for owner and manager, with the typed reference when there is one", async () => {
  guard.requireMember.mockResolvedValue(owner);
  const fromCatalog = await appraiseAction({ error: null }, form());
  expect(fromCatalog.error).toBeNull();
  expect(fromCatalog.input).toMatchObject({ brand: "Chevrolet", model: "Onix", year: 2022, km: 48000, reference: referencePrice("Chevrolet", "Onix", 2022) });
  expect(fromCatalog.result!.offer).toBeGreaterThan(0);
  const typed = await appraiseAction({ error: null }, form({ reference: "90.000", marginPct: "12" }));
  expect(typed.input).toMatchObject({ reference: 90000, marginPct: 12 });

  expect((await appraiseAction({ error: null }, form({ brand: "Marca Inexistente" }))).error).toMatch(/FIPE/);
  const bads: Record<string, string>[] = [{ year: "1900" }, { km: "" }, { condition: "new" }, { brand: " " }, { marginPct: "80" }];
  for (const bad of bads) {
    expect((await appraiseAction({ error: null }, form(bad))).error).not.toBeNull();
  }
  guard.requireMember.mockResolvedValue(seller);
  expect(await appraiseAction({ error: null }, form())).toEqual({ error: "Só o dono e o gerente avaliam a troca." });
});

it("the result reads as an offer, or says the trade is not worth it", () => {
  const input = { brand: "Chevrolet", model: "Onix", year: 2020, km: 72000, condition: "good" as const, reference: 80000, marginPct: 10 };
  const html = text(renderToStaticMarkup(createElement(AppraisalResult, { result: appraise(base, 2026), input })));
  expect(html).toMatch(/Ofereça até R\$\s?67\.400/);
  expect(html).toMatch(/vendendo a R\$\s?77\.600/);
  expect(html).toContain("em cerca de 40 dias");
  expect(text(renderToStaticMarkup(createElement(AppraisalResult, { result: null, input })))).toContain("Não vale a troca");
});

it("an appraisal kept for the sale is taken once, and a broken one is dropped", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  const kept = { brand: "Chevrolet", model: "Onix", year: 2020, km: 72000, value: 67400 };
  expect(keepAppraisalForSale(kept, storage)).toBe(true);
  expect(takeAppraisalForSale(true, storage)).toEqual(kept);
  expect(takeAppraisalForSale(true, storage)).toBeNull();
  for (const broken of ["{broken", JSON.stringify({ brand: 1 }), JSON.stringify({ ...kept, value: "67400" })]) {
    data.set(TRADE_IN_KEY, broken);
    expect(takeAppraisalForSale(true, storage)).toBeNull();
    expect(data.size).toBe(0);
  }
  expect(keepAppraisalForSale(kept, { ...storage, setItem: () => { throw new Error("private window"); } })).toBe(false);
});

it("the state field keeps what was chosen after an answer, and the answer says the state it used", () => {
  // A select ignores a new defaultValue once mounted: it has to mount again with the typed state.
  expect(ConditionSelect({ value: "poor" }).key).toBe("poor");
  expect(ConditionSelect({ value: undefined }).key).toBe("good");
  const input = { brand: "Chevrolet", model: "Onix", year: 2020, km: 72000, condition: "poor" as const, reference: 80000, marginPct: 10 };
  const html = text(renderToStaticMarkup(createElement(AppraisalResult, { result: appraise({ ...base, condition: "poor" }, 2026), input })));
  expect(html).toContain("Estado ruim");
  expect(text(renderToStaticMarkup(createElement(AppraisalResult, { result: null, input })))).toContain("em estado ruim");
});

it("an appraisal kept in the browser never fills a seller's sale", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
  const kept = { brand: "Chevrolet", model: "Onix", year: 2020, km: 72000, value: 67400 };
  keepAppraisalForSale(kept, storage);
  expect(takeAppraisalForSale(false, storage)).toBeNull();
  expect(data.size).toBe(1);
  expect(takeAppraisalForSale(true, storage)).toEqual(kept);
});

it("the action answers with the state it used", async () => {
  guard.requireMember.mockResolvedValue(owner);
  expect((await appraiseAction({ error: null }, form({ condition: "fair" }))).input).toMatchObject({ condition: "fair" });
});
