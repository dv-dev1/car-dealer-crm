import { saveSession } from "@workos-inc/authkit-nextjs";
import type { AuthenticationResponse } from "@workos-inc/node";
import { NextResponse, type NextRequest } from "next/server";

import { completeGoogleLogin } from "@/features/auth/model";
import { createAuthDeps } from "@/features/auth/workos";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const result = await completeGoogleLogin(createAuthDeps(), {
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    cookieState: request.cookies.get("oauth_state")?.value ?? null,
  });

  // The adapter returns WorkOS's full AuthenticationResponse; AuthSession is only what the model reads.
  if (result.ok) await saveSession(result.session as AuthenticationResponse, request);
  const response = NextResponse.redirect(new URL(result.ok ? "/gestao" : "/entrar?erro=google", request.url));
  response.cookies.delete("oauth_state");
  return response;
}
