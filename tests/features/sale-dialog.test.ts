import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { FecharNegocioDialog } from "@/components/gestao/clientes/FecharNegocioDialog";
import { readSale } from "@/features/sales/model";
import type { Lead } from "@/features/leads/types";
import { formData } from "@/shared/form";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
vi.mock("@/features/leads/actions", () => ({ loseLeadAction: vi.fn() }));
vi.mock("@/features/sales/actions", () => ({ recordSaleAction: vi.fn() }));

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const noop = () => {};
const lead: Lead = {
  id: "l1", nome: "Joana Lima", telefone: "5583991110000", telefoneLabel: "(83) 99111-0000", estagio: "negociando",
  sellerId: "m2", sellerName: "Dani", vehicleId: "v1", carro: "Fiat Argo Drive", canEdit: true,
};
const consigned = { id: "v1", titulo: "Fiat Argo Drive", preco: 68990, consignorPayout: 50000 };
const dialog = (sellers: { id: string; name: string }[] | null) =>
  text(renderToStaticMarkup(createElement(FecharNegocioDialog, {
    fechamento: { lead, tipo: "vendeu" }, veiculos: [consigned], sellers, memberId: "m1", onConfirmar: noop, onCancelar: noop,
  })));

it("an owner sees the financing return and the consignor's payout; a seller sees neither", () => {
  const owner = dialog([{ id: "m1", name: "Ana" }]);
  expect(owner).toContain("% de retorno do banco");
  expect(owner).toMatch(/Repasse ao dono: R\$\s?50\.000/);
  const seller = dialog(null);
  expect(seller).not.toMatch(/retorno|Repasse/);
  for (const html of [owner, seller]) expect(html).toContain("Carro na troca");
});

const base = { vehicleId: "v1", leadId: "l1", sellerId: "", price: "100000", payment: "financing", bank: "BV", financedAmount: "80000" };
const trade = {
  tradeIn: "1", tradeBrand: "Fiat", tradeModel: "Argo", tradeVersion: "Drive 1.0", tradeManufactureYear: "2020", tradeModelYear: "2020",
  tradeKm: "60.000", tradeFuel: "Flex", tradeTransmission: "Manual", tradeValue: "45.000,00",
};

it("reads the trade-in and the return from the form", () => {
  expect(readSale(formData({ ...base, ...trade, returnPct: "2,5" }))).toMatchObject({
    input: {
      returnPct: 2.5,
      tradeIn: { brand: "Fiat", model: "Argo", version: "Drive 1.0", manufactureYear: 2020, modelYear: 2020, km: 60000, fuel: "Flex",
        transmission: "Manual", value: 45000 },
    },
  });
  expect(readSale(formData({ ...base, returnPct: "" }))).toMatchObject({ input: { returnPct: null, tradeIn: null } });
  expect(readSale(formData({ ...base, returnPct: "abc" }))).toEqual({ field: "returnPct" });
  expect(readSale(formData({ ...base, ...trade, tradeValue: "" }))).toEqual({ field: "tradeIn" });
  expect(readSale(formData({ ...base, price: "abc" }))).toEqual({ field: "price" });
});
