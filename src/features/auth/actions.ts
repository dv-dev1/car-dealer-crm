"use server";

import { saveSession, signOut } from "@workos-inc/authkit-nextjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requestLoginCode, verifyLoginCode } from "./model";
import { createAuthDeps, sessionToSave } from "./workos";

export type LoginState = { step: "email" | "code"; email: string; error: string | null };

// FormData values can be null or a File: anything that is not a string counts as empty.
function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

async function clientIp(): Promise<string> {
  return (await headers()).get("cf-connecting-ip")?.trim() ?? "";
}

export async function requestCodeAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = text(form, "email");
  const ip = await clientIp();
  if (!ip) return { step: "email", email, error: "captcha_failed" };

  const result = await requestLoginCode(createAuthDeps(), {
    email,
    turnstileToken: text(form, "cf-turnstile-response"),
    ip,
  });
  return result.ok ? { step: "code", email, error: null } : { step: "email", email, error: result.error };
}

export async function verifyCodeAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = text(form, "email");
  const ip = await clientIp();
  if (!ip) return { step: "code", email, error: "captcha_failed" };

  const result = await verifyLoginCode(createAuthDeps(), { email, code: text(form, "code"), ip });
  if (!result.ok) return { step: "code", email, error: result.error };

  await saveSession(sessionToSave(result.session), process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? "");
  redirect("/gestao");
}

export async function signOutAction(): Promise<void> {
  // A missing or broken redirect URI must not stop signOut from deleting the session cookie.
  await signOut({ returnTo: URL.parse("/entrar", process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI)?.href ?? "/entrar" });
}
