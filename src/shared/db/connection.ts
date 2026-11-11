import { getCloudflareContext } from "@opennextjs/cloudflare";

// Tests and scripts have no Worker: the env var wins, and only then is the Worker context read.
export function getConnectionString(): string {
  const url = process.env.APP_DATABASE_URL;
  if (url) return url;
  const env = getCloudflareContext().env as { HYPERDRIVE: { connectionString: string } };
  return env.HYPERDRIVE.connectionString;
}
