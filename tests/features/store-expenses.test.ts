import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { AvisoMes } from "@/components/gestao/painel/AvisoMes";
import { restoreDemoStore } from "@/features/demo/model";
import { addStoreExpense, listStoreExpenses, monthBreakEven, removeStoreExpense } from "@/features/store/expenses";
import { withStore, type StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const TODAY = "2026-11-13";
const MONTH = "2026-11-01";
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

const rent = (over: Record<string, unknown> = {}) => ({ month: MONTH, category: "rent" as const, description: "Aluguel extra", amount: 6500, ...over });

it("only the owner records and reads the fixed expenses", async () => {
  const before = (await listStoreExpenses(owner, MONTH))!.length;
  const added = await addStoreExpense(owner, rent());
  if (!added.ok) throw new Error(added.error);
  const list = (await listStoreExpenses(owner, MONTH))!;
  expect(list).toHaveLength(before + 1);
  expect(list).toContainEqual({ id: added.id, category: "rent", description: "Aluguel extra", amount: 6500 });
  for (const other of [manager, seller]) {
    expect(await listStoreExpenses(other, MONTH)).toBeNull();
    expect(await addStoreExpense(other, rent())).toEqual({ ok: false, error: "forbidden" });
    expect(await removeStoreExpense(other, added.id)).toEqual({ ok: false, error: "forbidden" });
    expect(await monthBreakEven(other, TODAY)).toBeNull();
    expect(await withStore(other, (db) => db.query("select * from store_expenses"))).toEqual([]);
  }
  expect(await removeStoreExpense(owner, added.id)).toEqual({ ok: true });
  expect(await removeStoreExpense(owner, added.id)).toEqual({ ok: false, error: "not_found" });
});

it("refuses a bad fixed expense", async () => {
  for (const over of [{ amount: 0 }, { category: "x" }, { month: "2026-11-13" }, { description: "x".repeat(201) }]) {
    expect(await addStoreExpense(owner, rent(over) as never)).toEqual({ ok: false, error: "invalid" });
  }
});

const sum = async (sql: string) => Number((await adminQuery(sql, [owner.storeId]))[0].n);

it("says how many cars are left to pay the month", async () => {
  const fixed = await sum("select coalesce(sum(amount), 0) as n from store_expenses where store_id = $1 and month = '2026-11-01'");
  const channels = await sum("select coalesce(sum(amount), 0) as n from channel_costs where store_id = $1 and month = '2026-11-01'");
  const profit = await sum(
    "select coalesce(sum(p.profit), 0) as n from sales s join sale_profits p on p.sale_id = s.id where s.store_id = $1 and s.sold_on between '2026-11-01' and '2026-11-30'",
  );
  const avg = await sum(
    "select avg(p.profit) as n from sales s join sale_profits p on p.sale_id = s.id where s.store_id = $1 and s.sold_on between '2026-08-01' and '2026-10-31'",
  );
  const result = (await monthBreakEven(owner, TODAY))!;
  expect(result.fixed).toBe(fixed);
  expect(result.channels).toBe(channels);
  expect(result.profit).toBeCloseTo(profit, 2);
  expect(result.avgProfitPerCar).toBeCloseTo(avg, 2);
  expect(result.carsLeft).toBe(Math.max(0, Math.ceil((fixed + channels - profit) / avg)));
});

it("a paid month leaves zero cars, and no recent sale leaves no estimate", async () => {
  await adminQuery("delete from store_expenses where store_id = $1", [owner.storeId]);
  await adminQuery("delete from channel_costs where store_id = $1", [owner.storeId]);
  expect((await monthBreakEven(owner, TODAY))!.carsLeft).toBe(0);
  await addStoreExpense(owner, rent({ amount: 9_000_000 }));
  await adminQuery(
    "update sales set sold_on = sold_on - 365, warranty_until = warranty_until - 365 where store_id = $1 and sold_on between '2026-08-01' and '2026-10-31'",
    [owner.storeId],
  );
  expect(await monthBreakEven(owner, TODAY)).toMatchObject({ avgProfitPerCar: null, carsLeft: null });
});

it("the panel notice says cars left, or that the month is paid, or nothing", () => {
  const base = { fixed: 18600, channels: 3170, profit: 9000, avgProfitPerCar: 6000 };
  const render = (carsLeft: number | null) => text(renderToStaticMarkup(createElement(AvisoMes, { mes: { ...base, carsLeft } })));
  expect(render(3)).toContain("Faltam 3 carros para pagar o mês");
  expect(render(1)).toContain("Falta 1 carro para pagar o mês");
  expect(render(0)).toContain("O mês já está pago");
  expect(render(null)).not.toMatch(/Falta|pago/);
  expect(text(renderToStaticMarkup(createElement(AvisoMes, { mes: null })))).toBe("");
});
