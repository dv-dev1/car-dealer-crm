import { ROLES, UUID, withStore, type MemberContext, type Role } from "@/shared/db/client";
import { normalizeEmail } from "@/shared/email";

export type Member = { id: string; name: string; email: string; role: Role; linked: boolean };

const MAX_NAME_LENGTH = 120;
const UNIQUE_VIOLATION = "23505";

export function listMembers(ctx: MemberContext): Promise<Member[]> {
  return withStore(ctx, (db) =>
    db.query<Member>(
      `select id, name, email, role, workos_user_id is not null as linked
         from memberships where store_id = $1 order by name, email`,
      [ctx.storeId],
    ),
  );
}

// The database enforces the same permissions through RLS; the checks here pick the error to show.
export async function addMember(
  ctx: MemberContext,
  input: { name: string; email: string; role: Role },
): Promise<
  { ok: true } | { ok: false; error: "forbidden" | "owner_only" | "invalid_email" | "invalid_name" | "duplicate" }
> {
  if (!ROLES.includes(input.role)) throw new Error("addMember: role is not owner, manager or seller");
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (ctx.role === "manager" && input.role !== "seller") return { ok: false, error: "owner_only" };
  const name = input.name.trim();
  if (!name || name.length > MAX_NAME_LENGTH) return { ok: false, error: "invalid_name" };
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "invalid_email" };

  try {
    await withStore(ctx, (db) =>
      db.query("insert into memberships (store_id, email, name, role) values ($1, $2, $3, $4)", [
        ctx.storeId,
        email,
        name,
        input.role,
      ]),
    );
  } catch (error) {
    // Caught outside withStore: a failed statement aborts its transaction, so it cannot be handled inside.
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return { ok: false, error: "duplicate" };
    throw error;
  }
  return { ok: true };
}

export async function removeMember(
  ctx: MemberContext,
  membershipId: string,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "owner_only" | "last_owner" | "not_found" }> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  if (!UUID.test(membershipId)) return { ok: false, error: "not_found" }; // PostgreSQL would raise 22P02

  return withStore(ctx, async (db) => {
    const [target] = await db.query<{ role: Role }>(
      "select role from memberships where id = $1 and store_id = $2",
      [membershipId, ctx.storeId],
    );
    if (!target) return { ok: false, error: "not_found" };
    if (ctx.role === "manager" && target.role !== "seller") return { ok: false, error: "owner_only" };

    if (target.role === "owner") {
      // Two owners removing each other must queue: the second counts after the first one's commit.
      // Only an owner gets here, so RLS lets the lock see every owner row.
      const owners = await db.query<{ id: string }>(
        "select id from memberships where store_id = $1 and role = 'owner' order by id for update",
        [ctx.storeId],
      );
      if (owners.length === 1 && owners[0].id === membershipId) return { ok: false, error: "last_owner" };
    }

    // A concurrent removal of the same person leaves nothing to delete.
    const removed = await db.query("delete from memberships where id = $1 and store_id = $2 returning id", [
      membershipId,
      ctx.storeId,
    ]);
    return removed.length ? { ok: true } : { ok: false, error: "not_found" };
  });
}
