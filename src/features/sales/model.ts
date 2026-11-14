import { isIsoDate } from "@/features/leads/model";
import type { Payment } from "@/features/leads/types";
import { UUID, withStore, type MemberContext } from "@/shared/db/client";
import { todayIso } from "@/shared/today";

/** `sellerId` null: the lead's seller, or whoever records it. A cash sale drops bank and financed amount. */
export type SaleInput = {
  vehicleId: string;
  leadId: string | null;
  sellerId: string | null;
  price: number;
  payment: Payment;
  bank: string | null;
  financedAmount: number | null;
  soldOn: string;
};
export type SaleError = "forbidden" | "not_found" | "not_available" | "lead_closed" | "invalid";
export type SaleResult = { ok: true; id: string } | { ok: false; error: SaleError; field?: keyof SaleInput };

const MAX_PRICE = 10_000_000;
const MAX_BANK = 60;
// The messages record_sale raises (0004_record_sale.sql).
const REFUSALS: readonly string[] = ["forbidden", "not_found", "not_available", "lead_closed", "invalid"];

const integer = (value: number | null, min: number, max: number) =>
  value !== null && Number.isInteger(value) && value >= min && value <= max;

function validateSale(input: SaleInput, today: string): keyof SaleInput | null {
  if (!UUID.test(input.vehicleId)) return "vehicleId";
  if (input.leadId !== null && !UUID.test(input.leadId)) return "leadId";
  if (input.sellerId !== null && !UUID.test(input.sellerId)) return "sellerId";
  if (!integer(input.price, 1, MAX_PRICE)) return "price";
  if (input.payment !== "cash" && input.payment !== "financing") return "payment";
  if (input.payment === "financing") {
    if (!integer(input.financedAmount, 1, input.price)) return "financedAmount";
    if (input.bank !== null && input.bank.trim().length > MAX_BANK) return "bank";
  }
  if (!isIsoDate(input.soldOn) || input.soldOn > today) return "soldOn";
  return null;
}

/** Records the sale through record_sale: the car becomes sold and the lead won. */
export async function recordSale(ctx: MemberContext, input: SaleInput, today = todayIso()): Promise<SaleResult> {
  if (ctx.role === "seller" && input.sellerId !== null && input.sellerId !== ctx.membershipId) return { ok: false, error: "forbidden" };
  const field = validateSale(input, today);
  if (field) return { ok: false, error: "invalid", field };
  const financed = input.payment === "financing";

  try {
    const [row] = await withStore(ctx, (db) =>
      db.query<{ id: string }>("select record_sale($1, $2, $3, $4, $5, $6, $7, $8) as id", [
        input.vehicleId, input.leadId, input.sellerId, input.price, input.payment,
        financed ? input.bank?.trim() || null : null, financed ? input.financedAmount : null, input.soldOn,
      ]),
    );
    return { ok: true, id: row.id };
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string };
    if (code === "P0001" && message && REFUSALS.includes(message)) return { ok: false, error: message as SaleError };
    throw error;
  }
}
