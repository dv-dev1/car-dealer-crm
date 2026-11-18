import { saveSession } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { completeGoogleLogin, newOAuthState } from "./model";
import { createAuthDeps } from "./workos";

// Ties the Google callback to the browser that started the login; it lives only for the round trip.
const STATE_COOKIE = { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 } as const;

// On https the name ties the cookie to this host: a subdomain or plain http cannot set it. Browsers refuse the
// prefix on http, so the local preview keeps the plain name.
function stateCookieName(): string {
  return process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI?.startsWith("https://") ? "__Host-oauth_state" : "oauth_state";
}

// GET /entrar/google
export async function startGoogleLogin(): Promise<NextResponse> {
  const state = newOAuthState();
  const response = NextResponse.redirect(createAuthDeps().googleAuthorizationUrl(state));
  response.cookies.set({ ...STATE_COOKIE, name: stateCookieName(), value: state });
  return response;
}

// GET /callback
export async function finishGoogleLogin(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const result = await completeGoogleLogin(createAuthDeps(), {
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    cookieState: request.cookies.get(stateCookieName())?.value ?? null,
  });

  let saved = false;
  if (result.ok) {
    try {
      await saveSession(result.session, request);
      saved = true;
    } catch (error) {
      // saveSession verifies the token against WorkOS's JWKS; its message may carry user data.
      console.error("Saving the Google session failed", { name: (error as Error)?.name });
    }
  }
  const response = NextResponse.redirect(new URL(saved ? "/gestao" : "/entrar?erro=google", request.url));
  response.cookies.delete({ name: stateCookieName(), path: "/", secure: true });
  return response;
}
