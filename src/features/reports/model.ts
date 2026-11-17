import { PAYMENT_LABEL, type Payment } from "@/features/leads/types";
import { withStore, type Db, type MemberContext } from "@/shared/db/client";
import { STORE_TIME_ZONE } from "@/shared/today";
import type { FunilNumeros, Janela, VendaRelatorio } from "./rules";

/** The store goal of the month (null when nobody set one) and what counts toward it. */
export type GoalNumbers = { alvo: number | null; feito: number; emNegociacao: number; aguardandoRetorno: number };

type SaleRow = Omit<VendaRelatorio, "valor" | "lucro" | "formaPagamento"> & { price: string; lucro: string | null; payment: Payment };

// A seller never reads sale_profits; it returns them no rows anyway (0007), the query does not rely on it.
function salesSql(ctx: MemberContext): string {
  const seller = ctx.role === "seller";
  return `select s.id, to_char(s.sold_on, 'YYYY-MM-DD') as "dataVenda", s.price, s.payment,
                 v.brand || ' ' || v.model || ' ' || v.version as modelo, l.name as "clienteNome", s.seller_name as vendedor,
                 ${seller ? "null::numeric" : "p.profit"} as lucro
            from sales s
            join vehicles v on v.id = s.vehicle_id
            left join leads l on l.id = s.lead_id
            ${seller ? "" : "left join sale_profits p on p.sale_id = s.id"}
           where s.store_id = $1 and s.sold_on between $2 and $3
           order by s.sold_on desc, s.created_at desc`;
}

async function salesBetween(db: Db, ctx: MemberContext, { de, ate }: Janela): Promise<VendaRelatorio[]> {
  const rows = await db.query<SaleRow>(salesSql(ctx), [ctx.storeId, de, ate]);
  return rows.map(({ price, lucro, payment, ...rest }) => ({
    ...rest,
    valor: Number(price),
    lucro: lucro === null ? null : Number(lucro),
    formaPagamento: PAYMENT_LABEL[payment],
  }));
}

/** The window's sales, the sales of `hoje`'s year and the funnel of the leads that entered in the window. */
export function loadReport(
  ctx: MemberContext,
  janela: Janela,
  hoje: string,
): Promise<{ vendas: VendaRelatorio[]; vendasDoAno: VendaRelatorio[]; funil: FunilNumeros }> {
  const ano = hoje.slice(0, 4);
  return withStore(ctx, async (db) => {
    const vendas = await salesBetween(db, ctx, janela);
    const vendasDoAno = await salesBetween(db, ctx, { de: `${ano}-01-01`, ate: `${ano}-12-31` });
    const [funil] = await db.query<FunilNumeros>(
      `select count(*)::int as entraram,
              count(*) filter (where came_on is not null or stage = 'won')::int as vieram,
              count(*) filter (where stage = 'won')::int as compraram
         from leads
        where store_id = $1 and (created_at at time zone $4)::date between $2 and $3`,
      [ctx.storeId, janela.de, janela.ate, STORE_TIME_ZONE],
    );
    return { vendas, vendasDoAno, funil };
  });
}

/** The store goal of `hoje`'s month, the month's sales and the open negotiations and call-backs. */
export async function loadGoal(ctx: MemberContext, hoje: string): Promise<GoalNumbers> {
  const [row] = await withStore(ctx, (db) =>
    db.query<GoalNumbers>(
      `select (select cars from goals
                where store_id = $1 and month = date_trunc('month', $2::date)::date and member_id is null) as alvo,
              (select count(*)::int from sales
                where store_id = $1 and sold_on >= date_trunc('month', $2::date)
                  and sold_on < date_trunc('month', $2::date) + interval '1 month') as feito,
              (select count(*)::int from leads where store_id = $1 and stage = 'negotiating') as "emNegociacao",
              (select count(*)::int from leads where store_id = $1 and stage = 'call_back') as "aguardandoRetorno"`,
      [ctx.storeId, hoje],
    ),
  );
  return row;
}

/** Owner and manager set the store goal of `hoje`'s month, 1 to 99 cars. */
export async function setStoreGoal(
  ctx: MemberContext,
  cars: number,
  hoje: string,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (!Number.isInteger(cars) || cars < 1 || cars > 99) return { ok: false, error: "invalid" };
  await withStore(ctx, (db) =>
    db.query(
      `insert into goals (store_id, month, member_id, cars) values ($1, date_trunc('month', $2::date)::date, null, $3)
       on conflict (store_id, month, member_id) do update set cars = excluded.cars`,
      [ctx.storeId, hoje, cars],
    ),
  );
  return { ok: true };
}
