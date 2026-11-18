import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MensagemIA } from "@/components/gestao/clientes/MensagemIA";
import { draftMessageAction } from "@/features/ai/actions";
import { draftMessage } from "@/features/ai/messages";
import { cleanMessage, messageKind } from "@/features/ai/rules";
import type { StoreMember } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
const guard = vi.hoisted(() => ({ requireMember: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/features/auth/guard", () => guard);
vi.mock("@/features/leads/actions", () => ({ recordContactAction: vi.fn(() => Promise.resolve()) }));

const TODAY = "2026-11-13";

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

const fetchMock = vi.fn<typeof fetch>();
const answer = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const sentBody = (call = 0) => fetchMock.mock.calls[call][1]!.body as string;

let owner: StoreMember;
let seller: StoreMember;
let other: StoreMember;
async function lead(sellerId: string | null, over: Record<string, unknown> = {}): Promise<string> {
  const row = {
    store_id: owner.storeId, name: "Joana Lima", phone: "5583991110000", seller_id: sellerId, stage: "new", interest: "Onix automático",
    note: "segredo da nota", created_at: "2026-11-10T12:00:00Z", ...over,
  };
  const keys = Object.keys(row);
  const [{ id }] = await adminQuery(
    `insert into leads (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(row),
  );
  return id;
}

beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  const seed = await seedTwoStores();
  owner = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana Souza", storeName: "Loja A", isDemo: false };
  seller = { ...owner, membershipId: seed.a.beto.id, role: "seller", name: "Beto" };
  other = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla", storeName: "Loja B", isDemo: false };
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("picks the kind of message from the stage and the history", () => {
  expect(messageKind({ won: true, answered: true, daysSinceVisit: 2 })).toBe("after_sale");
  expect(messageKind({ won: false, answered: false, daysSinceVisit: null })).toBe("first_contact");
  expect(messageKind({ won: false, answered: true, daysSinceVisit: 0 })).toBe("after_visit");
  expect(messageKind({ won: false, answered: true, daysSinceVisit: 7 })).toBe("after_visit");
  expect(messageKind({ won: false, answered: true, daysSinceVisit: 8 })).toBe("resume");
  expect(messageKind({ won: false, answered: true, daysSinceVisit: null })).toBe("resume");
});

it("a message is plain text of a size WhatsApp takes, or nothing", () => {
  expect(cleanMessage('  "Oi, Joana! Tudo bem?"  ')).toBe("Oi, Joana! Tudo bem?");
  expect(cleanMessage("“Oi, Joana!”")).toBe("Oi, Joana!");
  expect(cleanMessage("x".repeat(700))).toHaveLength(600);
  expect(cleanMessage("   ")).toBeNull();
  expect(cleanMessage('""')).toBeNull();
});

it("writes the first contact with the client's first name only, never the phone or the note", async () => {
  const id = await lead(null);
  fetchMock.mockResolvedValueOnce(answer('"Oi, Joana! Aqui é a Ana, da Loja A. Posso te mostrar o Onix?"'));
  expect(await draftMessage(owner, TODAY, id, "Loja A")).toEqual({
    ok: true, kind: "first_contact", text: "Oi, Joana! Aqui é a Ana, da Loja A. Posso te mostrar o Onix?",
  });
  const body = sentBody();
  for (const present of ["Joana", "Loja A", "Ana", "Onix automático", "Primeiro contato"]) expect(body).toContain(present);
  for (const absent of ["Lima", "Souza", "5583991110000", "991110000", "segredo da nota"]) expect(body).not.toContain(absent);
  expect(JSON.parse(body).response_format).toBeUndefined();
});

it("the history changes the kind: resumed, after a visit and after the sale", async () => {
  const answered = { first_response_at: "2026-11-10T13:00:00Z", last_contact_at: "2026-11-10T13:00:00Z" };
  fetchMock.mockImplementation(async () => answer("Oi!"));
  expect(await draftMessage(owner, TODAY, await lead(null, answered), "Loja A")).toMatchObject({ kind: "resume" });
  expect(JSON.parse(JSON.parse(sentBody(0)).messages[1].content)).toMatchObject({ tipo: "Retomada", cliente: "Joana", diasSemContato: 3 });
  expect(await draftMessage(owner, TODAY, await lead(null, { ...answered, stage: "negotiating", came_on: "2026-11-11" }), "Loja A")).toMatchObject({ kind: "after_visit" });
  expect(await draftMessage(owner, TODAY, await lead(null, { ...answered, stage: "visit_scheduled", visit_on: "2026-11-20" }), "Loja A")).toMatchObject({ kind: "resume" });
  expect(await draftMessage(owner, TODAY, await lead(null, { ...answered, stage: "won", closed_at: "2026-11-12T15:00:00Z" }), "Loja A")).toMatchObject({ kind: "after_sale" });
});

it("a seller writes only to his own client, and nobody to another store's", async () => {
  const colleagues = await lead(owner.membershipId);
  const own = await lead(seller.membershipId);
  expect(await draftMessage(seller, TODAY, colleagues, "Loja A")).toEqual({ ok: false, reason: "forbidden" });
  expect(await draftMessage(other, TODAY, own, "Loja B")).toEqual({ ok: false, reason: "not_found" });
  expect(await draftMessage(owner, TODAY, "not-a-uuid", "Loja A")).toEqual({ ok: false, reason: "not_found" });
  expect(fetchMock).not.toHaveBeenCalled();

  fetchMock.mockResolvedValueOnce(answer("Oi, Joana!"));
  expect(await draftMessage(seller, TODAY, own, "Loja A")).toMatchObject({ ok: true, text: "Oi, Joana!" });
  fetchMock.mockResolvedValueOnce(answer("  "));
  expect(await draftMessage(seller, TODAY, own, "Loja A")).toEqual({ ok: false, reason: "failed" });
});

it("the action answers the message or says why not", async () => {
  const id = await lead(owner.membershipId);
  guard.requireMember.mockResolvedValue(owner);
  fetchMock.mockResolvedValueOnce(answer("Oi, Joana!"));
  expect(await draftMessageAction(id)).toEqual({ kind: "first_contact", text: "Oi, Joana!" });
  guard.requireMember.mockResolvedValue(seller);
  expect(await draftMessageAction(id)).toEqual({ error: "Este cliente é de outro vendedor." });
  expect(await draftMessageAction("x")).toEqual({ error: "Cliente não encontrado." });
});

it("the written message opens WhatsApp with the text", () => {
  const props = { lead: { id: "l1", nome: "Joana Lima", telefone: "5583991110000", canEdit: true } };
  const empty = renderToStaticMarkup(createElement(MensagemIA, props));
  expect(empty).toContain("Escrever mensagem com IA");
  expect(empty).not.toContain("wa.me");
  const html = renderToStaticMarkup(createElement(MensagemIA, { ...props, inicial: { kind: "resume" as const, text: "Oi, Joana! Tudo bem?" } }));
  expect(html).toContain(`href="https://wa.me/5583991110000?text=${encodeURIComponent("Oi, Joana! Tudo bem?")}"`);
  expect(html).toContain("Retomada");
  expect(renderToStaticMarkup(createElement(MensagemIA, { lead: { ...props.lead, telefone: "" } }))).toBe("");
});
