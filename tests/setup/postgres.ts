import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCluster } from "../../db/local-cluster.ts";
import { TEST_APP_PASSWORD, TEST_DATABASE, TEST_PORT } from "./urls.ts";

// Vitest globalSetup: one throwaway cluster per run; the returned function is the teardown.
export default async function setup() {
  const dataDir = await mkdtemp(join(tmpdir(), "crm-pg-"));
  const cleanup = () => rm(dataDir, { recursive: true, force: true });
  let cluster;
  try {
    cluster = await startCluster({
      dataDir,
      port: TEST_PORT,
      database: TEST_DATABASE,
      appPassword: TEST_APP_PASSWORD,
    });
  } catch (error) {
    await cleanup(); // startCluster already stopped any server it started
    throw error;
  }
  return async () => {
    await cluster.stop();
    await cleanup();
  };
}
