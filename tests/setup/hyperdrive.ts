// Stands in for @opennextjs/cloudflare: the app reaches its database only through the Hyperdrive
// binding (src/shared/db/connection.ts). Use with
//   vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
// and point the binding at a database with useDatabase(url).
let connectionString = "";

export function useDatabase(url: string): void {
  connectionString = url;
}

export function getCloudflareContext() {
  // An empty URL would let pg fall back to the PG* variables or localhost:5432: refuse instead.
  if (!connectionString) throw new Error("No test database: call useDatabase(url) first");
  return { env: { HYPERDRIVE: { connectionString } } };
}
