import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { ClientesParados } from "@/components/gestao/painel/ClientesParados";
import { TempoResposta } from "@/components/gestao/relatorios/TempoResposta";
import { restoreDemoStore } from "@/features/demo/model";
import { recordContact, responseTimes, staleLeads } from "@/features/leads/contacts";
import { getStoreSettings, setStaleLeadDays } from "@/features/store/model";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

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
let seller: StoreMember;
let mine: string;
let colleagues: string;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  manager = { ...owner, role: "manager" };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  await restoreDemoStore(owner, TODAY);
  // A client of the seller that came in five days ago and nobody answered.
  mine = (
    await adminQuery(
      `insert into leads (store_id, name, phone, seller_id, created_at) values ($1, 'Cliente Novo', '5583900001234', $2, '2026-11-08 10:00-03') returning id`,
      [owner.storeId, seller.membershipId],
    )
  )[0].id;
  colleagues = (
    await adminQuery("select id from leads where store_id = $1 and closed_at is null and seller_id <> $2 limit 1", [owner.storeId, seller.membershipId])
  )[0].id;
});

const lead = async (id: string) =>
  (await adminQuery("select first_response_at as first, last_contact_at as last from leads where id = $1", [id]))[0] as { first: Date | null; last: Date | null };
const contacts = async (id: string) => (await adminQuery("select kind, member_id from lead_contacts where lead_id = $1 order by happened_at", [id])) as { kind: string; member_id: string }[];

it("a contact records the first response once and the last contact every time", async () => {
  expect(await recordContact(seller, mine, "whatsapp")).toEqual({ ok: true });
  const first = await lead(mine);
  expect(first.first).not.toBeNull();
  expect(first.last).toEqual(first.first);
  expect(await recordContact(seller, mine, "call")).toEqual({ ok: true });
  const second = await lead(mine);
  expect(second.first).toEqual(first.first);
  expect(second.last!.getTime()).toBeGreaterThanOrEqual(first.last!.getTime());
  expect(await contacts(mine)).toEqual([
    { kind: "whatsapp", member_id: seller.membershipId },
    { kind: "call", member_id: seller.membershipId },
  ]);
});

it("a seller records contact only on their own clients; a manager on any", async () => {
  const before = (await contacts(colleagues)).length;
  expect(await recordContact(seller, colleagues, "whatsapp")).toEqual({ ok: false, error: "forbidden" });
  expect(await contacts(colleagues)).toHaveLength(before);
  expect(await recordContact(manager, colleagues, "note")).toEqual({ ok: true });
  expect(await contacts(colleagues)).toHaveLength(before + 1);
  await adminQuery("update leads set stage = 'lost', closed_at = now() where id = $1", [mine]);
  expect(await recordContact(seller, mine, "whatsapp")).toEqual({ ok: false, error: "not_found" });
  expect(await recordContact(seller, "nope", "whatsapp")).toEqual({ ok: false, error: "not_found" });
  expect(await recordContact(seller, colleagues, "visit" as never)).toEqual({ ok: false, error: "not_found" });
});

const STALE = `select count(*)::int as n from leads where store_id = $1 and closed_at is null
  and $2::date - (coalesce(last_contact_at, created_at) at time zone 'America/Fortaleza')::date > $3
  and not coalesce(call_back_on >= $2::date, false) and not coalesce(visit_on >= $2::date, false)`;

