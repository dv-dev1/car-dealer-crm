import { UUID, withStore, type MemberContext } from "@/shared/db/client";

import { DOCUMENT_ITEMS, type DocumentItem, type DocumentStatus, type VehicleDocument } from "./rules";

const STATUSES: readonly string[] = ["ok", "pending", "not_applicable"];

/** The seven documents of a car, in order; an item nobody set yet comes with a null status. */
export async function listDocuments(ctx: MemberContext, vehicleId: string): Promise<VehicleDocument[]> {
  const rows = UUID.test(vehicleId)
    ? await withStore(ctx, (db) =>
        db.query<{ item: DocumentItem; status: DocumentStatus; note: string | null }>(
          "select item, status, note from vehicle_documents where vehicle_id = $1 and store_id = $2",
          [vehicleId, ctx.storeId],
        ),
      )
    : [];
  return DOCUMENT_ITEMS.map((item) => rows.find((r) => r.item === item) ?? { item, status: null, note: null });
}

/** Owner and manager say where a document stands, with a note of up to 200 letters. */
export async function setDocument(
  ctx: MemberContext,
  input: { vehicleId: string; item: DocumentItem; status: DocumentStatus; note: string },
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "not_found" | "invalid" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  const note = input.note.trim();
  if (!(DOCUMENT_ITEMS as readonly string[]).includes(input.item) || !STATUSES.includes(input.status) || note.length > 200) {
    return { ok: false, error: "invalid" };
  }
  if (!UUID.test(input.vehicleId)) return { ok: false, error: "not_found" };
  const rows = await withStore(ctx, (db) =>
    db.query(
      `insert into vehicle_documents (store_id, vehicle_id, item, status, note)
       select $1, v.id, $3, $4, $5 from vehicles v where v.id = $2 and v.store_id = $1
       on conflict (vehicle_id, item) do update set status = excluded.status, note = excluded.note returning id`,
      [ctx.storeId, input.vehicleId, input.item, input.status, note || null],
    ),
  );
  return rows.length ? { ok: true } : { ok: false, error: "not_found" };
}
