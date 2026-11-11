import { timingSafeEqual } from "node:crypto";

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; emailVerified: boolean };
};

// S is the adapter's session type: the model reads only AuthSession, callers get S back untouched.
export type AuthDeps<S extends AuthSession = AuthSession> = {
  // Must return without waiting on the network: the adapter schedules the send in the background
  // (ctx.waitUntil) and logs failures there, so invited and uninvited emails take the same time.
  createMagicAuth(email: string): Promise<void>;
  authenticateWithMagicAuth(email: string, code: string): Promise<S>;
  authenticateWithCode(code: string): Promise<S>;
  googleAuthorizationUrl(state: string): string;
  isLoginEmailAllowed(email: string): Promise<boolean>;
  rateLimit(key: string): Promise<boolean>; // true = allowed
  verifyTurnstile(token: string, ip: string): Promise<boolean>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_CODE_PATTERN = /^\d{6}$/;

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export async function requestLoginCode(
  deps: AuthDeps,
  input: { email: string; turnstileToken: string; ip: string },
): Promise<{ ok: true } | { ok: false; error: "invalid_email" | "rate_limited" | "captcha_failed" }> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "invalid_email" };

  if (!(await deps.verifyTurnstile(input.turnstileToken, input.ip))) return { ok: false, error: "captcha_failed" };

  // Sequential on purpose: a limited ip must not burn the email's budget.
  if (!(await deps.rateLimit(`code:ip:${input.ip}`))) return { ok: false, error: "rate_limited" };
  if (!(await deps.rateLimit(`code:email:${email}`))) return { ok: false, error: "rate_limited" };

  // Uninvited emails get the same answer and no message, so the form never reveals who is invited.
  if (await deps.isLoginEmailAllowed(email)) {
    try {
      await deps.createMagicAuth(email);
    } catch {
      // A send failure must look the same as success for the same reason.
    }
  }
  return { ok: true };
}

export async function verifyLoginCode<S extends AuthSession>(
  deps: AuthDeps<S>,
  input: { email: string; code: string; ip: string },
): Promise<{ ok: true; session: S } | { ok: false; error: "invalid_code" | "rate_limited" }> {
  const email = normalizeEmail(input.email);
  const code = input.code.trim();
  if (!email || !LOGIN_CODE_PATTERN.test(code)) return { ok: false, error: "invalid_code" };

  if (!(await deps.rateLimit(`verify:email:${email}`))) return { ok: false, error: "rate_limited" };

  try {
    return { ok: true, session: await deps.authenticateWithMagicAuth(email, code) };
  } catch {
    return { ok: false, error: "invalid_code" };
  }
}

export function newOAuthState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameState(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function completeGoogleLogin<S extends AuthSession>(
  deps: AuthDeps<S>,
  input: { code: string | null; state: string | null; cookieState: string | null },
): Promise<{ ok: true; session: S } | { ok: false; error: "state_mismatch" | "auth_failed" }> {
  const { code, state, cookieState } = input;
  if (!state || !cookieState || !sameState(state, cookieState)) return { ok: false, error: "state_mismatch" };
  if (!code) return { ok: false, error: "auth_failed" };

  try {
    return { ok: true, session: await deps.authenticateWithCode(code) };
  } catch {
    return { ok: false, error: "auth_failed" };
  }
}
