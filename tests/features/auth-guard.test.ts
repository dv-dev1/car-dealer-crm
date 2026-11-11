import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import SemAcessoPage from "@/app/sem-acesso/page";
import { signOutAction } from "@/features/auth/actions";
import { requireMember, requireRole } from "@/features/auth/guard";
import { seedTwoStores } from "../db/fixtures.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

const authkit = vi.hoisted(() => ({ withAuth: vi.fn() }));
vi.mock("@workos-inc/authkit-nextjs", () => authkit);

// Like Next's redirect(), it throws; the message carries the destination.
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/navigation", () => nav);

vi.mock("@/features/auth/actions", () => ({ signOutAction: vi.fn() }));

const GESTAO_DIR = fileURLToPath(new URL("../../src/app/gestao/", import.meta.url));

let admin: pg.Client;
let seed: Awaited<ReturnType<typeof seedTwoStores>>;

beforeAll(async () => {
  admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
});
afterAll(() => admin.end());

beforeEach(async () => {
  vi.stubEnv("APP_DATABASE_URL", TEST_APP_URL);
  seed = await seedTwoStores();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function signIn(user: { id: string; email: string; emailVerified: boolean } | null) {
  authkit.withAuth.mockResolvedValue({ user });
}

async function linkedTo(membershipId: string) {
  const { rows } = await admin.query("select workos_user_id from memberships where id = $1", [membershipId]);
  return rows[0]?.workos_user_id ?? null;
}

describe("requireMember", () => {
  it("redirects to /entrar without a session", async () => {
    signIn(null);
    await expect(requireMember()).rejects.toThrow("/entrar");
    expect(nav.redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redirects to /sem-acesso when the user has no membership", async () => {
    signIn({ id: "user_9", email: "nobody@lojaa.com", emailVerified: true });
    await expect(requireMember()).rejects.toThrow("/sem-acesso");
    expect(nav.redirect).toHaveBeenCalledWith("/sem-acesso");
  });

  it("returns the member context for a linked member", async () => {
    const { a } = seed;
    await admin.query("update memberships set workos_user_id = 'user_ana' where id = $1", [a.ana.id]);
    signIn({ id: "user_ana", email: a.ana.email, emailVerified: true });
    expect(await requireMember()).toEqual({ membershipId: a.ana.id, storeId: a.storeId, role: "owner", name: "Ana" });
  });

  it("links a verified invited email on first access", async () => {
    const { a } = seed;
    signIn({ id: "user_beto", email: a.beto.email, emailVerified: true });
    expect(await requireMember()).toEqual({ membershipId: a.beto.id, storeId: a.storeId, role: "seller", name: "Beto" });
    expect(await linkedTo(a.beto.id)).toBe("user_beto");
  });

  it("does not link an invited email that WorkOS has not verified", async () => {
    signIn({ id: "user_beto", email: seed.a.beto.email, emailVerified: false });
    await expect(requireMember()).rejects.toThrow("/sem-acesso");
    expect(await linkedTo(seed.a.beto.id)).toBeNull();
  });

  it("denies a removed member on the next call", async () => {
    const { a } = seed;
    signIn({ id: "user_ana", email: a.ana.email, emailVerified: true });
    expect((await requireMember()).membershipId).toBe(a.ana.id); // ok
    await admin.query("delete from memberships where id = $1", [a.ana.id]);
    await expect(requireMember()).rejects.toThrow("/sem-acesso");
  });

  it("lets a database error through instead of redirecting", async () => {
    vi.stubEnv("APP_DATABASE_URL", "postgres://nobody@127.0.0.1:1/none");
    signIn({ id: "user_ana", email: seed.a.ana.email, emailVerified: true });
    await expect(requireMember()).rejects.toMatchObject({ code: "ECONNREFUSED" });
    expect(nav.redirect).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  it("requireRole redirects a seller to /gestao when only owner is allowed", async () => {
    signIn({ id: "user_beto", email: seed.a.beto.email, emailVerified: true });
    await expect(requireRole(["owner"])).rejects.toThrow("/gestao");
    expect(nav.redirect).toHaveBeenCalledWith("/gestao");
  });

  it("returns the member context when the role is allowed", async () => {
    signIn({ id: "user_beto", email: seed.a.beto.email, emailVerified: true });
    expect(await requireRole(["owner", "seller"])).toMatchObject({ membershipId: seed.a.beto.id, role: "seller" });
  });
});

// Next skips layouts on soft navigation, so a check only in the layout is not a lock. Each exported
// function counts: generateMetadata renders into the redirect response too.
it("every page, layout and route handler under src/app/gestao awaits requireMember or requireRole", () => {
  const files = readdirSync(GESTAO_DIR, { recursive: true, encoding: "utf8" }).filter((file) =>
    /(^|\/)(page|layout|route)\.tsx?$/.test(file),
  );
  expect(files.length).toBeGreaterThanOrEqual(8);
  const count = (source: string, pattern: RegExp) => source.match(pattern)?.length ?? 0;
  const unguarded = files.filter((file) => {
    const source = readFileSync(GESTAO_DIR + file, "utf8");
    const guards = count(source, /await (requireMember|requireRole)\(/g);
    return guards === 0 || guards < count(source, /export (default )?(async )?function/g);
  });
  expect(unguarded).toEqual([]);
});

describe("/sem-acesso", () => {
  type Element = ReactElement<{ children?: ReactNode; action?: unknown }>;
  const forms = (node: ReactNode): Element[] => {
    if (!node || typeof node !== "object" || !("props" in node)) return [];
    const element = node as Element;
    const inner = [element.props.children].flat().flatMap(forms);
    return element.type === "form" ? [element, ...inner] : inner;
  };

  it("redirects to /entrar without a session", async () => {
    signIn(null);
    await expect(SemAcessoPage()).rejects.toThrow("/entrar");
  });

  it("shows the no-access text and a Sair button to a user without membership", async () => {
    signIn({ id: "user_9", email: "nobody@lojaa.com", emailVerified: true });
    const page = await SemAcessoPage();
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Seu e-mail ainda não tem acesso a nenhuma loja. Peça ao dono da loja para cadastrar você.");
    const [form] = forms(page);
    expect(form.props.action).toBe(signOutAction);
    expect(renderToStaticMarkup(form)).toMatch(/<button[^>]*type="submit"[^>]*>Sair<\/button>/);
  });
});
