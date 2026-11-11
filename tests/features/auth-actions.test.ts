import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestCodeAction, signOutAction, verifyCodeAction, type LoginState } from "@/features/auth/actions";
import type { AuthDeps } from "@/features/auth/model";
import { GET as callback } from "@/app/callback/route";
import { GET as googleStart } from "@/app/entrar/google/route";

const authkit = vi.hoisted(() => ({ saveSession: vi.fn(), signOut: vi.fn() }));
vi.mock("@workos-inc/authkit-nextjs", () => authkit);

const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => nav);

const requestHeaders = vi.hoisted(() => ({ value: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.value }));

const deps = vi.hoisted(() => ({}) as { [K in keyof AuthDeps]: ReturnType<typeof vi.fn> });
vi.mock("@/features/auth/workos", () => ({ createAuthDeps: () => deps }));

const EMAIL = "ana@lojaa.com";
// The adapter hands back WorkOS's whole AuthenticationResponse, more than AuthSession.
const response = {
  accessToken: "access",
  refreshToken: "refresh",
  user: { id: "user_1", email: EMAIL, emailVerified: true, firstName: "Ana" },
  authenticationMethod: "MagicAuth",
};
const emailStep: LoginState = { step: "email", email: "", error: null };
const codeStep: LoginState = { step: "code", email: EMAIL, error: null };

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

