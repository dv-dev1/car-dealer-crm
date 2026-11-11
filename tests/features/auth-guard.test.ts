import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
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

// `await requireMember()` or `[const x =] await requireRole(...)` as the first statement of the body.
function startsWithGuard(fn: ts.FunctionLikeDeclaration): boolean {
  const first = fn.body && ts.isBlock(fn.body) ? fn.body.statements[0] : undefined;
  const value =
    first && ts.isExpressionStatement(first)
      ? first.expression
      : first && ts.isVariableStatement(first) && first.declarationList.declarations.length === 1
        ? first.declarationList.declarations[0].initializer
        : undefined;
  if (!value || !ts.isAwaitExpression(value) || !ts.isCallExpression(value.expression)) return false;
  const callee = value.expression.expression;
  return ts.isIdentifier(callee) && (callee.text === "requireMember" || callee.text === "requireRole");
}

const isFunction = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node);

function isData(node: ts.Expression): boolean {
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    node = node.expression;
  }
  return (
    ts.isObjectLiteralExpression(node) ||
    ts.isArrayLiteralExpression(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  );
}

// Names of the exports that are functions not starting with the guard. Fails closed: an export it
// cannot follow (an imported name, a wrapper call, `export { … }`, a re-export) is reported too.
function unguardedExports(source: string): string[] {
  const file = ts.createSourceFile("check.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const locals = new Map<string, ts.Node>();
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) locals.set(statement.name.text, statement);
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer) locals.set(d.name.text, d.initializer);
      }
    }
  }
  const unguarded: string[] = [];
  const check = (name: string, node: ts.Node | undefined) => {
    if (node && ts.isIdentifier(node)) node = locals.get(node.text) ?? node;
    const ok = node && (isFunction(node) ? startsWithGuard(node) : ts.isExpression(node) && isData(node));
    if (!ok) unguarded.push(name);
  };
  for (const statement of file.statements) {
    const exported =
      ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isExportAssignment(statement)) check("default", statement.expression);
    else if (ts.isExportDeclaration(statement)) {
      if (!statement.isTypeOnly) unguarded.push(statement.getText(file));
    } else if (!exported || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
    else if (ts.isFunctionDeclaration(statement)) check(statement.name?.text ?? "default", statement);
    else if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) check(d.name.getText(file), d.initializer);
    } else unguarded.push(statement.getText(file).split("\n")[0]);
  }
  return unguarded;
}

describe("the gestao guard scan", () => {
  it.each([
    ["a commented-out guard", "export default async function Page() {\n  // await requireMember();\n  return null;\n}", ["Page"]],
    [
      "a return before the guard",
      "export default async function Page({ v }: { v?: string }) {\n  if (v) return v;\n  await requireMember();\n  return null;\n}",
      ["Page"],
    ],
    [
      "two guards in generateMetadata and none in the page",
      "export async function generateMetadata() {\n  await requireMember();\n  await requireMember();\n  return {};\n}\n" +
        "export default async function Page() {\n  return null;\n}",
      ["Page"],
    ],
    [
      "an exported arrow function",
      'export const generateMetadata = async () => ({ title: "x" });\n' +
        "export default async function Page() {\n  await requireMember();\n  return null;\n}",
      ["generateMetadata"],
    ],
  ])("flags %s", (_case, source, expected) => {
    expect(unguardedExports(source)).toEqual(expected);
  });

  it("flags export forms it cannot follow", () => {
    expect(unguardedExports("function Page() {\n  return null;\n}\nexport default Page;")).toEqual(["default"]);
    expect(unguardedExports("export default withAuthPage(Page);")).toEqual(["default"]);
    expect(unguardedExports('export { default } from "./other";')).toEqual(['export { default } from "./other";']);
  });

  it("accepts guarded functions and plain data exports", () => {
    const source = `
      export const metadata: Metadata = { title: "x" };
      export const dynamic = "force-dynamic";
      export type Props = { slug: string };
      export async function generateMetadata() {
        await requireMember();
        return {};
      }
      export const GET = async () => {
        const member = await requireRole(["owner"]);
        return Response.json(member);
      };
      const Page = async () => {
        await requireMember(); // a trailing comment is fine
        return null;
      };
      export default Page;`;
    expect(unguardedExports(source)).toEqual([]);
  });
});

// Next skips layouts on soft navigation, so a check only in the layout is not a lock.
// loading, error and not-found render no data, so they stay out.
const SPECIAL_FILE = /(^|\/)(page|layout|route|template|default|opengraph-image|twitter-image|icon|apple-icon)\.tsx?$/;

it("every exported function of each Next special file under src/app/gestao starts with the guard", () => {
  const files = readdirSync(GESTAO_DIR, { recursive: true, encoding: "utf8" }).filter((file) => SPECIAL_FILE.test(file));
  expect(files.length).toBeGreaterThanOrEqual(8);
  const unguarded = files.flatMap((file) =>
    unguardedExports(readFileSync(GESTAO_DIR + file, "utf8")).map((name) => `${file}: ${name}`),
  );
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
