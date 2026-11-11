import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import pg from "pg";
import { migrate } from "./migrate.ts";

const exec = promisify(execFile);
// initdb and pg_ctl come from the PATH (see db/README.md); PG_BIN points at another bin directory.
const pgBin = (command: string, args: string[]) =>
  exec(process.env.PG_BIN ? join(process.env.PG_BIN, command) : command, args);

type ClusterOptions = { dataDir: string; port: number; database: string; appPassword: string };
type Cluster = { adminUrl: string; appUrl: string; stop(): Promise<void> };

async function isRunning(dataDir: string) {
  return pgBin("pg_ctl", ["-D", dataDir, "status"]).then(
    () => true,
    () => false,
  );
}

async function start(dataDir: string, port: number) {
  const log = join(dataDir, "server.log");
  // No unix socket: its path can exceed the OS limit inside a long temp dir.
  const options = `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=`;
  try {
    await pgBin("pg_ctl", ["-D", dataDir, "-l", log, "-o", options, "-w", "start"]);
  } catch (error) {
    // The log is the only place that says why (e.g. port in use) and may vanish with the data dir.
    const tail = await readFile(log, "utf8").catch(() => "");
    throw new Error(`${(error as Error).message}\n${tail}`);
  }
}

// Starts (initializing if needed) a local cluster; safe to call again on a cluster that already exists.
export async function startCluster(options: ClusterOptions): Promise<Cluster> {
  const { dataDir, port, database, appPassword } = options;
  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    // Trust auth is fine: the server only listens on 127.0.0.1.
    await pgBin("initdb", ["-D", dataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8"]);
  }
  const startedHere = !(await isRunning(dataDir));
  if (startedHere) await start(dataDir, port);

  const stop = async () => {
    await pgBin("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"]);
  };
  const host = `127.0.0.1:${port}`;
  const adminUrl = `postgres://postgres@${host}/${database}`;
  const appUrl = `postgres://crm_app:${encodeURIComponent(appPassword)}@${host}/${database}`;

  try {
    const admin = new pg.Client({ connectionString: `postgres://postgres@${host}/postgres` });
    await admin.connect();
    try {
      const db = await admin.query("select 1 from pg_database where datname = $1", [database]);
      if (!db.rowCount) await admin.query(`create database ${admin.escapeIdentifier(database)}`);

      const role = await admin.query("select 1 from pg_roles where rolname = 'crm_app'");
      const verb = role.rowCount ? "alter" : "create";
      await admin.query(
        `${verb} role crm_app login nosuperuser nobypassrls password ${admin.escapeLiteral(appPassword)}`,
      );

      await migrate(adminUrl);

      // app_user is created by a migration; skip until it exists.
      await admin.query(`do $$ begin
        if exists (select 1 from pg_roles where rolname = 'app_user')
           and not pg_has_role('crm_app', 'app_user', 'member') then
          grant app_user to crm_app;
        end if;
      end $$`);
    } finally {
      await admin.end();
    }
  } catch (error) {
    if (startedHere) await stop().catch(() => {}); // do not leave a server holding the port
    throw error;
  }
  return { adminUrl, appUrl, stop };
}

if (import.meta.main) {
  const port = 54328;
  const database = "crm_dev";
  const cluster = await startCluster({
    dataDir: fileURLToPath(new URL("../.pgdata", import.meta.url)),
    port,
    database,
    appPassword: "dev",
  });
  console.log(`dev cluster ready: port ${port}, database ${database}\n${cluster.appUrl}`);
}
