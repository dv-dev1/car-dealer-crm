"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { VIEW_AS_COOKIE, requireDemoOwner } from "@/features/auth/guard";
import { text } from "@/shared/form";

import { getDemoPanel, restoreDemoStore } from "./model";

export type DemoState = { error: string | null; done: boolean };

const MESSAGES = {
  not_demo: "Só a loja de demonstração pode ser restaurada.",
  forbidden: "Só o dono pode restaurar a demo.",
};
const CLEAR = { name: VIEW_AS_COOKIE, path: "/gestao" };

// Empty or the owner's own id goes back to the owner's view; anyone outside the team changes nothing.
export async function viewAsAction(form: FormData): Promise<void> {
  const owner = await requireDemoOwner();
  const chosen = text(form, "membershipId");
  const jar = await cookies();
  if (!chosen || chosen === owner.membershipId) jar.delete(CLEAR);
  else if ((await getDemoPanel(owner)).team.some((member) => member.membershipId === chosen)) {
    jar.set(VIEW_AS_COOKIE, chosen, { httpOnly: true, sameSite: "lax", path: "/gestao", secure: true });
  }
  redirect("/gestao");
}

export async function restoreDemoAction(_prev: DemoState, _form: FormData): Promise<DemoState> {
  const owner = await requireDemoOwner();
  const result = await restoreDemoStore(owner);
  if (!result.ok) return { error: MESSAGES[result.error], done: false };
  (await cookies()).delete(CLEAR); // the member being viewed may be gone with the old demo
  revalidatePath("/gestao", "layout");
  return { error: null, done: true };
}
