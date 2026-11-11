import { saveSession } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { completeGoogleLogin, newOAuthState } from "./model";
import { createAuthDeps, sessionToSave } from "./workos";

// Ties the Google callback to the browser that started the login; it lives only for the round trip.
const STATE_COOKIE = { name: "oauth_state", httpOnly: true, secure: true, sameSite: "lax", maxAge: 600 } as const;

// GET /entrar/google
export async function startGoogleLogin(): Promise<NextResponse> {
  const state = newOAuthState();
  const response = NextResponse.redirect(createAuthDeps().googleAuthorizationUrl(state));
  response.cookies.set({ ...STATE_COOKIE, value: state });
  return response;
}

// GET /callback
export async function finishGoogleLogin(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const result = await completeGoogleLogin(createAuthDeps(), {
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    cookieState: request.cookies.get(STATE_COOKIE.name)?.value ?? null,
  });

  let saved = false;
  if (result.ok) {
    try {
      await saveSession(sessionToSave(result.session), request);
      saved = true;
    } catch (error) {
      // saveSession verifies the token against WorkOS's JWKS; its message may carry user data.
      console.error("Saving the Google session failed", { name: (error as Error)?.name });
    }
  }
  const response = NextResponse.redirect(new URL(saved ? "/gestao" : "/entrar?erro=google", request.url));
  response.cookies.delete(STATE_COOKIE.name);
  return response;
}
