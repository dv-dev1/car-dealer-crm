import { UUID, withStore, type MemberContext } from "@/shared/db/client";

/** `goal`: the seller's goal of the month in cars; null with none set, and for a colleague's when a seller looks. */
export type SellerRank = { memberId: string; name: string; sold: number; goal: number | null; mine: boolean };

const MONTH = "date_trunc('month', $2::date)";

/**
 * The store's sellers, and whoever else sold this month, by the month's sales. Everybody sees who sold how many
 * cars; the goal of each comes only to owner and manager, and a seller reads their own (the goals' RLS).
 */
export async function sellerRanking(ctx: MemberContext, today: string): Promise<SellerRank[]> {
  return withStore(ctx, (db) =>
    db.query<SellerRank>(
      `select m.id as "memberId", m.name, coalesce(s.sold, 0)::int as sold, m.id = $3 as mine,
              (select g.cars from goals g where g.member_id = m.id and g.month = ${MONTH}::date) as goal
         from memberships m
         left join lateral (
           select count(*) as sold from sales s
            where s.seller_id = m.id and s.sold_on >= ${MONTH} and s.sold_on < ${MONTH} + interval '1 month'
         ) s on true
        where m.store_id = $1 and (m.role = 'seller' or s.sold > 0)
        order by sold desc, m.name`,
      [ctx.storeId, today, ctx.membershipId],
    ),
  );
}

/** Owner and manager set a seller's goal of the month of `today`, 1 to 99 cars; null removes it. */
export async function setSellerGoal(
  ctx: MemberContext,
  memberId: string,
  cars: number | null,
  today: string,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" | "not_found" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (cars !== null && (!Number.isInteger(cars) || cars < 1 || cars > 99)) return { ok: false, error: "invalid" };
  if (!UUID.test(memberId)) return { ok: false, error: "not_found" };
  return withStore(ctx, async (db) => {
    const member = await db.query("select from memberships where id = $1 and store_id = $2", [memberId, ctx.storeId]);
    if (!member.length) return { ok: false, error: "not_found" } as const;
    if (cars === null) {
      await db.query(`delete from goals where store_id = $1 and member_id = $3 and month = ${MONTH}::date`, [ctx.storeId, today, memberId]);
    } else {
      await db.query(
        `insert into goals (store_id, month, member_id, cars) values ($1, ${MONTH}::date, $3, $4)
         on conflict (store_id, month, member_id) do update set cars = excluded.cars`,
        [ctx.storeId, today, memberId, cars],
      );
    }
    return { ok: true } as const;
  });
}
