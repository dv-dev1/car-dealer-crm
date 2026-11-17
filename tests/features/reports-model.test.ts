import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import { loadGoal, loadReport, setStoreGoal } from "@/features/reports/model";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const TODAY = "2026-11-13";
const NOV = { de: "2026-11-01", ate: "2026-11-30" };

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
let carla: StoreMember;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  carla = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla", storeName: "Loja B", isDemo: false };
  await restoreDemoStore(owner, TODAY);
});

it("an owner sees each sale's profit from the car's real cost", async () => {
  const { vendas } = await loadReport(owner, NOV, TODAY);
  const rows = await adminQuery(
    `select s.id, (s.price - coalesce(c.cost, 0))::float8 as lucro
       from sales s left join vehicle_costs c on c.vehicle_id = s.vehicle_id
      where s.store_id = $1 and s.sold_on between '2026-11-01' and '2026-11-30'`,
    [owner.storeId],
  );
  expect(rows.length).toBeGreaterThan(0);
  expect(Object.fromEntries(vendas.map((v) => [v.id, v.lucro]))).toEqual(Object.fromEntries(rows.map((r) => [r.id, r.lucro])));
});

it("a seller gets the store's sales without profit", async () => {
  const dono = await loadReport(owner, NOV, TODAY);
  const vendedor = await loadReport(seller, NOV, TODAY);
  expect(vendedor.vendas.map((v) => v.id)).toEqual(dono.vendas.map((v) => v.id));
  expect(vendedor.vendas.every((v) => v.lucro === null)).toBe(true);
  expect(vendedor.vendasDoAno.length).toBe(dono.vendasDoAno.length);
  expect(vendedor.vendasDoAno.every((v) => v.lucro === null)).toBe(true);
});

it("counts a sale without a lead in the report and the goal", async () => {
  const before = await loadGoal(owner, TODAY);
  const [car] = await adminQuery("select id from vehicles where store_id = $1 and status = 'available' limit 1", [owner.storeId]);
  const [sale] = await adminQuery(
    `insert into sales (store_id, vehicle_id, seller_id, seller_name, sold_on, price, payment, warranty_until)
     values ($1, $2, $3, 'Ana', '2026-11-12', 70000, 'cash', '2027-02-10') returning id`,
    [owner.storeId, car.id, owner.membershipId],
  );
  const { vendas } = await loadReport(owner, NOV, TODAY);
  expect(vendas.find((v) => v.id === sale.id)).toMatchObject({
    clienteNome: null, vendedor: "Ana", formaPagamento: "À vista", valor: 70000, dataVenda: "2026-11-12",
  });
  expect((await loadGoal(owner, TODAY)).feito).toBe(before.feito + 1);
});

it("the funnel counts the leads that entered in the window, by the store's day", async () => {
  const lead = (name: string, extra: string, values: string) =>
    adminQuery(`insert into leads (store_id, name, ${extra}) values ($1, '${name}', ${values})`, [carla.storeId]);
  await lead("Noite de Outubro", "created_at", "'2026-10-31T22:30:00-03:00'");
  await lead("Veio", "created_at, came_on", "'2026-11-02T10:00:00-03:00', '2026-11-04'");
  await lead("Comprou", "created_at, stage, closed_at", "'2026-11-03T10:00:00-03:00', 'won', '2026-11-05T10:00:00-03:00'");
  expect((await loadReport(carla, NOV, TODAY)).funil).toEqual({ entraram: 2, vieram: 2, compraram: 1 });
  expect((await loadReport(carla, { de: "2026-10-01", ate: "2026-10-31" }, TODAY)).funil).toEqual({ entraram: 1, vieram: 0, compraram: 0 });
});

it("loads the store goal and the month's open negotiations", async () => {
  const [count] = await adminQuery(
    `select (select count(*)::int from sales where store_id = $1 and sold_on between '2026-11-01' and '2026-11-30') as feito,
            (select count(*)::int from leads where store_id = $1 and stage = 'negotiating') as negociando,
            (select count(*)::int from leads where store_id = $1 and stage = 'call_back') as retorno`,
    [owner.storeId],
  );
  const goal = await loadGoal(owner, TODAY);
  expect(goal).toEqual({ alvo: 12, feito: count.feito, emNegociacao: count.negociando, aguardandoRetorno: count.retorno });
  expect(await loadGoal(seller, TODAY)).toEqual(goal);
});

it("a month without a goal has no target", async () => {
  const before = await loadGoal(owner, TODAY);
  await adminQuery("delete from goals where store_id = $1", [owner.storeId]);
  expect(await loadGoal(owner, TODAY)).toEqual({ ...before, alvo: null });
});

it("owner and manager set the goal; a seller cannot", async () => {
  await adminQuery("delete from goals where store_id = $1", [owner.storeId]);
  const [mara] = await adminQuery(
    "insert into memberships (store_id, name, email, role) values ($1, 'Mara', 'mara@lojaa.com', 'manager') returning id",
    [owner.storeId],
  );
  const manager: StoreMember = { ...owner, membershipId: mara.id, role: "manager", name: "Mara" };
  const goals = () =>
    adminQuery("select cars from goals where store_id = $1 and month = '2026-11-01' and member_id is null", [owner.storeId]);
  expect(await setStoreGoal(owner, 15, TODAY)).toEqual({ ok: true });
  expect(await setStoreGoal(manager, 16, TODAY)).toEqual({ ok: true });
  expect(await goals()).toEqual([{ cars: 16 }]);
  expect(await setStoreGoal(seller, 3, TODAY)).toEqual({ ok: false, error: "forbidden" });
  for (const bad of [0, 100, 2.5]) expect(await setStoreGoal(owner, bad, TODAY)).toEqual({ ok: false, error: "invalid" });
  expect(await goals()).toEqual([{ cars: 16 }]);
});