it("lists the open clients with no contact for more than the store's days", async () => {
  const list = await staleLeads(seller, TODAY);
  expect(list).toHaveLength((await adminQuery(STALE, [owner.storeId, TODAY, 3]))[0].n);
  expect(list.every((l) => l.days > 3)).toBe(true);
  expect(list.map((l) => l.days)).toEqual([...list.map((l) => l.days)].sort((a, b) => b - a));
  expect(list.find((l) => l.id === mine)).toEqual({ id: mine, name: "Cliente Novo", sellerName: expect.any(String), days: 5, mine: true });
  expect((await staleLeads(owner, TODAY)).find((l) => l.id === mine)!.mine).toBe(false);

  // A client with a call back or a visit ahead is waiting, not stale.
  await adminQuery("update leads set stage = 'call_back', call_back_on = '2026-11-14' where id = $1", [mine]);
  expect((await staleLeads(owner, TODAY)).some((l) => l.id === mine)).toBe(false);
  await adminQuery("update leads set stage = 'new', call_back_on = null where id = $1", [mine]);

  expect(await setStaleLeadDays(manager, 10)).toEqual({ ok: true });
  expect((await getStoreSettings(owner)).staleLeadDays).toBe(10);
  const fewer = await staleLeads(owner, TODAY);
  expect(fewer).toHaveLength((await adminQuery(STALE, [owner.storeId, TODAY, 10]))[0].n);
  expect(fewer.some((l) => l.id === mine)).toBe(false);

  expect(await setStaleLeadDays(manager, 3)).toEqual({ ok: true });
  await recordContact(seller, mine, "note");
  expect((await staleLeads(owner, TODAY)).some((l) => l.id === mine)).toBe(false);
});

it("only owner and manager set the stale days, from 1 to 30", async () => {
  expect((await getStoreSettings(owner)).staleLeadDays).toBe(3);
  expect(await setStaleLeadDays(seller, 5)).toEqual({ ok: false, error: "forbidden" });
  for (const days of [0, 31, 2.5]) expect(await setStaleLeadDays(owner, days)).toEqual({ ok: false, error: "invalid" });
});

it("the response time of each seller matches the store's clients", async () => {
  const rows = await adminQuery(
    `select m.name as "sellerName", count(*)::int as leads, count(l.first_response_at)::int as answered,
            round(avg(extract(epoch from l.first_response_at - l.created_at) / 60))::int as "avgMinutes"
       from leads l join memberships m on m.id = l.seller_id
      where l.store_id = $1 and (l.created_at at time zone 'America/Fortaleza')::date between $2 and $3
      group by m.id, m.name`,
    [owner.storeId, NOV.de, NOV.ate],
  );
  const report = await responseTimes(manager, NOV);
  expect(report).toHaveLength(rows.length);
  for (const r of rows) expect(report).toContainEqual(r);
  expect(report.filter((r) => r.avgMinutes !== null).length).toBeGreaterThan(0);

  const own = await responseTimes(seller, NOV);
  expect(own).toEqual([{ sellerName: expect.any(String), leads: 1, answered: 0, avgMinutes: null }]);
});

it("the panel lists the stale clients, and nothing when there is none", () => {
  const leads = [
    { id: "l1", name: "Joana Lima", sellerName: "Bruno Farias", days: 5, mine: false },
    { id: "l2", name: "Caio Reis", sellerName: null, days: 4, mine: true },
  ];
  const html = text(renderToStaticMarkup(createElement(ClientesParados, { leads, days: 3 })));
  expect(html).toContain("2 clientes parados");
  expect(html).toContain("há 5 dias");
  expect(html).toContain("Joana Lima");
  expect(text(renderToStaticMarkup(createElement(ClientesParados, { leads: leads.slice(0, 1), days: 3 })))).toContain("1 cliente parado");
  expect(renderToStaticMarkup(createElement(ClientesParados, { leads: [], days: 3 }))).toBe("");
});

it("the report shows each seller's response time", () => {
  const rows = [
    { sellerName: "Bruno Farias", leads: 9, answered: 8, avgMinutes: 18 },
    { sellerName: "Tiago Dantas", leads: 7, answered: 7, avgMinutes: 125 },
    { sellerName: "Larissa Melo", leads: 2, answered: 0, avgMinutes: null },
  ];
  const html = text(renderToStaticMarkup(createElement(TempoResposta, { rows, own: false })));
  expect(html).toContain("18 min");
  expect(html).toContain("2 h 05 min");
  expect(html).toContain("Larissa Melo");
  expect(renderToStaticMarkup(createElement(TempoResposta, { rows: [], own: false }))).toBe("");
});
