import { recordContactAction } from "@/features/leads/actions";
import type { ContactKind } from "@/features/leads/contacts";
import type { Lead } from "@/features/leads/types";

/**
 * Tapping WhatsApp or call on a client is the contact: it stamps the first response and the last contact.
 * Only on a client the member can edit; fired without waiting, and a failure never blocks the tap.
 */
export function tapContact(lead: Pick<Lead, "id" | "canEdit">, kind: ContactKind): void {
  if (lead.canEdit !== false) void recordContactAction(lead.id, kind).catch(() => {});
}
