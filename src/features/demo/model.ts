import { withStore, type StoreMember } from "@/shared/db/client";
import { todayIso } from "@/shared/today";
import { fillDemoStore } from "./fill.ts";

export type RestoreResult = { ok: true } | { ok: false; error: "forbidden" | "not_demo" };

// Only the owner of a demo store restores it; everything runs in one transaction under the owner's RLS.
export async function restoreDemoStore(ctx: StoreMember, today: string = todayIso()): Promise<RestoreResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  if (!ctx.isDemo) return { ok: false, error: "not_demo" };
  await withStore(ctx, (db) => fillDemoStore(db, ctx.storeId, today));
  return { ok: true };
}