function anyDepCalled(): boolean {
  return Object.values(deps).some((fn) => fn.mock.calls.length > 0);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WORKOS_REDIRECT_URI", "http://localhost:8787/callback");
  requestHeaders.value = new Headers({ "cf-connecting-ip": "1.2.3.4" });
  nav.redirect.mockImplementation((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  });
  Object.assign(deps, {
    createMagicAuth: vi.fn().mockResolvedValue(undefined),
    authenticateWithMagicAuth: vi.fn().mockResolvedValue(response),
    authenticateWithCode: vi.fn().mockResolvedValue(response),
    googleAuthorizationUrl: vi.fn((state: string) => `https://api.workos.com/user_management/authorize?state=${state}`),
    isLoginEmailAllowed: vi.fn().mockResolvedValue(true),
    rateLimit: vi.fn().mockResolvedValue(true),
    verifyTurnstile: vi.fn().mockResolvedValue(true),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("requestCodeAction", () => {
  it("moves to the code step after a valid request", async () => {
    const state = await requestCodeAction(emailStep, form({ email: EMAIL, "cf-turnstile-response": "tok" }));

    expect(state).toEqual({ step: "code", email: EMAIL, error: null });
    expect(deps.verifyTurnstile).toHaveBeenCalledWith("tok", "1.2.3.4");
    expect(deps.createMagicAuth).toHaveBeenCalledWith(EMAIL);
  });

  it("stays on the e-mail step with the model's error", async () => {
    deps.rateLimit.mockResolvedValue(false);

    const state = await requestCodeAction(emailStep, form({ email: EMAIL, "cf-turnstile-response": "tok" }));

    expect(state).toEqual({ step: "email", email: EMAIL, error: "rate_limited" });
  });

  it.each([null, "", "  "])("refuses with captcha_failed when cf-connecting-ip is %j, without calling the model", async (ip) => {
    requestHeaders.value = ip === null ? new Headers() : new Headers({ "cf-connecting-ip": ip });

    const state = await requestCodeAction(emailStep, form({ email: EMAIL, "cf-turnstile-response": "tok" }));

    expect(state).toEqual({ step: "email", email: EMAIL, error: "captcha_failed" });
    expect(anyDepCalled()).toBe(false);
  });

  it("treats non-string form values as empty", async () => {
    const file = new File([EMAIL], "x.txt");

    const state = await requestCodeAction(emailStep, form({ email: file, "cf-turnstile-response": file }));

    expect(state).toEqual({ step: "email", email: "", error: "invalid_email" });
    expect(anyDepCalled()).toBe(false);
  });

  it("sends an empty token when the Turnstile field is missing or a file", async () => {
    await requestCodeAction(emailStep, form({ email: EMAIL, "cf-turnstile-response": new File(["tok"], "t") }));
    await requestCodeAction(emailStep, form({ email: EMAIL }));

    expect(deps.verifyTurnstile.mock.calls).toEqual([
      ["", "1.2.3.4"],
      ["", "1.2.3.4"],
    ]);
  });
});

describe("verifyCodeAction", () => {
  it("saves the full WorkOS response as the session and redirects to /gestao", async () => {
    await expect(verifyCodeAction(codeStep, form({ email: EMAIL, code: "123456" }))).rejects.toThrow("NEXT_REDIRECT");

    expect(deps.authenticateWithMagicAuth).toHaveBeenCalledWith(EMAIL, "123456");
    expect(authkit.saveSession).toHaveBeenCalledTimes(1);
    expect(authkit.saveSession.mock.calls[0][0]).toBe(response);
    expect(authkit.saveSession.mock.calls[0][1]).toBe("http://localhost:8787/callback");
    expect(nav.redirect).toHaveBeenCalledWith("/gestao");
  });

  it("reads the e-mail from the form, not from the previous state", async () => {
    await expect(
      verifyCodeAction({ step: "code", email: "carla@lojab.com", error: null }, form({ email: EMAIL, code: "123456" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(deps.authenticateWithMagicAuth).toHaveBeenCalledWith(EMAIL, "123456");
  });

  it("stays on the code step with invalid_code and saves nothing", async () => {
    deps.authenticateWithMagicAuth.mockRejectedValue(new Error("expired"));

    const state = await verifyCodeAction(codeStep, form({ email: EMAIL, code: "123456" }));

    expect(state).toEqual({ step: "code", email: EMAIL, error: "invalid_code" });
    expect(authkit.saveSession).not.toHaveBeenCalled();
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it("refuses with captcha_failed when cf-connecting-ip is missing, without calling the model", async () => {
    requestHeaders.value = new Headers();

    const state = await verifyCodeAction(codeStep, form({ email: EMAIL, code: "123456" }));

    expect(state).toEqual({ step: "code", email: EMAIL, error: "captcha_failed" });
    expect(anyDepCalled()).toBe(false);
    expect(authkit.saveSession).not.toHaveBeenCalled();
  });

  it("treats non-string form values as empty", async () => {
    const state = await verifyCodeAction(codeStep, form({ email: new File([EMAIL], "e"), code: new File(["123456"], "c") }));

    expect(state).toEqual({ step: "code", email: "", error: "invalid_code" });
    expect(anyDepCalled()).toBe(false);
  });
});

describe("signOutAction", () => {
  it("signs out back to /entrar", async () => {
    await signOutAction();

    expect(authkit.signOut).toHaveBeenCalledWith({ returnTo: "http://localhost:8787/entrar" });
  });
});

describe("GET /entrar/google", () => {
  it("sets a short-lived oauth_state cookie and redirects to the Google authorize URL", async () => {
    const res = await googleStart();

    const state = res.cookies.get("oauth_state")?.value ?? "";
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`https://api.workos.com/user_management/authorize?state=${state}`);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Max-Age=600/i);
    expect(setCookie).toMatch(/Path=\//i);
  });
});

describe("GET /callback", () => {
  function callbackRequest(query: string, cookieState?: string) {
    return new NextRequest(`http://localhost:8787/callback${query}`, {
      headers: cookieState ? { cookie: `oauth_state=${cookieState}` } : {},
    });
  }

  function clearsStateCookie(res: Response): boolean {
    const setCookie = res.headers.get("set-cookie") ?? "";
    return /oauth_state=;/.test(setCookie) && /Expires=Thu, 01 Jan 1970/i.test(setCookie);
  }

  it.each([
    ["a state that does not match the cookie", "?code=x&state=y", "z"],
    ["no cookie", "?code=x&state=y", undefined],
  ])("redirects to /entrar?erro=google and clears the cookie on %s", async (_name, query, cookieState) => {
    const res = await callback(callbackRequest(query, cookieState));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:8787/entrar?erro=google");
    expect(clearsStateCookie(res)).toBe(true);
    expect(deps.authenticateWithCode).not.toHaveBeenCalled();
    expect(authkit.saveSession).not.toHaveBeenCalled();
  });

  it("redirects to /entrar?erro=google when WorkOS rejects the code", async () => {
    deps.authenticateWithCode.mockRejectedValue(new Error("invalid_grant"));

    const res = await callback(callbackRequest("?code=x&state=abc", "abc"));

    expect(res.headers.get("location")).toBe("http://localhost:8787/entrar?erro=google");
    expect(clearsStateCookie(res)).toBe(true);
    expect(authkit.saveSession).not.toHaveBeenCalled();
  });

  it("saves the session from the request, clears the cookie and redirects to /gestao", async () => {
    const request = callbackRequest("?code=authcode&state=abc", "abc");

    const res = await callback(request);

    expect(deps.authenticateWithCode).toHaveBeenCalledWith("authcode");
    expect(authkit.saveSession).toHaveBeenCalledWith(response, request);
    expect(authkit.saveSession.mock.calls[0][0]).toBe(response);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:8787/gestao");
    expect(clearsStateCookie(res)).toBe(true);
  });
});
