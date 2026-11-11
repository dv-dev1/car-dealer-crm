import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addMember, listMembers, removeMember } from "@/features/team/model";
import type { MemberContext, Role } from "@/shared/db/client";
import { seedTwoStores } from "../db/fixtures.ts";
import { useDatabase } from "../setup/hyperdrive.ts";
import { TEST_ADMIN_URL, TEST_APP_URL } from "../setup/urls.ts";

vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));

const UNREACHABLE_URL = "postgres://nobody@127.0.0.1:1/none";

let seed: Awaited<ReturnType<typeof seedTwoStores>>;
let ana: MemberContext;
let beto: MemberContext;
let carla: MemberContext;
beforeEach(async () => {
  useDatabase(TEST_APP_URL);
  seed = await seedTwoStores();
  ana = { membershipId: seed.a.ana.id, storeId: seed.a.storeId, role: "owner", name: "Ana" };
  beto = { membershipId: seed.a.beto.id, storeId: seed.a.storeId, role: "seller", name: "Beto" };
  carla = { membershipId: seed.b.carla.id, storeId: seed.b.storeId, role: "owner", name: "Carla" };
});

async function adminQuery(sql: string, params: unknown[] = []) {
  const admin = new pg.Client({ connectionString: TEST_ADMIN_URL });
  await admin.connect();
  try {
    return (await admin.query(sql, params)).rows;
  } finally {
    await admin.end();
  }
}

// Inserted as admin, like the fixture: the fixture has no manager and no second owner.
async function seedMember(role: Role, name: string, email: string): Promise<MemberContext> {
  const sql = "insert into memberships (store_id, name, email, role) values ($1, $2, $3, $4) returning id";
  const [{ id }] = await adminQuery(sql, [seed.a.storeId, name, email, role]);
  return { membershipId: id, storeId: seed.a.storeId, role, name };
}

const names = async (ctx: MemberContext) => (await listMembers(ctx)).map((member) => member.name);
const outcome = (result: { ok: true } | { ok: false; error: string }) => (result.ok ? "ok" : result.error);
const dani = { name: "Dani", email: "dani@lojaa.com", role: "seller" } as const;

it("lists only members of the caller's store, by name", async () => {
  expect(await names(ana)).toEqual(["Ana", "Beto"]);
  expect(await names(beto)).toEqual(["Ana", "Beto"]);
  expect(await names(carla)).toEqual(["Carla"]);
});

it("reports linked from the WorkOS link without exposing the id", async () => {
  await adminQuery("update memberships set workos_user_id = 'user_ana' where id = $1", [ana.membershipId]);
  expect(await listMembers(beto)).toEqual([
    { id: ana.membershipId, name: "Ana", email: "ana@lojaa.com", role: "owner", linked: true },
    { id: beto.membershipId, name: "Beto", email: "beto@lojaa.com", role: "seller", linked: false },
  ]);
});

it("seller cannot add", async () => {
  expect(await addMember(beto, dani)).toEqual({ ok: false, error: "forbidden" });
  expect(await names(ana)).toEqual(["Ana", "Beto"]);
});

it("manager adds a seller but not a manager", async () => {
  const marta = await seedMember("manager", "Marta", "marta@lojaa.com");
  expect(await addMember(marta, dani)).toEqual({ ok: true });
  expect(await addMember(marta, { ...dani, name: "Eva", email: "eva@lojaa.com", role: "manager" })).toEqual({
    ok: false,
    error: "owner_only",
  });
  expect(await addMember(marta, { ...dani, name: "Fred", email: "fred@lojaa.com", role: "owner" })).toEqual({
    ok: false,
    error: "owner_only",
  });
  expect(await names(ana)).toEqual(["Ana", "Beto", "Dani", "Marta"]);
});

it("owner adds a manager", async () => {
  expect(await addMember(ana, { ...dani, role: "manager" })).toEqual({ ok: true });
  expect(await listMembers(ana)).toContainEqual(
    expect.objectContaining({ name: "Dani", role: "manager", linked: false }),
  );
});

it("normalizes the invited email", async () => {
  expect(await addMember(ana, { ...dani, email: "  Dani@LojaA.com " })).toEqual({ ok: true });
  expect(await listMembers(ana)).toContainEqual(expect.objectContaining({ name: "Dani", email: "dani@lojaa.com" }));
});

it("rejects a duplicate email in the same store", async () => {
  expect(await addMember(ana, { ...dani, email: "BETO@lojaa.com" })).toEqual({ ok: false, error: "duplicate" });
  expect(await names(ana)).toEqual(["Ana", "Beto"]);
});

it("accepts the same email in another store", async () => {
  expect(await addMember(carla, { ...dani, name: "Beto", email: "beto@lojaa.com" })).toEqual({ ok: true });
  expect(await names(carla)).toEqual(["Beto", "Carla"]);
});

it("rejects an empty name and an invalid email", async () => {
  expect(await addMember(ana, { ...dani, name: "" })).toEqual({ ok: false, error: "invalid_name" });
  for (const email of ["", "dani", "dani@lojaa", "dani @lojaa.com"]) {
    expect(await addMember(ana, { ...dani, email })).toEqual({ ok: false, error: "invalid_email" });
  }
  expect(await names(ana)).toEqual(["Ana", "Beto"]);
});

