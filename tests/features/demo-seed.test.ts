import { describe, expect, it } from "vitest";
import { DEMO_STAFF, DEMO_TABLES, buildDemoData, type DemoData, type DemoRow } from "@/features/demo/seed";

const STAFF = { renata: "m-renata", bruno: "m-bruno", larissa: "m-larissa", tiago: "m-tiago" };
const SELLERS = [STAFF.bruno, STAFF.larissa, STAFF.tiago];
const TODAY = "2026-11-13";

function build(today: string): DemoData {
  let n = 0;
  return buildDemoData({ today, staff: STAFF, newId: () => `id-${++n}` });
}

const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const day = (value: unknown) => String(value).slice(0, 10); // a date, or the local date of an ISO timestamp
const byId = (rows: DemoRow[]) => new Map(rows.map((row) => [row.id as string, row]));
const countBy = (rows: DemoRow[], key: (row: DemoRow) => unknown) => {
  const counts = new Map<unknown, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return counts;
};

const d = build(TODAY);
const inStock = d.vehicles.filter((v) => !["sold", "removed"].includes(v.status as string));
const finances = new Map(d.vehicle_finances.map((f) => [f.vehicle_id as string, f]));
const vehicles = byId(d.vehicles);
const leads = byId(d.leads);
const channelName = new Map(d.channels.map((c) => [c.id as string, c.name as string]));
const openLeads = d.leads.filter((lead) => !["won", "lost"].includes(lead.stage as string));

it("is deterministic and fills every table", () => {
  expect(build(TODAY)).toEqual(d);
  expect(Object.keys(d).sort()).toEqual([...DEMO_TABLES].sort());
  for (const table of DEMO_TABLES) expect(d[table].length, table).toBeGreaterThan(0);
  expect(d.leads.every((row) => !("store_id" in row))).toBe(true);
});

it("keeps 22 cars in stock between R$ 35 mil and R$ 150 mil", () => {
  expect(inStock).toHaveLength(22);
  for (const v of d.vehicles) {
    expect(v.price as number).toBeGreaterThanOrEqual(35_000);
    expect(v.price as number).toBeLessThanOrEqual(150_000);
  }
});

it("has exactly 2 cars in stock for more than 90 days", () => {
  expect(inStock.filter((v) => (v.entered_on as string) < addDays(TODAY, -90))).toHaveLength(2);
});

it("has 3 consigned cars in stock with a payout and no purchase price", () => {
  const consigned = inStock.filter((v) => v.source === "consignment");
  expect(consigned).toHaveLength(3);
  for (const v of consigned) {
    const f = finances.get(v.id as string)!;
    expect(f.purchase_price).toBe(0);
    expect(f.consignor_payout as number).toBeGreaterThan(0);
    expect(f.consignor_name).toBeTruthy();
  }
});

it("has 1 car away for service coming back after today", () => {
  const away = inStock.filter((v) => v.status === "away");
  expect(away).toHaveLength(1);
  expect(away[0].away_reason).toBe("service");
  expect(away[0].away_until as string > TODAY).toBe(true);
});

it("has 1 open reservation with a deposit on a car in stock", () => {
  const open = d.reservations.filter((r) => r.canceled_at === null && (r.expires_on as string) >= TODAY);
  expect(open).toHaveLength(1);
  expect(open[0].deposit as number).toBeGreaterThan(0);
  expect(vehicles.get(open[0].vehicle_id as string)!.status).toBe("available");
  expect(SELLERS).toContain(open[0].created_by);
});

it("has documents pending on at least 3 cars in stock and expenses on at least 5", () => {
  const stockIds = new Set(inStock.map((v) => v.id));
  const pending = new Set(d.vehicle_documents.filter((doc) => doc.status === "pending").map((doc) => doc.vehicle_id));
  expect([...pending].filter((id) => stockIds.has(id)).length).toBeGreaterThanOrEqual(3);
  const withExpenses = new Set(d.vehicle_expenses.map((e) => e.vehicle_id));
  expect([...withExpenses].filter((id) => stockIds.has(id)).length).toBeGreaterThanOrEqual(5);
});

