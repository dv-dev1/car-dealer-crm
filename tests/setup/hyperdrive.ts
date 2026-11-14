// Stands in for @opennextjs/cloudflare: the app reaches its database only through the Hyperdrive
// binding (src/shared/db/connection.ts). Use with
//   vi.mock("@opennextjs/cloudflare", () => import("../setup/hyperdrive.ts"));
// and point the binding at a database with useDatabase(url).
let connectionString = "";
let photos: unknown = null;

export function useDatabase(url: string): void {
  connectionString = url;
}

// The R2 bucket the app's photos go to; tests pass a fakeBucket() from ./bucket.ts.
export function usePhotoBucket(bucket: unknown): void {
  photos = bucket;
}

export function getCloudflareContext() {
  // An empty URL would let pg fall back to the PG* variables or localhost:5432: refuse instead.
  if (!connectionString) throw new Error("No test database: call useDatabase(url) first");
  return { env: { HYPERDRIVE: { connectionString }, PHOTOS: photos } };
}