it("trims the name and rejects a blank or over-long one", async () => {
  for (const name of [" ", " \t\n ", "x".repeat(121), ` ${"x".repeat(121)} `]) {
    expect(await addMember(ana, { ...dani, name })).toEqual({ ok: false, error: "invalid_name" });
  }
  expect(await addMember(ana, { ...dani, name: `  ${"x".repeat(120)}  ` })).toEqual({ ok: true });
  expect(await names(ana)).toEqual(["Ana", "Beto", "x".repeat(120)]);
});

it("checks the role first, then the name, then the email", async () => {
  const marta = await seedMember("manager", "Marta", "marta@lojaa.com");
  const nothing = { name: "", email: "nope", role: "seller" } as const;
  expect(await addMember(beto, nothing)).toEqual({ ok: false, error: "forbidden" });
  expect(await addMember(marta, { ...nothing, role: "manager" })).toEqual({ ok: false, error: "owner_only" });
  expect(await addMember(ana, nothing)).toEqual({ ok: false, error: "invalid_name" });
  expect(await addMember(ana, { ...nothing, name: "Dani" })).toEqual({ ok: false, error: "invalid_email" });
});

it("gives one ok and one duplicate when the same email is added at once", async () => {
  const results = await Promise.all([addMember(ana, dani), addMember(ana, dani)]);
  expect(results.map(outcome).sort()).toEqual(["duplicate", "ok"]);
  expect(await names(ana)).toEqual(["Ana", "Beto", "Dani"]);
});

it("throws on a role outside owner, manager and seller", async () => {
  const marta = await seedMember("manager", "Marta", "marta@lojaa.com");
  for (const caller of [ana, marta, beto]) {
    await expect(addMember(caller, { ...dani, role: "admin" as Role })).rejects.toThrow(/addMember: role/);
  }
  expect(await names(ana)).toEqual(["Ana", "Beto", "Marta"]);
});

it("cannot remove the last owner", async () => {
  expect(await removeMember(ana, ana.membershipId)).toEqual({ ok: false, error: "last_owner" });
  expect(await names(ana)).toEqual(["Ana", "Beto"]);
});

it("owner removes another owner while one remains", async () => {
  const olga = await seedMember("owner", "Olga", "olga@lojaa.com");
  expect(await removeMember(ana, olga.membershipId)).toEqual({ ok: true });
  expect(await names(ana)).toEqual(["Ana", "Beto"]);
});

it("never leaves the store without an owner when two owners remove each other at once", async () => {
  // A single attempt may not overlap, so it runs several times.
  for (let round = 0; round < 6; round++) {
    await seedMember("owner", `Olga ${round}`, `olga${round}@lojaa.com`);
    const [first, second] = (await listMembers(ana)).filter((member) => member.role === "owner");
    const results = await Promise.all([removeMember(ana, second.id), removeMember(ana, first.id)]);
    expect(results.map(outcome).sort()).toEqual(["last_owner", "ok"]);
    expect((await listMembers(ana)).filter((member) => member.role === "owner")).toHaveLength(1);
  }
});

it("manager cannot remove an owner", async () => {
  const marta = await seedMember("manager", "Marta", "marta@lojaa.com");
  expect(await removeMember(marta, ana.membershipId)).toEqual({ ok: false, error: "owner_only" });
  expect(await removeMember(marta, marta.membershipId)).toEqual({ ok: false, error: "owner_only" });
  expect(await names(ana)).toEqual(["Ana", "Beto", "Marta"]);
});

it("manager removes a seller", async () => {
  const marta = await seedMember("manager", "Marta", "marta@lojaa.com");
  expect(await removeMember(marta, beto.membershipId)).toEqual({ ok: true });
  expect(await names(ana)).toEqual(["Ana", "Marta"]);
});

it("seller cannot remove", async () => {
  expect(await removeMember(beto, ana.membershipId)).toEqual({ ok: false, error: "forbidden" });
  expect(await removeMember(beto, beto.membershipId)).toEqual({ ok: false, error: "forbidden" });
  expect(await names(ana)).toEqual(["Ana", "Beto"]);
});

it("removing a member from another store is not_found", async () => {
  expect(await removeMember(ana, carla.membershipId)).toEqual({ ok: false, error: "not_found" });
  expect(await names(carla)).toEqual(["Carla"]);
});

it("removing an id that no longer exists is not_found", async () => {
  expect(await removeMember(ana, randomUUID())).toEqual({ ok: false, error: "not_found" });
});

it("answers not_found for an id that is not a uuid without touching the database", async () => {
  useDatabase(UNREACHABLE_URL);
  for (const id of ["", "not-a-uuid", `${beto.membershipId}' or true --`, ` ${beto.membershipId}`]) {
    expect(await removeMember(ana, id)).toEqual({ ok: false, error: "not_found" });
  }
});

it("owner removes a seller", async () => {
  expect(await removeMember(ana, beto.membershipId)).toEqual({ ok: true });
  expect(await listMembers(ana)).toHaveLength(1);
});
