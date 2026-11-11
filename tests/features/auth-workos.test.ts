import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthDeps } from "@/features/auth/workos";
import { isLoginEmailAllowed } from "@/shared/db/client";

const workos = vi.hoisted(() => ({
  userManagement: {
    createMagicAuth: vi.fn(),
    authenticateWithMagicAuth: vi.fn(),
    authenticateWithCode: vi.fn(),
    getAuthorizationUrl: vi.fn(),
  },
}));
vi.mock("@workos-inc/authkit-nextjs", () => ({ getWorkOS: () => workos }));

const cloudflare = vi.hoisted(() => ({ getCloudflareContext: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => cloudflare);

const EMAIL = "ana@lojaa.com";
const CODE = "123456";
const waitUntil = vi.fn();
const limit = vi.fn();
const fetchMock = vi.fn();
let consoleError: ReturnType<typeof vi.spyOn>;

// What WorkOS's SDK builds from an API error: the message comes from the API and may echo input.
function workosError(message: string, fields: Record<string, unknown>) {
  return Object.assign(new Error(message), { name: "UnprocessableEntityException", ...fields });
}

function logged(): string {
  return JSON.stringify(consoleError.mock.calls, (_key, value) => (value instanceof Error ? value.message : value));
}

beforeEach(() => {
  vi.stubEnv("WORKOS_CLIENT_ID", "client_test");
  vi.stubEnv("NEXT_PUBLIC_WORKOS_REDIRECT_URI", "http://localhost:8787/callback");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
  vi.stubGlobal("fetch", fetchMock);
  cloudflare.getCloudflareContext.mockReturnValue({ env: { LOGIN_RATE_LIMITER: { limit } }, ctx: { waitUntil } });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("createMagicAuth", () => {
  it("returns before the WorkOS call settles and hands it to waitUntil", async () => {
    workos.userManagement.createMagicAuth.mockReturnValue(new Promise(() => {}));

    const outcome = await Promise.race([
      createAuthDeps().createMagicAuth(EMAIL).then(() => "returned"),
      new Promise((resolve) => setTimeout(() => resolve("waited"), 100)),
    ]);

    expect(outcome).toBe("returned");
    expect(workos.userManagement.createMagicAuth).toHaveBeenCalledWith({ email: EMAIL });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it("still starts the send and returns when there is no Worker context", async () => {
    workos.userManagement.createMagicAuth.mockReturnValue(new Promise(() => {}));
    cloudflare.getCloudflareContext.mockImplementation(() => {
      throw new Error("no Cloudflare context");
    });

    await expect(createAuthDeps().createMagicAuth(EMAIL)).resolves.toBeUndefined();
    expect(workos.userManagement.createMagicAuth).toHaveBeenCalledWith({ email: EMAIL });
  });

  it("logs a background send failure without the e-mail", async () => {
    workos.userManagement.createMagicAuth.mockRejectedValue(
      workosError(`Email ${EMAIL} is invalid`, { status: 422, code: "invalid_email" }),
    );

    await createAuthDeps().createMagicAuth(EMAIL);
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(logged()).toContain("422");
    expect(logged()).toContain("invalid_email");
    expect(logged()).not.toContain(EMAIL);
  });

  it("logs a synchronous client failure too", async () => {
    workos.userManagement.createMagicAuth.mockImplementation(() => {
      throw workosError("Missing API key", { status: 500 });
    });

    await expect(createAuthDeps().createMagicAuth(EMAIL)).resolves.toBeUndefined();
    await waitUntil.mock.calls[0][0];

    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe("authenticate calls", () => {
  it("authenticateWithMagicAuth returns the whole WorkOS response", async () => {
    const response = { accessToken: "a", refreshToken: "r", user: { id: "u" }, authenticationMethod: "MagicAuth" };
    workos.userManagement.authenticateWithMagicAuth.mockResolvedValue(response);

    await expect(createAuthDeps().authenticateWithMagicAuth(EMAIL, CODE)).resolves.toBe(response);
    expect(workos.userManagement.authenticateWithMagicAuth).toHaveBeenCalledWith({
      clientId: "client_test",
      email: EMAIL,
      code: CODE,
    });
  });

  it("authenticateWithCode returns the whole WorkOS response", async () => {
    const response = { accessToken: "a", refreshToken: "r", user: { id: "u" }, authenticationMethod: "GoogleOAuth" };
    workos.userManagement.authenticateWithCode.mockResolvedValue(response);

    await expect(createAuthDeps().authenticateWithCode("authcode")).resolves.toBe(response);
    expect(workos.userManagement.authenticateWithCode).toHaveBeenCalledWith({ clientId: "client_test", code: "authcode" });
  });

  it("logs an authenticateWithMagicAuth failure without e-mail or code, and rethrows it", async () => {
    const error = workosError(`Code ${CODE} for ${EMAIL} expired`, { status: 400, code: "invalid_one_time_code" });
    workos.userManagement.authenticateWithMagicAuth.mockRejectedValue(error);

    await expect(createAuthDeps().authenticateWithMagicAuth(EMAIL, CODE)).rejects.toBe(error);

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(logged()).toContain("invalid_one_time_code");
    expect(logged()).not.toContain(EMAIL);
    expect(logged()).not.toContain(CODE);
  });

  it("logs an authenticateWithCode failure without the code, and rethrows it", async () => {
    const error = Object.assign(new Error("Error: invalid_grant\nError Description: code authcode-secret expired"), {
      name: "OauthException",
      status: 400,
      error: "invalid_grant",
    });
    workos.userManagement.authenticateWithCode.mockRejectedValue(error);

    await expect(createAuthDeps().authenticateWithCode("authcode-secret")).rejects.toBe(error);

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(logged()).toContain("invalid_grant");
    expect(logged()).not.toContain("authcode-secret");
  });
});

describe("googleAuthorizationUrl", () => {
  it("asks WorkOS for a Google authorize URL with our state and redirect URI", () => {
    workos.userManagement.getAuthorizationUrl.mockReturnValue("https://api.workos.com/user_management/authorize?x");

    expect(createAuthDeps().googleAuthorizationUrl("state123")).toBe("https://api.workos.com/user_management/authorize?x");
    expect(workos.userManagement.getAuthorizationUrl).toHaveBeenCalledWith({
      provider: "GoogleOAuth",
      clientId: "client_test",
      redirectUri: "http://localhost:8787/callback",
      state: "state123",
    });
  });
});

describe("isLoginEmailAllowed", () => {
  it("is the database check", () => {
    expect(createAuthDeps().isLoginEmailAllowed).toBe(isLoginEmailAllowed);
  });
});

describe("rateLimit", () => {
  it.each([true, false])("returns the binding's success (%s) for the key", async (success) => {
    limit.mockResolvedValue({ success });

    await expect(createAuthDeps().rateLimit(`code:email:${EMAIL}`)).resolves.toBe(success);
    expect(limit).toHaveBeenCalledWith({ key: `code:email:${EMAIL}` });
  });

  it("fails closed and logs, without the key, when the binding throws", async () => {
    limit.mockRejectedValue(new Error(`limit failed for code:email:${EMAIL}`));

    await expect(createAuthDeps().rateLimit(`code:email:${EMAIL}`)).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(logged()).not.toContain(EMAIL);
  });

  it("fails closed when there is no Worker context", async () => {
    cloudflare.getCloudflareContext.mockImplementation(() => {
      throw new Error("no Cloudflare context");
    });

    await expect(createAuthDeps().rateLimit("code:ip:1.2.3.4")).resolves.toBe(false);
  });
});

describe("verifyTurnstile", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it("posts secret, token and ip to siteverify and accepts success: true", async () => {
    fetchMock.mockResolvedValue(ok({ success: true }));

    await expect(createAuthDeps().verifyTurnstile("tok", "1.2.3.4")).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
      secret: "turnstile-secret",
      response: "tok",
      remoteip: "1.2.3.4",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["success: false", () => ok({ success: false, "error-codes": ["invalid-input-response"] })],
    ["success not a boolean", () => ok({ success: "true" })],
    ["a non-JSON body", () => new Response("<html>", { status: 200 })],
    ["a non-2xx answer", () => new Response(JSON.stringify({ success: true }), { status: 500 })],
  ])("returns false on %s", async (_name, response) => {
    fetchMock.mockResolvedValue(response());

    await expect(createAuthDeps().verifyTurnstile("tok", "1.2.3.4")).resolves.toBe(false);
  });

  it.each([
    ["a network error", new TypeError("fetch failed")],
    ["a timeout", new DOMException("The operation was aborted due to timeout", "TimeoutError")],
  ])("fails closed and logs on %s", async (_name, error) => {
    fetchMock.mockRejectedValue(error);

    await expect(createAuthDeps().verifyTurnstile("tok", "1.2.3.4")).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("logs a non-2xx answer", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));

    await createAuthDeps().verifyTurnstile("tok", "1.2.3.4");

    expect(logged()).toContain("503");
  });
});
