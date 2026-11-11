import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeGoogleLogin,
  newOAuthState,
  normalizeEmail,
  requestLoginCode,
  verifyLoginCode,
  type AuthDeps,
  type AuthSession,
} from "@/features/auth/model";

const timingSafeEqualSpy = vi.hoisted(() => vi.fn());
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  timingSafeEqualSpy.mockImplementation(actual.timingSafeEqual);
  return { ...actual, timingSafeEqual: timingSafeEqualSpy };
});

const session: AuthSession = {
  accessToken: "access",
  refreshToken: "refresh",
  user: { id: "user_1", email: "ana@lojaa.com", emailVerified: true },
};

function makeDeps() {
  return {
    createMagicAuth: vi.fn<AuthDeps["createMagicAuth"]>().mockResolvedValue(undefined),
    authenticateWithMagicAuth: vi.fn<AuthDeps["authenticateWithMagicAuth"]>().mockResolvedValue(session),
    authenticateWithCode: vi.fn<AuthDeps["authenticateWithCode"]>().mockResolvedValue(session),
    googleAuthorizationUrl: vi.fn<AuthDeps["googleAuthorizationUrl"]>().mockReturnValue("https://google.test/auth"),
    isLoginEmailAllowed: vi.fn<AuthDeps["isLoginEmailAllowed"]>().mockResolvedValue(true),
    rateLimit: vi.fn<AuthDeps["rateLimit"]>().mockResolvedValue(true),
    verifyTurnstile: vi.fn<AuthDeps["verifyTurnstile"]>().mockResolvedValue(true),
  };
}

const request = { email: "  Ana@LojaA.com ", turnstileToken: "tok", ip: "1.2.3.4" };
const verify = { email: "  Ana@LojaA.com ", code: "123456", ip: "1.2.3.4" };

describe("normalizeEmail", () => {
  it.each([
    ["  Ana@LojaA.com ", "ana@lojaa.com"],
    ["abc", null],
    ["a@b", null],
    ["", null],
    ["ana @lojaa.com", null],
    ["a@@b.com", null],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeEmail(raw)).toBe(expected);
  });

  it("accepts 254 characters and rejects 255", () => {
    const atLimit = `${"a".repeat(244)}@lojaa.com`;

    expect(normalizeEmail(atLimit)).toBe(atLimit);
    expect(normalizeEmail(`a${atLimit}`)).toBeNull();
  });
});

describe("requestLoginCode", () => {
  it("sends a code to an invited email, normalized", async () => {
    const deps = makeDeps();

    const result = await requestLoginCode(deps, request);

    expect(result).toEqual({ ok: true });
    expect(deps.isLoginEmailAllowed).toHaveBeenCalledWith("ana@lojaa.com");
    expect(deps.createMagicAuth).toHaveBeenCalledTimes(1);
    expect(deps.createMagicAuth).toHaveBeenCalledWith("ana@lojaa.com");
  });

  it("answers ok and sends nothing to an email that was not invited", async () => {
    const deps = makeDeps();
    deps.isLoginEmailAllowed.mockResolvedValue(false);

    const result = await requestLoginCode(deps, request);

    expect(result).toEqual({ ok: true });
    expect(deps.createMagicAuth).not.toHaveBeenCalled();
  });

  it("answers ok when WorkOS fails to send the code to an invited email", async () => {
    const deps = makeDeps();
    deps.createMagicAuth.mockRejectedValue(new Error("workos down"));

    await expect(requestLoginCode(deps, request)).resolves.toEqual({ ok: true });
  });

  it("rejects an invalid email without calling anything else", async () => {
    const deps = makeDeps();

    const result = await requestLoginCode(deps, { ...request, email: "abc" });

    expect(result).toEqual({ ok: false, error: "invalid_email" });
    for (const fn of Object.values(deps)) expect(fn).not.toHaveBeenCalled();
  });

  it("stops on a failed captcha before sending", async () => {
    const deps = makeDeps();
    deps.verifyTurnstile.mockResolvedValue(false);

    const result = await requestLoginCode(deps, request);

    expect(result).toEqual({ ok: false, error: "captcha_failed" });
    expect(deps.verifyTurnstile).toHaveBeenCalledWith("tok", "1.2.3.4");
    expect(deps.rateLimit).not.toHaveBeenCalled();
    expect(deps.isLoginEmailAllowed).not.toHaveBeenCalled();
    expect(deps.createMagicAuth).not.toHaveBeenCalled();
  });

  it("rate limits by ip and by email", async () => {
    const deps = makeDeps();

    await requestLoginCode(deps, request);

    expect(deps.rateLimit).toHaveBeenCalledWith("code:ip:1.2.3.4");
    expect(deps.rateLimit).toHaveBeenCalledWith("code:email:ana@lojaa.com");

    for (const blockedKey of ["code:ip:1.2.3.4", "code:email:ana@lojaa.com"]) {
      const limited = makeDeps();
      limited.rateLimit.mockImplementation(async (key) => key !== blockedKey);

      const result = await requestLoginCode(limited, request);

      expect(result).toEqual({ ok: false, error: "rate_limited" });
      expect(limited.isLoginEmailAllowed).not.toHaveBeenCalled();
      expect(limited.createMagicAuth).not.toHaveBeenCalled();
    }
  });

  it("does not spend the email budget when the ip is already limited", async () => {
    const deps = makeDeps();
    deps.rateLimit.mockImplementation(async (key) => !key.startsWith("code:ip:"));

    await requestLoginCode(deps, request);

    expect(deps.rateLimit).not.toHaveBeenCalledWith("code:email:ana@lojaa.com");
  });

  it.each(["verifyTurnstile", "rateLimit", "isLoginEmailAllowed"] as const)(
    "lets a %s failure propagate and sends nothing",
    async (name) => {
      const deps = makeDeps();
      deps[name].mockRejectedValue(new Error("boom"));

      await expect(requestLoginCode(deps, request)).rejects.toThrow("boom");
      expect(deps.createMagicAuth).not.toHaveBeenCalled();
    },
  );
});

