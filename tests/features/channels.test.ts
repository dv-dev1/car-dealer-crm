import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { beforeEach, expect, it, vi } from "vitest";
import { addChannel, channelReport, listChannelSettings, setChannelActive, setChannelCost } from "@/features/channels/model";
import { restoreDemoStore } from "@/features/demo/model";
import { listChannels } from "@/features/leads/model";
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
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  manager = { ...owner, role: "manager" };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  await restoreDemoStore(owner, TODAY);
});

const cents = (n: number) => Math.round(n * 100) / 100;

it("each channel's leads, sales, cost and profit match the store's rows", async () => {
  const rows = await adminQuery(
    `select c.id, c.name,
            (select count(*)::int from leads l where l.channel_id = c.id and (l.created_at at time zone 'America/Fortaleza')::date between $2 and $3) as leads,
            (select count(*)::int from sales s join leads l on l.id = s.lead_id where l.channel_id = c.id and s.sold_on between $2 and $3) as sales,
            (select coalesce(sum(amount), 0)::float8 from channel_costs k where k.channel_id = c.id and k.month between date_trunc('month', $2::date) and $3) as cost,
            (select coalesce(sum(p.profit), 0)::float8 from sales s join leads l on l.id = s.lead_id join sale_profits p on p.sale_id = s.id
              where l.channel_id = c.id and s.sold_on between $2 and $3) as profit
       from channels c where c.store_id = $1`,
    [owner.storeId, NOV.de, NOV.ate],
  );
  const report = (await channelReport(owner, NOV))!;
  expect(report.filter((c) => c.id !== "none")).toHaveLength(rows.length);
  for (const r of rows) {
    expect(report.find((c) => c.id === r.id)).toEqual({
      id: r.id, name: r.name, leads: r.leads, sales: r.sales, cost: r.cost, profit: r.profit,
      conversion: r.leads ? r.sales / r.leads : null,
      costPerLead: r.leads ? cents(r.cost / r.leads) : null,
      costPerSale: r.sales ? cents(r.cost / r.sales) : null,
    });
  }
  const indicacao = report.find((c) => c.name === "Indicação")!;
  expect(indicacao.cost).toBe(0);
  expect(indicacao.costPerSale).toBe(indicacao.sales ? 0 : null);
});

it("a seller gets no channel report; a manager reads but does not write", async () => {
  expect(await channelReport(seller, NOV)).toBeNull();
  expect(await channelReport(manager, NOV)).not.toBeNull();
  expect(await listChannelSettings(manager, "2026-11-01")).toBeNull();
  expect(await addChannel(manager, "Facebook")).toEqual({ ok: false, error: "forbidden" });
});

it("the owner adds channels, sets the month's cost and turns a channel off", async () => {
  expect(await addChannel(owner, "Facebook")).toEqual({ ok: true });
  expect(await addChannel(owner, " facebook ")).toEqual({ ok: false, error: "duplicate" });
  expect(await addChannel(owner, " ")).toEqual({ ok: false, error: "invalid" });
  const facebook = (await listChannelSettings(owner, "2026-11-01"))!.find((c) => c.name === "Facebook")!;
  expect(facebook).toMatchObject({ active: true, cost: 0 });
  expect(await setChannelCost(owner, facebook.id, "2026-11-01", 1290)).toEqual({ ok: true });
  expect(await setChannelCost(owner, facebook.id, "2026-11-01", -1)).toEqual({ ok: false, error: "invalid" });
  expect(await setChannelCost(owner, facebook.id, "2026-11-15", 10)).toEqual({ ok: false, error: "invalid" });
  expect((await listChannelSettings(owner, "2026-11-01"))!.find((c) => c.name === "Facebook")!.cost).toBe(1290);
  expect(await setChannelActive(owner, facebook.id, false)).toEqual({ ok: true });
  expect((await listChannels(owner)).some((c) => c.name === "Facebook")).toBe(false);
  expect((await channelReport(owner, NOV))!.some((c) => c.name === "Facebook")).toBe(true);
});

it("the report table shows dashes where there is nothing to divide", async () => {
  const { CanaisTabela } = await import("@/components/gestao/relatorios/CanaisTabela");
  const html = text(renderToStaticMarkup(createElement(CanaisTabela, {
    canais: [
      { id: "1", name: "OLX", leads: 10, sales: 2, conversion: 0.2, cost: 1290, costPerLead: 129, costPerSale: 645, profit: 18000 },
      { id: "2", name: "Passante", leads: 0, sales: 0, conversion: null, cost: 0, costPerLead: null, costPerSale: null, profit: 0 },
    ],
  })));
  expect(html).toContain("OLX");
  expect(html).toContain("20%");
  expect(html).toMatch(/R\$\s?645/);
  expect(html).toContain("Passante —");
});

it("a partial period carries only its days of the month's cost", async () => {
  const olx = (await channelReport(owner, { de: "2026-11-01", ate: "2026-11-10" }))!.find((c) => c.name === "OLX")!;
  expect(olx.cost).toBe(430); // R$ 1.290 in a 30-day month, 10 days
  expect((await channelReport(owner, { de: "2026-10-22", ate: "2026-11-10" }))!.find((c) => c.name === "OLX")!.cost).toBeCloseTo(
    430 + (1290 * 10) / 31,
    2,
  );
});

it("sales and clients with no channel show as their own line, so the table adds up", async () => {
  const [{ n: total }] = await adminQuery("select count(*)::int as n from sales where store_id = $1 and sold_on between $2 and $3", [
    owner.storeId, NOV.de, NOV.ate,
  ]);
  const before = (await channelReport(owner, NOV))!;
  expect(before.reduce((sum, c) => sum + c.sales, 0)).toBe(total);
  await adminQuery(
    "update sales set lead_id = null where id = (select id from sales where store_id = $1 and sold_on between $2 and $3 limit 1)",
    [owner.storeId, NOV.de, NOV.ate],
  );
  const after = (await channelReport(owner, NOV))!;
  expect(after.reduce((sum, c) => sum + c.sales, 0)).toBe(total);
  const none = after.find((c) => c.id === "none")!;
  expect(none).toMatchObject({ name: "Sem canal", cost: 0, costPerSale: 0 });
  expect(none.sales).toBeGreaterThanOrEqual(1);
});
