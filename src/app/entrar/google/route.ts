import { NextResponse } from "next/server";

import { newOAuthState } from "@/features/auth/model";
import { createAuthDeps } from "@/features/auth/workos";

export async function GET(): Promise<NextResponse> {
  const state = newOAuthState();
  const response = NextResponse.redirect(createAuthDeps().googleAuthorizationUrl(state));
  response.cookies.set("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600 });
  return response;
}