it("sells 2 to 3 cars a week over the last 26 weeks", () => {
  expect(d.sales.length).toBeGreaterThanOrEqual(52);
  expect(d.sales.length).toBeLessThanOrEqual(78);
  for (const sale of d.sales) {
    expect(sale.sold_on as string >= addDays(TODAY, -181)).toBe(true);
    expect(sale.sold_on as string <= TODAY).toBe(true);
  }
});

it("ties each sale to a sold car, a seller and a won lead", () => {
  const nameOf = new Map(DEMO_STAFF.map((s) => [STAFF[s.key], s.name]));
  expect(new Set(d.sales.map((s) => s.vehicle_id)).size).toBe(d.sales.length);
  expect(d.vehicles.filter((v) => v.status === "sold")).toHaveLength(d.sales.length);
  for (const sale of d.sales) {
    expect(vehicles.get(sale.vehicle_id as string)!.status).toBe("sold");
    expect(SELLERS).toContain(sale.seller_id);
    expect(sale.seller_name).toBe(nameOf.get(sale.seller_id as string));
    expect(leads.get(sale.lead_id as string)!.stage).toBe("won");
  }
});

it("brings trade-ins into stock linked to their sale", () => {
  const sales = byId(d.sales);
  const tradeIns = d.vehicles.filter((v) => v.source === "trade_in");
  expect(tradeIns.filter((v) => inStock.includes(v)).length).toBeGreaterThanOrEqual(1);
  for (const v of tradeIns) {
    const sale = sales.get(v.acquired_in_sale_id as string)!;
    expect(sale.trade_in_vehicle_id).toBe(v.id);
    expect(finances.get(v.id as string)!.purchase_price).toBe(sale.trade_in_value);
    expect(v.entered_on).toBe(sale.sold_on);
  }
});

it("finances at least 30% of sales with a return from 2% to 6%", () => {
  const financed = d.sales.filter((s) => s.payment === "financing");
  expect(financed.length / d.sales.length).toBeGreaterThanOrEqual(0.3);
  const pct = new Map(d.sale_finances.map((f) => [f.sale_id, f.financing_return_pct as number]));
  expect(d.sale_finances).toHaveLength(financed.length);
  for (const sale of financed) {
    expect(pct.get(sale.id)).toBeGreaterThanOrEqual(0.02);
    expect(pct.get(sale.id)).toBeLessThanOrEqual(0.06);
    expect(sale.financed_amount as number).toBeLessThanOrEqual(sale.price as number);
  }
});

it("has a portal costing R$ 800 or more a month that sold at most 1 car", () => {
  const webmotors = d.channels.find((c) => c.name === "Webmotors")!;
  const costs = d.channel_costs.filter((c) => c.channel_id === webmotors.id);
  expect(costs).toHaveLength(7);
  expect(costs.every((c) => (c.amount as number) >= 800)).toBe(true);
  const sold = d.sales.filter((s) => leads.get(s.lead_id as string)!.channel_id === webmotors.id);
  expect(sold.length).toBeLessThanOrEqual(1);
  expect(d.leads.filter((lead) => lead.channel_id === webmotors.id).length).toBeGreaterThanOrEqual(5);
});

it("puts OLX and Instagram first in sales by channel", () => {
  const counts = countBy(d.sales, (s) => channelName.get(leads.get(s.lead_id as string)!.channel_id as string));
  const ranked = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([name]) => name);
  expect(ranked.slice(0, 2).sort()).toEqual(["Instagram", "OLX"]);
});

it("leaves Tiago behind his goal pace this month", () => {
  const month = TODAY.slice(0, 7);
  const tiago = d.sales.filter((s) => s.seller_id === STAFF.tiago && (s.sold_on as string).startsWith(month));
  const goal = d.goals.find((g) => g.member_id === STAFF.tiago && (g.month as string).startsWith(month))!;
  expect(tiago.length / (goal.cars as number)).toBeLessThan(13 / 30);
});

