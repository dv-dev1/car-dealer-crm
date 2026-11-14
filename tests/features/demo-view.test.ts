import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DemoControls, ViewingBanner, restoredLabel, type DemoPanelProps } from "@/features/demo/view";

vi.mock("@/features/demo/actions", () => ({ viewAsAction: vi.fn(), restoreDemoAction: vi.fn() }));

const OWNER = "11111111-1111-4111-8111-111111111111";
const RENATA = "22222222-2222-4222-8222-222222222222";
const BRUNO = "33333333-3333-4333-8333-333333333333";
const demo: DemoPanelProps = {
  team: [
    { membershipId: OWNER, name: "Seu Nome", role: "owner" },
    { membershipId: RENATA, name: "Renata Albuquerque", role: "manager" },
    { membershipId: BRUNO, name: "Bruno Farias", role: "seller" },
  ],
  restoredOn: "2026-11-10",
  today: "2026-11-13",
  selfId: OWNER,
  viewing: null,
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("restoredLabel", () => {
  it.each([
    [null, "Ainda não restaurada"],
    ["2026-11-13", "Restaurada hoje"],
    ["2026-11-12", "Restaurada há 1 dia"],
    ["2026-10-31", "Restaurada há 13 dias"],
    ["2026-02-28", "Restaurada há 258 dias"],
  ])("%s → %s", (restoredOn, label) => {
    expect(restoredLabel(restoredOn, "2026-11-13")).toBe(label);
  });
});

describe("DemoControls", () => {
  it("lists the owner first as 'Dono (você)' and each member with their role", () => {
    const html = renderToStaticMarkup(createElement(DemoControls, { demo }));
    const options = [...html.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
    expect(options).toEqual([
      ["", "Dono (você)"],
      [RENATA, "Gerente: Renata Albuquerque"],
      [BRUNO, "Vendedor: Bruno Farias"],
    ]);
    expect(text(html)).toContain("Demonstração");
    expect(text(html)).toContain("Ver como");
    expect(text(html)).toContain("Restaurada há 3 dias");
    expect(html).toMatch(/<button[^>]*>Restaurar demo<\/button>/);
    expect(text(html)).not.toContain("Apaga tudo");
  });

  it("selects the member being viewed", () => {
    const html = renderToStaticMarkup(
      createElement(DemoControls, { demo: { ...demo, viewing: { membershipId: BRUNO, name: "Bruno Farias", role: "seller" } } }),
    );
    expect(html).toMatch(new RegExp(`<option[^>]*value="${BRUNO}"[^>]*selected`));
  });
});

describe("ViewingBanner", () => {
  it.each([
    ["seller", "Bruno Farias", "Você está vendo o painel como Bruno Farias (vendedor)."],
    ["manager", "Renata Albuquerque", "Você está vendo o painel como Renata Albuquerque (gerente)."],
  ] as const)("names the %s being viewed and offers the way back", (role, name, sentence) => {
    const html = renderToStaticMarkup(createElement(ViewingBanner, { viewing: { membershipId: BRUNO, name, role } }));
    expect(text(html)).toContain(sentence);
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="membershipId"[^>]*value=""/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Voltar para dono<\/button>/);
  });
});
