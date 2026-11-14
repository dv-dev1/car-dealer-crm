import pg from "pg";
import { getConnectionString } from "./connection";

export const ROLES = ["owner", "manager", "seller"] as const;
export type Role = (typeof ROLES)[number];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type MemberContext = { membershipId: string; storeId: string; role: Role; name: string };
export type StoreMember = MemberContext & { storeName: string; isDemo: boolean };
export type Db = { query<T>(text: string, params?: unknown[]): Promise<T[]> };
export class UnsafeDatabaseRoleError extends Error {
  name = "UnsafeDatabaseRoleError";
}

// Superuser, BYPASSRLS and table ownership skip RLS. Any membership counts, even NOINHERIT: SET ROLE reaches it.
const UNSAFE_ROLE = `exists (select from pg_roles where (rolsuper or rolbypassrls) and pg_has_role(current_user, oid, 'member'))
  or exists (select from pg_tables where schemaname = 'public' and pg_has_role(current_user, tableowner, 'member'))`;
const ENTER_STORE = `select set_config('app.store_id', $1, true), set_config('app.role', $2, true),
  set_config('app.membership_id', $3, true), ${UNSAFE_ROLE} as unsafe`;
const ENTER_LOGIN = `select ${UNSAFE_ROLE} as unsafe`;

// One client per call: a Worker cannot reuse a socket across requests.
async function transaction<T>(enter: string, params: string[], fn: (db: Db) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: getConnectionString() });
  let dropped: Error | undefined;
  // Without a listener, a dropped socket or a server FATAL is thrown as an uncaught exception.
  client.on("error", (error) => {
    dropped ??= error;
  });
  try {
    await client.connect();
    try {
      await client.query("begin");
      const [{ unsafe }] = (await client.query<{ unsafe: boolean }>(enter, params)).rows;
      if (unsafe) throw new UnsafeDatabaseRoleError("database role bypasses row level security");
      const result = await fn({ query: async (text, values) => (await client.query(text, values)).rows });
      // After a failed statement PostgreSQL answers COMMIT with ROLLBACK, not with an error.
      if ((await client.query("commit")).command !== "COMMIT") {
        throw new Error("transaction was aborted by a failed statement and rolled back");
      }
      return result;
    } catch (error) {
      const cause = dropped ?? error; // the server's reason, not pg's generic "not queryable"
      await client.query("rollback").catch(() => {}); // a dead connection must not hide the real error
      throw cause;
    }
  } finally {
    await client.end();
  }
}

export async function withStore<T>(
  ctx: Pick<MemberContext, "storeId" | "role" | "membershipId">,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  if (!UUID.test(ctx.storeId)) throw new Error("withStore: storeId is not a uuid");
  if (!ROLES.includes(ctx.role)) throw new Error("withStore: role is not owner, manager or seller");
  if (!UUID.test(ctx.membershipId)) throw new Error("withStore: membershipId is not a uuid");
  return transaction(ENTER_STORE, [ctx.storeId, ctx.role, ctx.membershipId], fn);
}

// Login runs before any store is known; the SQL functions are security definer for that reason.
export async function resolveMembership(identity: {
  workosUserId: string;
  email: string;
  emailVerified: boolean;
}): Promise<StoreMember | null> {
  const rows = await transaction(ENTER_LOGIN, [], (db) =>
    db.query<StoreMember>(
      `select membership_id as "membershipId", store_id as "storeId", role, name,
              store_name as "storeName", store_is_demo as "isDemo"
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
