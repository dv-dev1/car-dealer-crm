import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { restoreDemoStore } from "@/features/demo/model";
import {
  createLead, listChannels, listLeads, listSellers, loseLead, moveLead, updateLead, type LeadInput,
} from "@/features/leads/model";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const TODAY = "2026-11-13";

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

const input = (over: Partial<LeadInput> = {}): LeadInput => ({
  name: "Joana Lima", phone: "83991110000", stage: "new", vehicleId: null, interest: "Onix", channelId: null,
  sellerId: null, note: "", lastContactOn: null, visitOn: null, visitTime: null, cameOn: null, callBackOn: null, ...over,
});

let seed: Awaited<ReturnType<typeof seedTwoStores>>;
let owner: StoreMember;
let seller: StoreMember;
let carla: StoreMember;
let colleagueLead: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  carla = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla", storeName: "Loja B", isDemo: false };
  await restoreDemoStore(owner, TODAY);
  colleagueLead = (await adminQuery(
    "select id from leads where store_id = $1 and stage = 'negotiating' order by created_at limit 1", [owner.storeId],
  ))[0].id;
});

const created = async (ctx: StoreMember, over: Partial<LeadInput> = {}) => {
  const result = await createLead(ctx, input(over), TODAY);
  if (!result.ok) throw new Error(`createLead failed: ${result.error} ${result.field ?? ""}`);
  return result.id;
};
const row = async (id: string) => (await adminQuery("select * from leads where id = $1", [id]))[0];

it("loads open leads and the ones closed this month", async () => {
  const [car] = await adminQuery("select id from vehicles where store_id = $1 and status = 'available' limit 1", [owner.storeId]);
  const [won] = await adminQuery(
    `insert into leads (store_id, name, seller_id, stage, closed_at) values ($1, 'Comprou Agora', $2, 'won', '2026-11-10T15:00:00-03:00') returning id`,
    [owner.storeId, seed.a.beto.id],
  );
  await adminQuery(
    `insert into sales (store_id, vehicle_id, lead_id, seller_id, seller_name, sold_on, price, payment, bank, financed_amount, warranty_until)
     values ($1, $2, $3, $4, 'Beto', '2026-11-10', 70000, 'financing', 'BV', 30000, '2027-02-08')`,
    [owner.storeId, car.id, won.id, seed.a.beto.id],
  );
  await adminQuery(
    `insert into leads (store_id, name, stage, lost_reason, closed_at) values ($1, 'Perdeu Antes', 'lost', 'Achou caro', '2026-10-31T20:00:00-03:00')`,
    [owner.storeId],
  );
  const leads = await listLeads(owner, TODAY);
  const [{ open }] = await adminQuery("select count(*)::int as open from leads where store_id = $1 and stage not in ('won', 'lost')", [owner.storeId]);
  expect(leads.filter((l) => !["vendeu", "nao-comprou"].includes(l.estagio))).toHaveLength(open);
  expect(leads.find((l) => l.nome === "Perdeu Antes")).toBeUndefined();
  for (const l of leads.filter((l) => l.fechadoEm)) expect(l.fechadoEm!.startsWith("2026-11")).toBe(true);
  expect(leads.find((l) => l.nome === "Comprou Agora")).toMatchObject({
    estagio: "vendeu", fechadoEm: "2026-11-10", valorVenda: 70000, formaPagamento: "Financiamento", sellerName: "Beto",
  });
});

it("a seller creates a lead for themselves and cannot name another seller", async () => {
  const id = await created(seller);
  expect((await row(id)).seller_id).toBe(seed.a.beto.id);
  expect(await createLead(seller, input({ sellerId: seed.a.ana.id }), TODAY)).toEqual({ ok: false, error: "forbidden" });
});

it("normalizes the phone", async () => {
  const masked = await created(owner, { phone: "(83) 99111-0000" });
  const bare = await created(owner, { phone: "83991110000" });
  expect((await row(masked)).phone).toBe("5583991110000");
  expect((await row(bare)).phone).toBe("5583991110000");
  expect((await listLeads(owner, TODAY)).find((l) => l.id === masked)?.telefoneLabel).toBe("(83) 99111-0000");
  expect(await createLead(owner, input({ phone: "9911" }), TODAY)).toEqual({ ok: false, error: "invalid", field: "phone" });
  const none = await created(owner, { phone: "" });
  expect((await row(none)).phone).toBeNull();
});