describe("verifyLoginCode", () => {
  it.each(["12345", "abcdef", "1234567", "12 456", ""])(
    "rejects the code %j, which is not 6 digits, without calling WorkOS",
    async (code) => {
      const deps = makeDeps();

      const result = await verifyLoginCode(deps, { ...verify, code });

      expect(result).toEqual({ ok: false, error: "invalid_code" });
      expect(deps.authenticateWithMagicAuth).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid email as invalid_code without calling anything", async () => {
    const deps = makeDeps();

    const result = await verifyLoginCode(deps, { ...verify, email: "abc" });

    expect(result).toEqual({ ok: false, error: "invalid_code" });
    expect(deps.rateLimit).not.toHaveBeenCalled();
    expect(deps.authenticateWithMagicAuth).not.toHaveBeenCalled();
  });

  it("maps a WorkOS failure to invalid_code", async () => {
    const deps = makeDeps();
    deps.authenticateWithMagicAuth.mockRejectedValue(new Error("code expired"));

    const result = await verifyLoginCode(deps, verify);

    expect(result).toEqual({ ok: false, error: "invalid_code" });
  });

  it("rate limits by email", async () => {
    const deps = makeDeps();
    deps.rateLimit.mockResolvedValue(false);

    const result = await verifyLoginCode(deps, verify);

    expect(result).toEqual({ ok: false, error: "rate_limited" });
    expect(deps.rateLimit).toHaveBeenCalledWith("verify:email:ana@lojaa.com");
    expect(deps.authenticateWithMagicAuth).not.toHaveBeenCalled();
  });

  it("lets a rateLimit failure propagate instead of calling it a wrong code", async () => {
    const deps = makeDeps();
    deps.rateLimit.mockRejectedValue(new Error("boom"));

    await expect(verifyLoginCode(deps, verify)).rejects.toThrow("boom");
    expect(deps.authenticateWithMagicAuth).not.toHaveBeenCalled();
  });

  it("returns the session on success", async () => {
    const deps = makeDeps();

    const result = await verifyLoginCode(deps, { ...verify, code: " 123456 " });

    expect(result).toEqual({ ok: true, session });
    expect(deps.authenticateWithMagicAuth).toHaveBeenCalledWith("ana@lojaa.com", "123456");
  });
});

describe("newOAuthState", () => {
  it("returns 32 random bytes as 64 hex characters, different every time", () => {
    const first = newOAuthState();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(newOAuthState()).not.toBe(first);
  });
});

describe("completeGoogleLogin", () => {
  beforeEach(() => {
    timingSafeEqualSpy.mockClear(); // braces: vitest would run a returned function as teardown
  });

  it.each([
    ["state missing", null, "abc"],
    ["cookie missing", "abc", null],
    ["both missing", null, null],
    ["both empty", "", ""],
    ["different content", "abc", "abd"],
    ["different length", "abc", "abcd"],
    ["cookie empty", "abc", ""],
  ])("rejects a missing or different state without calling WorkOS: %s", async (_name, state, cookieState) => {
    const deps = makeDeps();

    const result = await completeGoogleLogin(deps, { code: "authcode", state, cookieState });

    expect(result).toEqual({ ok: false, error: "state_mismatch" });
    expect(deps.authenticateWithCode).not.toHaveBeenCalled();
  });

  it.each([null, ""])("rejects a missing code %j", async (code) => {
    const deps = makeDeps();

    const result = await completeGoogleLogin(deps, { code, state: "abc", cookieState: "abc" });

    expect(result).toEqual({ ok: false, error: "auth_failed" });
    expect(deps.authenticateWithCode).not.toHaveBeenCalled();
  });

  it("maps a WorkOS failure to auth_failed", async () => {
    const deps = makeDeps();
    deps.authenticateWithCode.mockRejectedValue(new Error("invalid grant"));

    const result = await completeGoogleLogin(deps, { code: "authcode", state: "abc", cookieState: "abc" });

    expect(result).toEqual({ ok: false, error: "auth_failed" });
  });

  it("returns the session when state matches", async () => {
    const deps = makeDeps();

    const result = await completeGoogleLogin(deps, { code: "authcode", state: "abc", cookieState: "abc" });

    expect(result).toEqual({ ok: true, session });
    expect(deps.authenticateWithCode).toHaveBeenCalledWith("authcode");
  });

  it("compares the state with timingSafeEqual", async () => {
    await completeGoogleLogin(makeDeps(), { code: "authcode", state: "abc", cookieState: "abc" });

    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
  });
});
