import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { LeadCard } from "@/components/gestao/clientes/LeadCard";
import { tapContact } from "@/components/gestao/clientes/contato";
import type { Lead } from "@/features/leads/types";

const actions = vi.hoisted(() => ({ recordContactAction: vi.fn(() => Promise.resolve()) }));
vi.mock("@/features/leads/actions", () => actions);

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: "l1", nome: "Joana Lima", telefone: "5583991110000", telefoneLabel: "(83) 99111-0000", estagio: "negociando",
  sellerId: "m1", sellerName: "Beto", vehicleId: null, canEdit: true, ...over,
});

beforeEach(() => actions.recordContactAction.mockClear());

it("a tap records the contact on the member's own client, never on a colleague's", () => {
  tapContact(lead(), "whatsapp");
  expect(actions.recordContactAction).toHaveBeenCalledWith("l1", "whatsapp");
  tapContact(lead({ canEdit: false }), "call");
  expect(actions.recordContactAction).toHaveBeenCalledTimes(1);
});

it("a failed record does not break the tap", async () => {
  actions.recordContactAction.mockRejectedValueOnce(new Error("offline"));
  expect(() => tapContact(lead(), "note")).not.toThrow();
  await Promise.resolve();
});

it("the card's actions wrap instead of leaving the card, and the call button stays on the phone", () => {
  const html = renderToStaticMarkup(createElement(LeadCard, { lead: lead(), today: "2026-11-13", onEditar: () => {}, onMoverEtapa: () => {} }));
  const actionsRow = html.match(/<div class="([^"]*mt-auto[^"]*)"/)![1];
  expect(actionsRow.split(" ")).toContain("flex-wrap");
  const call = html.match(/<a href="tel:\+5583991110000"[^>]*class="([^"]*)"/)![1];
  expect(call.split(" ")).toContain("lg:hidden");
});