it("a seller moves and edits only their own leads", async () => {
  const own = await created(seller);
  expect(await moveLead(seller, colleagueLead, "call_back")).toEqual({ ok: false, error: "forbidden" });
  expect(await updateLead(seller, colleagueLead, input(), TODAY)).toEqual({ ok: false, error: "forbidden" });
  expect((await row(colleagueLead)).stage).toBe("negotiating");
  expect(await moveLead(seller, own, "call_back")).toEqual({ ok: true, id: own });
  expect((await row(own)).stage).toBe("call_back");
  const seen = await listLeads(seller, TODAY);
  expect(seen.find((l) => l.id === colleagueLead)?.canEdit).toBe(false);
  expect(seen.find((l) => l.id === own)?.canEdit).toBe(true);
});

it("a manager reassigns a lead to another seller", async () => {
  expect(await updateLead(owner, colleagueLead, input({ sellerId: seed.a.beto.id, stage: "negotiating" }), TODAY)).toEqual({ ok: true, id: colleagueLead });
  expect((await row(colleagueLead)).seller_id).toBe(seed.a.beto.id);
  expect(await updateLead(owner, colleagueLead, input({ sellerId: seed.b.carla.id }), TODAY)).toEqual({ ok: false, error: "invalid", field: "sellerId" });
});

it("loses a lead with the reason and refuses to touch a closed one", async () => {
  expect(await loseLead(owner, colleagueLead, "Achou caro")).toEqual({ ok: true, id: colleagueLead });
  const lost = await row(colleagueLead);
  expect(lost.stage).toBe("lost");
  expect(lost.lost_reason).toBe("Achou caro");
  expect(lost.closed_at).not.toBeNull();
  expect(await moveLead(owner, colleagueLead, "new")).toEqual({ ok: false, error: "not_editable" });
  expect(await updateLead(owner, colleagueLead, input(), TODAY)).toEqual({ ok: false, error: "not_editable" });
  expect(await loseLead(owner, colleagueLead, null)).toEqual({ ok: false, error: "not_editable" });
});

it("does not reach another store's lead", async () => {
  expect(await moveLead(carla, colleagueLead, "new")).toEqual({ ok: false, error: "not_found" });
  expect(await moveLead(owner, "not-a-uuid", "new")).toEqual({ ok: false, error: "not_found" });
  expect((await listLeads(carla, TODAY)).find((l) => l.id === colleagueLead)).toBeUndefined();
});

it("checks dates, the car and the channel", async () => {
  expect(await createLead(owner, input({ visitOn: "2026-02-31" }), TODAY)).toEqual({ ok: false, error: "invalid", field: "visitOn" });
  expect(await createLead(owner, input({ cameOn: "2026-11-14" }), TODAY)).toEqual({ ok: false, error: "invalid", field: "cameOn" });
  expect(await createLead(owner, input({ visitTime: "25:00" }), TODAY)).toEqual({ ok: false, error: "invalid", field: "visitTime" });
  expect(await createLead(owner, input({ name: "  " }), TODAY)).toEqual({ ok: false, error: "invalid", field: "name" });
  const [other] = await adminQuery("insert into channels (store_id, name) values ($1, 'Outra') returning id", [seed.b.storeId]);
  expect(await createLead(owner, input({ channelId: other.id }), TODAY)).toEqual({ ok: false, error: "invalid", field: "channelId" });
  expect(await createLead(owner, input({ vehicleId: "00000000-0000-4000-8000-000000000000" }), TODAY)).toEqual({ ok: false, error: "invalid", field: "vehicleId" });
});

it("records the car, channel, dates and note and shows them back", async () => {
  const [car] = await adminQuery("select id, brand, model, version from vehicles where store_id = $1 and status = 'available' limit 1", [owner.storeId]);
  const [channel] = await listChannels(owner);
  const id = await created(seller, {
    vehicleId: car.id, interest: null, channelId: channel.id, stage: "visit_scheduled", note: "Quer trocar o Gol",
    lastContactOn: "2026-11-12", visitOn: "2026-11-15", visitTime: "10:30", callBackOn: "2026-11-20",
  });
  expect((await listLeads(seller, TODAY)).find((l) => l.id === id)).toMatchObject({
    carro: `${car.brand} ${car.model} ${car.version}`, vehicleId: car.id, origem: channel.name, channelId: channel.id,
    estagio: "visita-marcada", nota: "Quer trocar o Gol", conversaEm: "2026-11-12", visitaEm: "2026-11-15",
    horaVisita: "10:30", retornarEm: "2026-11-20", sellerName: "Beto",
  });
});

it("lists the store's channels and members", async () => {
  const channels = await listChannels(owner);
  expect(channels.length).toBeGreaterThan(0);
  expect(channels.map((c) => c.name)).toEqual([...channels.map((c) => c.name)].sort((x, y) => x.localeCompare(y, "pt-BR")));
  const sellers = await listSellers(owner);
  expect(sellers.map((s) => s.name)).toEqual(expect.arrayContaining(["Ana", "Beto"]));
  expect(sellers.map((s) => s.name)).not.toContain("Carla");
});
