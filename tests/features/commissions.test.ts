import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { listCommissions, listRules, setRule } from "@/features/commissions/model";
import { restoreDemoStore } from "@/features/demo/model";
import { withStore, type StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
vi.mock("@/features/commissions/actions", () => ({ setRuleAction: vi.fn(), removeRuleAction: vi.fn() }));

const TODAY = "2026-11-13";
const NOV = { de: "2026-11-01", ate: "2026-11-30" };
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
let larissa: StoreMember;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  await restoreDemoStore(owner, TODAY);
  const staff = async (name: string) =>
    (await adminQuery("select id from memberships where store_id = $1 and name = $2", [owner.storeId, name]))[0].id as string;
  manager = { ...owner, membershipId: await staff("Renata Albuquerque"), role: "manager", name: "Renata Albuquerque" };
  larissa = { ...owner, membershipId: await staff("Larissa Melo"), role: "seller", name: "Larissa Melo" };
});

const expected = async () => {
  const rows = await adminQuery(
    `select s.id, s.seller_id, p.profit::float8 as profit from sales s join sale_profits p on p.sale_id = s.id
      where s.store_id = $1 and s.sold_on between $2 and $3`,
    [owner.storeId, NOV.de, NOV.ate],
  );
  return Object.fromEntries(
    rows.map((r) => [r.id, r.seller_id === larissa.membershipId ? Math.round(Math.max(0, r.profit) * 0.1 * 100) / 100 : 350]),
  );
};

it("each sale's commission follows the store rule or the seller's own", async () => {
  const { sales, bySeller } = await listCommissions(owner, NOV);
  expect(sales.length).toBeGreaterThan(0);
  expect(Object.fromEntries(sales.map((s) => [s.id, s.commission]))).toEqual(await expected());
  const total = bySeller.reduce((sum, s) => sum + s.total, 0);
  expect(total).toBeCloseTo(sales.reduce((sum, s) => sum + s.commission, 0), 2);
  expect(bySeller.some((s) => s.sellerName === "Larissa Melo")).toBe(true);
});

it("a seller reads only their own commissions, and no rule", async () => {
  const { sales, bySeller } = await listCommissions(larissa, NOV);
  expect(sales.length).toBeGreaterThan(0);
  expect(sales.every((s) => s.sellerName === "Larissa Melo")).toBe(true);
  expect(bySeller.map((s) => s.sellerName)).toEqual(["Larissa Melo"]);
  expect(await listRules(larissa)).toBeNull();
  const direct = await withStore(larissa, async (db) => ({
    rules: await db.query("select * from commission_rules"),
    others: await db.query("select * from sale_commissions('2000-01-01', '2100-01-01') where seller_id is distinct from $1", [larissa.membershipId]),
  }));
  expect(direct).toEqual({ rules: [], others: [] });
});

it("a negative profit pays no commission", async () => {
  const [sale] = await adminQuery(
    "select id, vehicle_id from sales where store_id = $1 and seller_id = $2 and sold_on between $3 and $4 limit 1",
    [owner.storeId, larissa.membershipId, NOV.de, NOV.ate],
  );
  await adminQuery(
    "insert into vehicle_expenses (store_id, vehicle_id, category, spent_on, amount) values ($1, $2, 'other', $3, 900000)",
    [owner.storeId, sale.vehicle_id, TODAY],
  );
  expect((await listCommissions(owner, NOV)).sales.find((s) => s.id === sale.id)!.commission).toBe(0);
});

it("a sale whose seller left keeps the store rule", async () => {
  const [sale] = await adminQuery(
    "select id, seller_name from sales where store_id = $1 and seller_id <> $2 and sold_on between $3 and $4 limit 1",
    [owner.storeId, larissa.membershipId, NOV.de, NOV.ate],
  );
  await adminQuery("update sales set seller_id = null where id = $1", [sale.id]);
  expect((await listCommissions(owner, NOV)).sales.find((s) => s.id === sale.id)).toMatchObject({ commission: 350, sellerName: sale.seller_name });
});

it("only the owner sets rules", async () => {
  expect(await setRule(manager, { memberId: null, kind: "sale_pct", value: 2 })).toEqual({ ok: false, error: "forbidden" });
  expect(await setRule(owner, { memberId: null, kind: "sale_pct", value: 2 })).toEqual({ ok: true });
  const [sale] = (await listCommissions(owner, NOV)).sales.filter((s) => s.sellerName !== "Larissa Melo");
  expect(sale.commission).toBe(Math.round(sale.price * 0.02 * 100) / 100);
  expect(await listRules(manager)).toContainEqual({ memberId: null, kind: "sale_pct", value: 2 });
  // 0.07 * 100 is 7.000000000000001 in floating point: the rule reads back as typed.
  for (const value of [7, 2.9, 3.55]) {
    expect(await setRule(owner, { memberId: null, kind: "profit_pct", value })).toEqual({ ok: true });
    expect(await listRules(owner)).toContainEqual({ memberId: null, kind: "profit_pct", value });
  }
  expect(await setRule(owner, { memberId: null, kind: "sale_pct", value: 2 })).toEqual({ ok: true });
  for (const rule of [{ kind: "fixed", value: 0 }, { kind: "sale_pct", value: 101 }, { kind: "profit_pct", value: 0 }, { kind: "x", value: 1 }]) {
    expect(await setRule(owner, { memberId: null, ...rule } as never)).toEqual({ ok: false, error: "invalid" });
  }
});

it("the screen shows rules to the owner, totals to the manager and own commissions to a seller", async () => {
  const { CommissionsView } = await import("@/features/commissions/view");
  const data = { sales: [], bySeller: [{ sellerName: "Bruno Farias", sales: 2, total: 700 }] };
  const sellers = [{ id: "m1", name: "Bruno Farias" }];
  const rules = [{ memberId: null, kind: "fixed" as const, value: 350 }];
  const render = (role: "owner" | "manager" | "seller") =>
    text(renderToStaticMarkup(createElement(CommissionsView, { role, data, rules: role === "seller" ? null : rules, sellers, rotulo: "Novembro" })));
  expect(render("owner")).toContain("Regra da loja");
  expect(render("owner")).toContain("Exceções");
  expect(render("manager")).toMatch(/Bruno Farias.*R\$\s?700/);
  expect(render("manager")).not.toContain("Salvar regra");
  expect(render("seller")).toContain("Suas comissões");
  expect(render("seller")).not.toContain("Regra");
});
