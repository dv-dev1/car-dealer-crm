import { NextResponse } from "next/server";

import { newOAuthState } from "@/features/auth/model";
import { createAuthDeps } from "@/features/auth/workos";

// The state must be new on every visit: never prerender or cache this route.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const state = newOAuthState();
  const response = NextResponse.redirect(createAuthDeps().googleAuthorizationUrl(state));
  response.cookies.set("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600 });
  return response;
}
