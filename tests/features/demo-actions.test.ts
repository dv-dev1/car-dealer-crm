import { beforeEach, describe, expect, it, vi } from "vitest";

import { restoreDemoAction, viewAsAction } from "@/features/demo/actions";
import type { StoreMember } from "@/shared/db/client";

const guard = vi.hoisted(() => ({ requireDemoOwner: vi.fn(), VIEW_AS_COOKIE: "view_as" }));
vi.mock("@/features/auth/guard", () => guard);

const model = vi.hoisted(() => ({ restoreDemoStore: vi.fn(), getDemoPanel: vi.fn() }));
vi.mock("@/features/demo/model", () => model);

const jar = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/navigation", () => nav);

const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

const OWNER = "11111111-1111-4111-8111-111111111111";
const SELLER = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";
const ana: StoreMember = { membershipId: OWNER, storeId: "store-a", role: "owner", name: "Ana", storeName: "Maré Veículos", isDemo: true };
const CLEAR = { name: "view_as", path: "/gestao" };
const START = { error: null, done: false };

function form(membershipId?: string): FormData {
  const data = new FormData();
  if (membershipId !== undefined) data.append("membershipId", membershipId);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  guard.requireDemoOwner.mockResolvedValue(ana);
  model.getDemoPanel.mockResolvedValue({
    restoredOn: "2026-11-13",
    team: [
      { membershipId: OWNER, name: "Ana", role: "owner" },
      { membershipId: SELLER, name: "Bruno Farias", role: "seller" },
    ],
  });
  model.restoreDemoStore.mockResolvedValue({ ok: true });
});

describe("viewAsAction", () => {
  it("asks for the demo owner before anything else", async () => {
    guard.requireDemoOwner.mockRejectedValue(new Error("NEXT_REDIRECT /gestao"));
    await expect(viewAsAction(form(SELLER))).rejects.toThrow("NEXT_REDIRECT /gestao");
    expect(jar.set).not.toHaveBeenCalled();
    expect(jar.delete).not.toHaveBeenCalled();
    expect(model.getDemoPanel).not.toHaveBeenCalled();
  });

  it("sets the cookie for a team member and clears it for the owner", async () => {
    await expect(viewAsAction(form(SELLER))).rejects.toThrow("NEXT_REDIRECT /gestao");
    expect(jar.set).toHaveBeenCalledExactlyOnceWith("view_as", SELLER, { httpOnly: true, sameSite: "lax", path: "/gestao", secure: true });
    expect(model.getDemoPanel).toHaveBeenCalledWith(ana);

    vi.clearAllMocks();
    for (const value of [OWNER, "", undefined]) {
      await expect(viewAsAction(form(value))).rejects.toThrow("NEXT_REDIRECT /gestao");
    }
    expect(jar.delete).toHaveBeenCalledTimes(3);
    expect(jar.delete).toHaveBeenCalledWith(CLEAR);
    expect(jar.set).not.toHaveBeenCalled();
  });

  it("sets nothing for a member outside the team", async () => {
    for (const value of [OUTSIDER, "not-a-uuid"]) {
      await expect(viewAsAction(form(value))).rejects.toThrow("NEXT_REDIRECT /gestao");
    }
    expect(jar.set).not.toHaveBeenCalled();
    expect(jar.delete).not.toHaveBeenCalled();
  });
});

describe("restoreDemoAction", () => {
  it("asks for the demo owner before restoring", async () => {
    guard.requireDemoOwner.mockRejectedValue(new Error("NEXT_REDIRECT /gestao"));
    await expect(restoreDemoAction(START, form())).rejects.toThrow("NEXT_REDIRECT /gestao");
    expect(model.restoreDemoStore).not.toHaveBeenCalled();
  });

  it("restores, clears the view-as cookie and revalidates the layout", async () => {
    expect(await restoreDemoAction(START, form())).toEqual({ error: null, done: true });
    expect(model.restoreDemoStore).toHaveBeenCalledExactlyOnceWith(ana);
    expect(jar.delete).toHaveBeenCalledWith(CLEAR);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/gestao", "layout");
  });

  it("shows the not-demo message", async () => {
    model.restoreDemoStore.mockResolvedValue({ ok: false, error: "not_demo" });
    expect(await restoreDemoAction(START, form())).toEqual({ error: "Só a loja de demonstração pode ser restaurada.", done: false });
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("shows the owner-only message", async () => {
    model.restoreDemoStore.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await restoreDemoAction(START, form())).toEqual({ error: "Só o dono pode restaurar a demo.", done: false });
  });
});
