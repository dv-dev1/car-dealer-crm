import { getCloudflareContext } from "@opennextjs/cloudflare";

// Hyperdrive is the only way in. `next dev` and the preview get the binding's localConnectionString
// (wrangler.jsonc) through initOpenNextCloudflareForDev() in next.config.ts; scripts use MIGRATE_DATABASE_URL.
export function getConnectionString(): string {
  const env = getCloudflareContext().env as { HYPERDRIVE: { connectionString: string } };
  return env.HYPERDRIVE.connectionString;
}
