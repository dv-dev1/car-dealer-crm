import pg from "pg";
import { getConnectionString } from "./connection";

export type Role = "owner" | "manager" | "seller";
export type MemberContext = { membershipId: string; storeId: string; role: Role; name: string };
export type Db = { query<T>(text: string, params?: unknown[]): Promise<T[]> };
export class UnsafeDatabaseRoleError extends Error {}

const ROLES: Role[] = ["owner", "manager", "seller"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A superuser, a BYPASSRLS role or a table owner (directly or through an inherited role) skips RLS.
const UNSAFE_ROLE = `(select rolsuper or rolbypassrls from pg_roles where rolname = current_user)
  or exists (select from pg_tables where schemaname = 'public' and pg_has_role(current_user, tableowner, 'usage'))`;
const ENTER_STORE = `select set_config('app.store_id', $1, true), set_config('app.role', $2, true), ${UNSAFE_ROLE} as unsafe`;
const ENTER_LOGIN = `select ${UNSAFE_ROLE} as unsafe`;

// One client per call: a Worker cannot reuse a socket across requests.
async function transaction<T>(enter: string, params: string[], fn: (db: Db) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: getConnectionString() });
  try {
    await client.connect();
    await client.query("begin");
    try {
      const [{ unsafe }] = (await client.query<{ unsafe: boolean }>(enter, params)).rows;
      // Fails closed: a null answer counts as unsafe.
      if (unsafe !== false) throw new UnsafeDatabaseRoleError("database role bypasses row level security");
      const result = await fn({ query: async (text, values) => (await client.query(text, values)).rows });
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {}); // a dead connection must not hide the real error
      throw error;
    }
  } finally {
    await client.end();
  }
}

export async function withStore<T>(
  ctx: Pick<MemberContext, "storeId" | "role">,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  if (!UUID.test(ctx.storeId)) throw new Error("withStore: storeId is not a uuid");
  if (!ROLES.includes(ctx.role)) throw new Error("withStore: role is not owner, manager or seller");
  return transaction(ENTER_STORE, [ctx.storeId, ctx.role], fn);
}

// Login runs before any store is known; the SQL functions are security definer for that reason.
export async function resolveMembership(identity: {
  workosUserId: string;
  email: string;
  emailVerified: boolean;
}): Promise<MemberContext | null> {
  const rows = await transaction(ENTER_LOGIN, [], (db) =>
    db.query<MemberContext>(
      `select membership_id as "membershipId", store_id as "storeId", role, name
         from resolve_membership($1, $2, $3)`,
      [identity.workosUserId, identity.email, identity.emailVerified],
    ),
  );
  return rows[0] ?? null;
}

export async function isLoginEmailAllowed(email: string): Promise<boolean> {
  const rows = await transaction(ENTER_LOGIN, [], (db) =>
    db.query<{ allowed: boolean }>("select login_email_allowed($1) as allowed", [email]),
  );
  return rows[0].allowed;
}
