import type { Janela } from "@/features/reports/rules";
import { UUID, withStore, type MemberContext } from "@/shared/db/client";
import { STORE_TIME_ZONE } from "@/shared/today";

export type ChannelRow = {
  id: string;
  name: string;
  /** Clients of the channel that came in during the period. */
  leads: number;
  /** Sales of the period to a client of the channel. */
  sales: number;
  /** Sales over leads; null with no lead. */
  conversion: number | null;
  /** The channel's monthly costs of every month the period touches. */
  cost: number;
  costPerLead: number | null;
  costPerSale: number | null;
  profit: number;
};

const cents = (value: number) => Math.round(value * 100) / 100;

/** What each channel brought and cost in the period, the most profitable first; null for a seller. */
export async function channelReport(ctx: MemberContext, { de, ate }: Janela): Promise<ChannelRow[] | null> {
  if (ctx.role === "seller") return null;
  const rows = await withStore(ctx, (db) =>
    db.query<{ id: string; name: string; leads: number; sales: number; cost: string; profit: string }>(
      `select c.id, c.name,
              (select count(*)::int from leads l
                where l.channel_id = c.id and (l.created_at at time zone $4)::date between $2 and $3) as leads,
              coalesce(s.sales, 0)::int as sales, coalesce(s.profit, 0) as profit,
              (select coalesce(sum(k.amount), 0) from channel_costs k
                where k.channel_id = c.id and k.month between date_trunc('month', $2::date) and $3) as cost
         from channels c
         left join lateral (
           select count(*) as sales, sum(p.profit) as profit
             from sales s join leads l on l.id = s.lead_id left join sale_profits p on p.sale_id = s.id
            where l.channel_id = c.id and s.sold_on between $2 and $3
         ) s on true
        where c.store_id = $1`,
      [ctx.storeId, de, ate, STORE_TIME_ZONE],
    ),
  );
  return rows
    .map((r) => {
      const cost = Number(r.cost);
      return {
        id: r.id, name: r.name, leads: r.leads, sales: r.sales, cost, profit: Number(r.profit),
        conversion: r.leads ? r.sales / r.leads : null,
        costPerLead: r.leads ? cents(cost / r.leads) : null,
        costPerSale: r.sales ? cents(cost / r.sales) : null,
      };
    })
    .sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name));
}

export type ChannelSetting = { id: string; name: string; active: boolean; cost: number };
type ChannelResult = { ok: true } | { ok: false; error: "forbidden" | "invalid" | "not_found" | "duplicate" };

const isMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value);

/** The store's channels with the cost of `month` ("YYYY-MM-01"); only the owner manages them. */
export async function listChannelSettings(ctx: MemberContext, month: string): Promise<ChannelSetting[] | null> {
  if (ctx.role !== "owner" || !isMonth(month)) return null;
  const rows = await withStore(ctx, (db) =>
    db.query<{ id: string; name: string; active: boolean; cost: string }>(
      `select c.id, c.name, c.active,
              coalesce((select k.amount from channel_costs k where k.channel_id = c.id and k.month = $2), 0) as cost
         from channels c where c.store_id = $1 order by c.active desc, c.name`,
      [ctx.storeId, month],
    ),
  );
  return rows.map((r) => ({ ...r, cost: Number(r.cost) }));
}

export async function addChannel(ctx: MemberContext, name: string): Promise<ChannelResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 40) return { ok: false, error: "invalid" };
  // "facebook" and "Facebook" are the same channel to whoever reads the report.
  const added = await withStore(ctx, (db) =>
    db.query(
      `insert into channels (store_id, name) select $1, $2
        where not exists (select from channels where store_id = $1 and lower(name) = lower($2)) returning id`,
      [ctx.storeId, clean],
    ),
  );
  return added.length ? { ok: true } : { ok: false, error: "duplicate" };
}

/** An inactive channel leaves the client form and stays in the reports. */
export async function setChannelActive(ctx: MemberContext, id: string, active: boolean): Promise<ChannelResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  if (!UUID.test(id)) return { ok: false, error: "not_found" };
  const rows = await withStore(ctx, (db) =>
    db.query("update channels set active = $3 where id = $1 and store_id = $2 returning id", [id, ctx.storeId, active]),
  );
  return rows.length ? { ok: true } : { ok: false, error: "not_found" };
}

/** What the channel costs in `month` ("YYYY-MM-01"), in whole reais; zero is a channel that costs nothing. */
export async function setChannelCost(ctx: MemberContext, id: string, month: string, amount: number): Promise<ChannelResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  if (!isMonth(month) || !Number.isInteger(amount) || amount < 0 || amount > 9_999_999) return { ok: false, error: "invalid" };
  if (!UUID.test(id)) return { ok: false, error: "not_found" };
  const rows = await withStore(ctx, (db) =>
    db.query(
      `insert into channel_costs (store_id, channel_id, month, amount)
       select $1, c.id, $3, $4 from channels c where c.id = $2 and c.store_id = $1
       on conflict (channel_id, month) do update set amount = excluded.amount returning id`,
      [ctx.storeId, id, month, amount],
    ),
  );
  return rows.length ? { ok: true } : { ok: false, error: "not_found" };
}
