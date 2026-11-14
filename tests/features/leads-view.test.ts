import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { NovoClienteModal } from "@/components/gestao/NovoClienteModal";
import { FecharNegocioDialog } from "@/components/gestao/clientes/FecharNegocioDialog";
import { LeadCard } from "@/components/gestao/clientes/LeadCard";
import type { Lead } from "@/features/leads/types";

vi.mock("@/features/leads/actions", () => ({
  createLeadAction: vi.fn(), updateLeadAction: vi.fn(), moveLeadAction: vi.fn(), loseLeadAction: vi.fn(),
}));
vi.mock("@/features/sales/actions", () => ({ recordSaleAction: vi.fn() }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const TODAY = "2026-11-14";
const noop = () => {};

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: "l1", nome: "Joana Lima", telefone: "5583991110000", telefoneLabel: "(83) 99111-0000", estagio: "negociando",
  sellerId: "m2", sellerName: "Dani", vehicleId: "v1", carro: "Fiat Argo Drive", canEdit: true, ...over,
});
const veiculos = [{ id: "v1", titulo: "Fiat Argo Drive", preco: 68990 }];
const channels = [{ id: "c1", name: "Instagram" }];
const sellers = [{ id: "m1", name: "Ana" }, { id: "m2", name: "Dani" }];

it("hides edit and move on a colleague's lead", () => {
  const props = { today: TODAY, onEditar: noop, onMoverEtapa: noop };
  const colleague = renderToStaticMarkup(createElement(LeadCard, { ...props, lead: lead({ canEdit: false }) }));
  expect(text(colleague)).not.toContain("Editar");
  expect(colleague).not.toContain("Mover Joana");
  expect(text(colleague)).toContain("Dani");
  const own = renderToStaticMarkup(createElement(LeadCard, { ...props, lead: lead() }));
  expect(text(own)).toContain("Editar");
  expect(own).toContain("Mover Joana");
});

it("offers WhatsApp only when the lead has a phone", () => {
  expect(renderToStaticMarkup(createElement(LeadCard, { lead: lead(), today: TODAY }))).toContain("Chamar Joana no WhatsApp");
  expect(renderToStaticMarkup(createElement(LeadCard, { lead: lead({ telefone: "", telefoneLabel: "—" }), today: TODAY }))).not.toContain(
    "WhatsApp",
  );
});

it("marks a call back before the store's today as late", () => {
  const late = lead({ estagio: "ligar-volta", retornarEm: "2026-11-13" });
  expect(text(renderToStaticMarkup(createElement(LeadCard, { lead: late, today: TODAY })))).toContain("atrasado");
  expect(text(renderToStaticMarkup(createElement(LeadCard, { lead: { ...late, retornarEm: TODAY }, today: TODAY })))).not.toContain("atrasado");
});

it("the sale dialog offers cash and financing, not trade-in", () => {
  const html = text(renderToStaticMarkup(createElement(FecharNegocioDialog, {
    fechamento: { lead: lead(), tipo: "vendeu" }, veiculos, sellers: null, onConfirmar: noop, onCancelar: noop,
  })));
  expect(html).toContain("À vista");
  expect(html).toContain("Financiamento");
  expect(html).not.toMatch(/troca/i);
  expect(html).not.toContain("Vendedor");
});

it("the sale dialog lets owner and manager name the seller", () => {
  const html = text(renderToStaticMarkup(createElement(FecharNegocioDialog, {
    fechamento: { lead: null, tipo: "vendeu", vehicleId: "v1" }, veiculos, sellers, leads: [lead()], onConfirmar: noop, onCancelar: noop,
  })));
  expect(html).toContain("Vendedor");
  expect(html).toContain("Fiat Argo Drive");
  expect(html).toContain("Joana Lima");
});

it("the client form shows the seller field only to owner and manager", () => {
  const base = { aberto: true, onFechar: noop, veiculos, channels };
  const manager = text(renderToStaticMarkup(createElement(NovoClienteModal, { ...base, sellers })));
  expect(manager).toContain("Vendedor");
  expect(manager).toContain("Instagram");
  expect(manager).not.toMatch(/neste navegador|Supabase/);
  const seller = text(renderToStaticMarkup(createElement(NovoClienteModal, { ...base, sellers: null })));
  expect(seller).not.toContain("Vendedor");
});
