import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { RankingVendedores } from "@/components/gestao/relatorios/RankingVendedores";
import { restoreDemoStore } from "@/features/demo/model";
import { sellerRanking, setSellerGoal } from "@/features/reports/seller-goals";
import { withStore, type StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
vi.mock("@/features/reports/actions", () => ({ setSellerGoalAction: vi.fn() }));

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
let otherStoreMember: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  manager = { ...owner, role: "manager" };
  otherStoreMember = (await adminQuery("select id from memberships where store_id = $1 limit 1", [seed.b.storeId]))[0].id;
  await restoreDemoStore(owner, TODAY);
  // A seller of the demo team, with a goal and sales.
  const [bruno] = await adminQuery("select id from memberships where store_id = $1 and name = 'Bruno Farias'", [owner.storeId]);
  seller = { ...owner, membershipId: bruno.id, role: "seller", name: "Bruno Farias" };
});

it("ranks the sellers by the month's sales, with each one's goal", async () => {
  const sold = await adminQuery(
    `select seller_id as id, count(*)::int as n from sales
      where store_id = $1 and sold_on between '2026-11-01' and '2026-11-30' and seller_id is not null group by 1`,
    [owner.storeId],
  );
  const ranking = await sellerRanking(owner, TODAY);
  for (const s of sold) expect(ranking.find((r) => r.memberId === s.id)!.sold).toBe(s.n);
  expect(ranking.map((r) => r.sold)).toEqual([...ranking.map((r) => r.sold)].sort((a, b) => b - a));
  for (const name of ["Bruno Farias", "Larissa Melo", "Tiago Dantas"]) {
    expect(ranking.find((r) => r.name === name)).toMatchObject({ goal: 4, mine: false });
  }
  // A seller with no goal this month is ranked with their sales.
  expect(ranking.find((r) => r.name === "Beto")).toMatchObject({ sold: 0, goal: null });
});

it("a seller sees the ranking and only their own goal", async () => {
  const ranking = await sellerRanking(seller, TODAY);
  expect(ranking.map((r) => r.name)).toEqual((await sellerRanking(owner, TODAY)).map((r) => r.name));
  expect(ranking.find((r) => r.mine)).toMatchObject({ name: "Bruno Farias", goal: 4 });
  expect(ranking.filter((r) => !r.mine).every((r) => r.goal === null)).toBe(true);
  const direct = await withStore(seller, (db) => db.query<{ member_id: string | null }>("select member_id from goals"));
  expect(direct.every((g) => g.member_id === null || g.member_id === seller.membershipId)).toBe(true);
});

it("owner and manager set and remove a seller's goal", async () => {
  const goal = async () => (await sellerRanking(owner, TODAY)).find((r) => r.memberId === seller.membershipId)!.goal;
  expect(await setSellerGoal(manager, seller.membershipId, 6, TODAY)).toEqual({ ok: true });
  expect(await goal()).toBe(6);
  expect(await setSellerGoal(owner, seller.membershipId, null, TODAY)).toEqual({ ok: true });
  expect(await goal()).toBeNull();
  expect(await setSellerGoal(owner, seller.membershipId, 5, TODAY)).toEqual({ ok: true });
  expect(await goal()).toBe(5);

  expect(await setSellerGoal(seller, seller.membershipId, 9, TODAY)).toEqual({ ok: false, error: "forbidden" });
  for (const cars of [0, 100, 2.5]) expect(await setSellerGoal(owner, seller.membershipId, cars, TODAY)).toEqual({ ok: false, error: "invalid" });
  for (const id of [otherStoreMember, "nope"]) expect(await setSellerGoal(owner, id, 5, TODAY)).toEqual({ ok: false, error: "not_found" });
  expect(await goal()).toBe(5);
});

it("the ranking shows the pace of who has a goal, and the goal form only to who manages", () => {
  const rows = [
    { memberId: "m1", name: "Bruno Farias", sold: 3, goal: 4, mine: false },
    { memberId: "m2", name: "Larissa Melo", sold: 1, goal: null, mine: false },
    { memberId: "m3", name: "Tiago Dantas", sold: 0, goal: 4, mine: true },
  ];
  const render = (canEdit: boolean) => text(renderToStaticMarkup(createElement(RankingVendedores, { rows, canEdit, today: TODAY })));
  const html = render(true);
  expect(html).toMatch(/1º\s+Bruno Farias/);
  expect(html).toContain("3 de 4");
  expect(html).toMatch(/Faltam 1/);
  expect(html).toMatch(/Larissa Melo\s+1 venda(?! de)/);
  expect(html).toContain("0 de 4");
  expect(html).toContain("Definir meta");
  expect(render(false)).not.toMatch(/Definir meta|Salvar/);
  expect(renderToStaticMarkup(createElement(RankingVendedores, { rows: [], canEdit: true, today: TODAY }))).toBe("");
});
