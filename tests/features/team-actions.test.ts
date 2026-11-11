import { beforeEach, describe, expect, it, vi } from "vitest";

import { addMemberAction, removeMemberAction } from "@/features/team/actions";
import type { MemberContext } from "@/shared/db/client";

const guard = vi.hoisted(() => ({ requireMember: vi.fn() }));
vi.mock("@/features/auth/guard", () => guard);

const model = vi.hoisted(() => ({ addMember: vi.fn(), removeMember: vi.fn() }));
vi.mock("@/features/team/model", () => model);

const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

const ctx: MemberContext = { storeId: "store-a", membershipId: "member-a", role: "owner", name: "Ana" };
const NO_ERROR = { error: null };
const FORBIDDEN = "Só o dono pode fazer isso.";

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

const dani = { name: "Dani", email: "dani@lojaa.com", role: "seller" };

beforeEach(() => {
  vi.resetAllMocks();
  guard.requireMember.mockResolvedValue(ctx);
  model.addMember.mockResolvedValue({ ok: true });
  model.removeMember.mockResolvedValue({ ok: true });
});

describe("addMemberAction", () => {
  it("asks for the member before anything else and stops when the guard redirects", async () => {
    guard.requireMember.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(addMemberAction(NO_ERROR, form(dani))).rejects.toThrow("NEXT_REDIRECT");
    expect(model.addMember).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();

    guard.requireMember.mockResolvedValue(ctx);
    await addMemberAction(NO_ERROR, form(dani));
    expect(guard.requireMember.mock.invocationCallOrder[1]).toBeLessThan(model.addMember.mock.invocationCallOrder[0]);
  });

  it("gives the model the caller from the guard and only name, email and role from the form", async () => {
    await addMemberAction(NO_ERROR, form({ ...dani, storeId: "store-b", callerRole: "owner", membershipId: "x" }));
    expect(model.addMember).toHaveBeenCalledExactlyOnceWith(ctx, dani);
  });

  it("revalidates the team page and clears the error on success", async () => {
    expect(await addMemberAction({ error: "old" }, form(dani))).toEqual(NO_ERROR);
    expect(cache.revalidatePath).toHaveBeenCalledExactlyOnceWith("/gestao/equipe");
  });

  it("answers forbidden without calling the model when the role is missing, not a string or unknown", async () => {
    const invalid: Array<Record<string, string | Blob>> = [
      { name: dani.name, email: dani.email },
      { ...dani, role: new Blob(["owner"]) },
      { ...dani, role: "admin" },
      { ...dani, role: "" },
      { ...dani, role: "Owner" },
    ];
    for (const fields of invalid) {
      expect(await addMemberAction(NO_ERROR, form(fields))).toEqual({ error: FORBIDDEN });
    }
    expect(model.addMember).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("counts a name or email that is not a string as empty", async () => {
    await addMemberAction(NO_ERROR, form({ name: new Blob(["x"]), role: "seller" }));
    expect(model.addMember).toHaveBeenCalledExactlyOnceWith(ctx, { name: "", email: "", role: "seller" });
  });

  it.each([
    ["forbidden", FORBIDDEN],
    ["owner_only", FORBIDDEN],
    ["invalid_email", "Digite um e-mail válido."],
    ["invalid_name", "Digite o nome."],
    ["duplicate", "Este e-mail já está na equipe."],
  ])("maps %s to its message and does not revalidate", async (error, message) => {
    model.addMember.mockResolvedValue({ ok: false, error });
    expect(await addMemberAction(NO_ERROR, form(dani))).toEqual({ error: message });
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("lets a database error reach the caller", async () => {
    model.addMember.mockRejectedValue(new Error("connection lost"));
    await expect(addMemberAction(NO_ERROR, form(dani))).rejects.toThrow("connection lost");
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("removeMemberAction", () => {
  const target = "0b8e1f0e-5a3c-4c53-9a39-6a6a2b0c8f11";

  it("asks for the member before anything else and stops when the guard redirects", async () => {
    guard.requireMember.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(removeMemberAction(NO_ERROR, form({ membershipId: target }))).rejects.toThrow("NEXT_REDIRECT");
    expect(model.removeMember).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();

    guard.requireMember.mockResolvedValue(ctx);
    await removeMemberAction(NO_ERROR, form({ membershipId: target }));
    expect(guard.requireMember.mock.invocationCallOrder[1]).toBeLessThan(
      model.removeMember.mock.invocationCallOrder[0],
    );
  });

  it("gives the model the caller from the guard and only the target id from the form", async () => {
    await removeMemberAction(NO_ERROR, form({ membershipId: target, storeId: "store-b", role: "owner" }));
    expect(model.removeMember).toHaveBeenCalledExactlyOnceWith(ctx, target);
  });

  it("counts a target id that is not a string as empty", async () => {
    await removeMemberAction(NO_ERROR, form({ membershipId: new Blob(["x"]) }));
    expect(model.removeMember).toHaveBeenCalledExactlyOnceWith(ctx, "");
  });

  it("revalidates the team page and clears the error on success", async () => {
    expect(await removeMemberAction({ error: "old" }, form({ membershipId: target }))).toEqual(NO_ERROR);
    expect(cache.revalidatePath).toHaveBeenCalledExactlyOnceWith("/gestao/equipe");
  });

  it.each([
    ["forbidden", FORBIDDEN],
    ["owner_only", FORBIDDEN],
    ["last_owner", "A loja precisa ter pelo menos um dono."],
    ["not_found", "Esta pessoa não está mais na equipe."],
  ])("maps %s to its message and does not revalidate", async (error, message) => {
    model.removeMember.mockResolvedValue({ ok: false, error });
    expect(await removeMemberAction(NO_ERROR, form({ membershipId: target }))).toEqual({ error: message });
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("lets a database error reach the caller", async () => {
    model.removeMember.mockRejectedValue(new Error("connection lost"));
    await expect(removeMemberAction(NO_ERROR, form({ membershipId: target }))).rejects.toThrow("connection lost");
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});
