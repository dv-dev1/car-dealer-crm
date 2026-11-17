import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { generateMetadata } from "@/app/gestao/layout";
import { LeadCard } from "@/components/gestao/clientes/LeadCard";
import { StoreNameProvider, mensagemDaLoja } from "@/components/gestao/storeName";
import type { Lead } from "@/features/leads/types";

vi.mock("@/features/auth/guard", () => ({
  requireMember: vi.fn(async () => ({ storeName: "Loja Ç" })),
  requireDemoOwner: vi.fn(),
}));
// next/font only works inside the Next compiler.
vi.mock("next/font/google", () => ({ Archivo: () => ({ variable: "font-archivo" }) }));
vi.mock("@/features/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/features/demo/actions", () => ({ viewAsAction: vi.fn(), restoreDemoAction: vi.fn() }));

const lead: Lead = {
  id: "l1", nome: "Joana Lima", telefone: "5583991110000", telefoneLabel: "(83) 99111-0000", estagio: "negociando",
  sellerId: "m2", sellerName: "Dani", vehicleId: "v1", carro: "Fiat Argo Drive", canEdit: true,
};

it("the WhatsApp message carries the store's name", () => {
  expect(mensagemDaLoja("Joana Lima", "Maré Veículos")).toBe("Olá Joana, aqui é da Maré Veículos 👋");
  const html = renderToStaticMarkup(
    createElement(StoreNameProvider, { name: "Loja Ç", children: createElement(LeadCard, { lead, today: "2026-11-16" }) }),
  );
  expect(html).toContain(encodeURIComponent("aqui é da Loja Ç"));
});

it("the panel tab title is the store's", async () => {
  const meta = await generateMetadata();
  // absolute: the root layout's "%s · <site>" template would otherwise wrap the panel's own title.
  expect(meta.title).toEqual({ absolute: "Loja Ç", template: "%s · Loja Ç" });
  expect(meta.robots).toEqual({ index: false, follow: false });
});
