import { saveSession } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { completeGoogleLogin } from "@/features/auth/model";
import { createAuthDeps, sessionToSave } from "@/features/auth/workos";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const result = await completeGoogleLogin(createAuthDeps(), {
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    cookieState: request.cookies.get("oauth_state")?.value ?? null,
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
  response.cookies.delete("oauth_state");
  return response;
}
