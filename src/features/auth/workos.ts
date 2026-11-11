import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getWorkOS } from "@workos-inc/authkit-nextjs";

import { isLoginEmailAllowed } from "@/shared/db/client";
import type { AuthDeps } from "./model";

type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TIMEOUT_MS = 5000;

// WorkOS error messages come from its API and can echo the e-mail or the code: log fixed fields only.
function logWorkOSError(operation: string, error: unknown): void {
  const { name, status, code, error: oauthError } = (error ?? {}) as Record<string, unknown>;
  console.error(`WorkOS ${operation} failed`, { name, status, code: code ?? oauthError });
}

async function sendMagicAuth(email: string): Promise<void> {
  try {
    await getWorkOS().userManagement.createMagicAuth({ email });
  } catch (error) {
    logWorkOSError("createMagicAuth", error);
  }
}

async function logged<T>(operation: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    logWorkOSError(operation, error);
    throw error;
  }
}

export function createAuthDeps(): AuthDeps {
  const clientId = process.env.WORKOS_CLIENT_ID ?? "";
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? "";

  return {
    async createMagicAuth(email) {
      // Not awaited: invited and uninvited e-mails must answer in the same time.
      const send = sendMagicAuth(email);
      try {
        getCloudflareContext().ctx.waitUntil(send);
      } catch {
        // No Worker context (plain `next dev`): the promise keeps running on its own.
      }
    },
    // The full AuthenticationResponse is returned: saveSession needs more than AuthSession.
    authenticateWithMagicAuth: (email, code) =>
      logged("authenticateWithMagicAuth", () =>
        getWorkOS().userManagement.authenticateWithMagicAuth({ clientId, email, code }),
      ),
    authenticateWithCode: (code) =>
      logged("authenticateWithCode", () => getWorkOS().userManagement.authenticateWithCode({ clientId, code })),
    googleAuthorizationUrl: (state) =>
      getWorkOS().userManagement.getAuthorizationUrl({ provider: "GoogleOAuth", clientId, redirectUri, state }),
    isLoginEmailAllowed,
    async rateLimit(key) {
      try {
        const env = getCloudflareContext().env as { LOGIN_RATE_LIMITER: RateLimiter };
        return (await env.LOGIN_RATE_LIMITER.limit({ key })).success;
      } catch (error) {
        // The key holds the e-mail, and the binding's message may repeat it.
        console.error("Login rate limiter failed", { name: (error as Error)?.name });
        return false;
      }
    },
    async verifyTurnstile(token, ip) {
      try {
        const response = await fetch(TURNSTILE_VERIFY_URL, {
          method: "POST",
          body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY ?? "", response: token, remoteip: ip }),
          signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
        });
        if (!response.ok) {
          console.error("Turnstile siteverify failed", { status: response.status });
          return false;
        }
        const { success } = (await response.json()) as { success?: unknown };
        return success === true;
      } catch (error) {
        console.error("Turnstile siteverify failed", { name: (error as Error)?.name, message: (error as Error)?.message });
        return false;
      }
    },
  };
}
