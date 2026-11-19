import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Interesse } from "@/app/carro/[slug]/Interesse";
import { restoreDemoStore } from "@/features/demo/model";
import { listLeads } from "@/features/leads/model";
import { sendInterestAction } from "@/features/site/actions";
import type { InterestState } from "@/features/site/rules";
import type { StoreMember } from "@/shared/db/client";
import { formData } from "@/shared/form";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
const requestHeaders = vi.hoisted(() => ({ value: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.value }));
const deps = vi.hoisted(() => ({ verifyTurnstile: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/features/auth/workos", () => ({ createAuthDeps: () => deps }));

const TODAY = "2026-11-13";
const IDLE: InterestState = { status: "idle" };

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

let owner: StoreMember;
let car: { id: string; slug: string; title: string };
const send = (fields: Record<string, string> = {}) =>
  sendInterestAction(IDLE, formData({ vehicle: car.slug, name: "Joana Lima", phone: "(83) 99111-2222", "cf-turnstile-response": "token", ...fields }));
const siteLeads = () => adminQuery("select name, phone from leads where store_id = $1 and phone = '5583991112222'", [owner.storeId]);

beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  await adminQuery("update stores set is_demo = true where id = $1", [seed.a.storeId]);
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana", storeName: "Loja A", isDemo: true };
  await restoreDemoStore(owner, TODAY);
  [car] = await adminQuery(
    "select id, slug, brand || ' ' || model || ' ' || version as title from vehicles where store_id = $1 and status = 'available' order by slug limit 1",
    [owner.storeId],
  );
  vi.stubEnv("SITE_STORE_SLUG", "loja-a");
  requestHeaders.value = new Headers({ "cf-connecting-ip": "203.0.113.7" });
  deps.verifyTurnstile.mockReset().mockResolvedValue(true);
  deps.rateLimit.mockReset().mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

it("a valid interest puts the visitor in the store's funnel, by the channel Site, with the car", async () => {
  expect(await send()).toEqual({ status: "sent" });
  expect(deps.verifyTurnstile).toHaveBeenCalledWith("token", "203.0.113.7");
  expect(deps.rateLimit).toHaveBeenCalledWith("site:ip:203.0.113.7");
  const lead = (await listLeads(owner, TODAY)).find((l) => l.telefone === "5583991112222");
  expect(lead).toMatchObject({ nome: "Joana Lima", estagio: "lead-novo", origem: "Site", vehicleId: car.id, carro: car.title, sellerId: null });
  // Sent twice: still one client.
  expect(await send()).toEqual({ status: "sent" });
  expect(await siteLeads()).toHaveLength(1);
});

it("writes nothing without a person, over the limit or without an address to count", async () => {
  deps.verifyTurnstile.mockResolvedValue(false);
  expect(await send()).toMatchObject({ status: "error", error: "Não foi possível confirmar que você é uma pessoa. Recarregue a página." });
  expect(deps.rateLimit).not.toHaveBeenCalled();

  deps.verifyTurnstile.mockResolvedValue(true);
  deps.rateLimit.mockResolvedValue(false);
  expect(await send()).toMatchObject({ status: "error", error: "Muitas tentativas. Espere um minuto e tente de novo." });

  deps.rateLimit.mockResolvedValue(true);
  requestHeaders.value = new Headers();
  expect(await send()).toMatchObject({ status: "error", error: "Não foi possível confirmar que você é uma pessoa. Recarregue a página." });
  expect(await siteLeads()).toEqual([]);
});

it("a name or a phone that is not one comes back with what was typed, before any check runs", async () => {
  expect(await send({ name: " " })).toEqual({ status: "error", error: "Informe seu nome.", typed: { name: "", phone: "(83) 99111-2222" } });
  expect(await send({ name: "x".repeat(81) })).toMatchObject({ error: "Informe seu nome." });
  for (const phone of ["", "99111-2222", "abc"]) {
    expect(await send({ phone })).toEqual({ status: "error", error: "Confira o WhatsApp com DDD.", typed: { name: "Joana Lima", phone } });
  }
  expect(deps.verifyTurnstile).not.toHaveBeenCalled();
  expect(await siteLeads()).toEqual([]);
});

it("a car that left the site answers so, and a database failure asks for WhatsApp, with nothing technical", async () => {
  await adminQuery("update vehicles set status = 'sold' where id = $1", [car.id]);
  expect(await send()).toMatchObject({ status: "error", error: "Este carro saiu do site. Veja os outros ou chame no WhatsApp." });
  expect(await send({ vehicle: "nao-existe" })).toMatchObject({ error: "Este carro saiu do site. Veja os outros ou chame no WhatsApp." });
  expect(await siteLeads()).toEqual([]);

  useDatabase("postgres://crm_app:dev@127.0.0.1:1/none");
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const failed = await send();
  const logged = JSON.stringify(consoleError.mock.calls);
  consoleError.mockRestore();
  expect(logged).toContain("Site interest failed");
  expect(logged).not.toMatch(/Joana|99111|crm_app/);
  expect(failed).toEqual({ status: "error", error: "Não deu para enviar agora. Chame a loja no WhatsApp.", typed: { name: "Joana Lima", phone: "(83) 99111-2222" } });
});

it("on the demo store the form says so, so nobody leaves a real phone expecting a call", () => {
  const html = renderToStaticMarkup(createElement(Interesse, { slug: "fiat-argo", siteKey: "site-key" }));
  expect(html).toContain("Loja de demonstração");
  expect(html).toContain("Não envie dados de verdade");
});

it("the form asks for a name and a WhatsApp and carries the car", () => {
  const html = renderToStaticMarkup(createElement(Interesse, { slug: "fiat-argo", siteKey: "site-key" }));
  expect(html).toContain('name="name"');
  expect(html).toContain('name="phone"');
  expect(html).toContain('name="vehicle" value="fiat-argo"');
  expect(html).toContain("Tenho interesse");
});