it("has at least 3 open leads with no contact for more than 3 days", () => {
  const stale = openLeads.filter((lead) => day(lead.last_contact_at ?? lead.created_at) < addDays(TODAY, -3));
  expect(stale.length).toBeGreaterThanOrEqual(3);
});

it("has warranties ending in 15 days and transfers pending for 25 days or more", () => {
  const ending = d.sales.filter((s) => (s.warranty_until as string) >= TODAY && (s.warranty_until as string) <= addDays(TODAY, 15));
  expect(ending.length).toBeGreaterThanOrEqual(2);
  const pending = d.sales.filter((s) => s.transfer_done_on === null && (s.sold_on as string) <= addDays(TODAY, -25));
  expect(pending.length).toBeGreaterThanOrEqual(2);
});

it("makes Tiago the slowest first response on average", () => {
  const minutes = new Map<unknown, number[]>();
  for (const lead of d.leads) {
    if (!lead.first_response_at) continue;
    const delay = (Date.parse(lead.first_response_at as string) - Date.parse(lead.created_at as string)) / 60_000;
    expect(delay).toBeGreaterThan(0);
    minutes.set(lead.seller_id, [...(minutes.get(lead.seller_id) ?? []), delay]);
  }
  const average = (id: string) => minutes.get(id)!.reduce((sum, m) => sum + m, 0) / minutes.get(id)!.length;
  expect(average(STAFF.tiago)).toBeGreaterThan(average(STAFF.bruno));
  expect(average(STAFF.tiago)).toBeGreaterThan(average(STAFF.larissa));
});

it("uses only fictional phones, e-mails and plates", () => {
  const phones = [...d.leads.map((l) => l.phone), ...d.vehicle_finances.map((f) => f.consignor_phone)].filter(Boolean);
  expect(phones.length).toBeGreaterThan(0);
  for (const phone of phones) expect(phone).toMatch(/^55839000\d{4}$/);
  for (const member of DEMO_STAFF) expect(member.email).toMatch(/@exemplo\.invalid$/);
  for (const v of d.vehicles) expect(v.plate).toMatch(/^ZZZ[0-9][A-Z0-9][0-9]{2}$/);
});

const DATE_KEYS = [
  "entered_on", "away_until", "spent_on", "visit_on", "came_on", "call_back_on", "sold_on", "warranty_until",
  "transfer_done_on", "expires_on", "month", "created_at", "first_response_at", "last_contact_at", "closed_at",
  "happened_at", "canceled_at",
];
const MAY_BE_FUTURE = new Set(["away_until", "expires_on", "call_back_on", "visit_on", "warranty_until"]);

describe.each(["2026-03-01", "2028-02-29", "2026-12-31", "2027-01-01"])("on %s", (today) => {
  const data = build(today);

  it("builds valid dates, none in the past part after today", () => {
    for (const table of DEMO_TABLES) {
      for (const row of data[table]) {
        for (const key of DATE_KEYS) {
          if (row[key] === null || row[key] === undefined) continue;
          const value = String(row[key]);
          expect(Number.isNaN(Date.parse(value)), `${table}.${key} ${value}`).toBe(false);
          expect(addDays(day(value), 0), `${table}.${key} ${value}`).toBe(day(value)); // no 2026-02-30
          if (!MAY_BE_FUTURE.has(key)) expect(day(value) <= today, `${table}.${key} ${value}`).toBe(true);
        }
      }
    }
  });

  it("does not put Tiago ahead of the other sellers this month", () => {
    const month = today.slice(0, 7);
    const sold = countBy(data.sales.filter((s) => (s.sold_on as string).startsWith(month)), (s) => s.seller_id);
    const tiago = sold.get(STAFF.tiago) ?? 0;
    expect(tiago).toBeLessThanOrEqual(Math.max(sold.get(STAFF.bruno) ?? 0, sold.get(STAFF.larissa) ?? 0));
  });
});
