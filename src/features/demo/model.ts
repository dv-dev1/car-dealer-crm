import { withStore, type Role, type StoreMember } from "@/shared/db/client";
import { STORE_TIME_ZONE, todayIso } from "@/shared/today";
import { fillDemoStore } from "./fill.ts";

export type RestoreResult = { ok: true } | { ok: false; error: "forbidden" | "not_demo" };
export type DemoPanel = { restoredOn: string | null; team: { membershipId: string; name: string; role: Role }[] };

// Only the owner of a demo store restores it; everything runs in one transaction under the owner's RLS.
export async function restoreDemoStore(ctx: StoreMember, today: string = todayIso()): Promise<RestoreResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  if (!ctx.isDemo) return { ok: false, error: "not_demo" };
  await withStore(ctx, (db) => fillDemoStore(db, ctx.storeId, today));
  return { ok: true };
}

// The day of the last restore in the store's time zone, and the team for "Ver como".
export async function getDemoPanel(ctx: StoreMember): Promise<DemoPanel> {
  return withStore(ctx, async (db) => {
    const [store] = await db.query<{ restoredOn: string | null }>(
      `select to_char(demo_restored_at at time zone $1, 'YYYY-MM-DD') as "restoredOn" from stores where id = $2`,
      [STORE_TIME_ZONE, ctx.storeId],
    );
    const team = await db.query<DemoPanel["team"][number]>(
      `select id as "membershipId", name, role from memberships
        order by case role when 'owner' then 0 when 'manager' then 1 else 2 end, name`,
    );
    return { restoredOn: store?.restoredOn ?? null, team };
  });
}
