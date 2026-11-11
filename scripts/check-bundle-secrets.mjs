// Fails when a secret from .dev.vars ended up inside the Worker bundle.
// OpenNext copies every value from .env* files into .open-next, so secrets
// must live only in .dev.vars (local) or `wrangler secret` (production).
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const MIN_SECRET_LENGTH = 8;

function* filesIn(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* filesIn(path);
    else if (entry.isFile()) yield path;
  }
}

/** Returns the keys whose value appears in some file under `bundleDir`. */
export function findLeaks(bundleDir, secrets) {
  const candidates = Object.entries(secrets).filter(
    ([key, value]) =>
      !key.startsWith("NEXT_PUBLIC_") && key !== "NEXTJS_ENV" && value.length >= MIN_SECRET_LENGTH,
  );
  const leaked = new Set();
  for (const file of filesIn(bundleDir)) {
    const content = readFileSync(file);
    for (const [key, value] of candidates) {
      if (content.includes(value)) leaked.add(key);
    }
  }
  return [...leaked];
}

function main(root) {
  const strayEnvFiles = readdirSync(root).filter(
    (name) => name.startsWith(".env") && name !== ".env.example",
  );
  if (strayEnvFiles.length > 0) {
    console.error(`Secrets must not live in .env* files (OpenNext bundles them): ${strayEnvFiles.join(", ")}`);
    return 1;
  }

  const bundleDir = join(root, ".open-next");
  if (!existsSync(bundleDir)) {
    console.error("No .open-next/ directory: run `opennextjs-cloudflare build` first.");
    return 1;
  }

  const varsFile = join(root, ".dev.vars");
  const secrets = existsSync(varsFile) ? parseEnv(readFileSync(varsFile, "utf8")) : {};
  const leaks = findLeaks(bundleDir, secrets);
  if (leaks.length > 0) {
    console.error(`Secret value found inside .open-next/ for: ${leaks.join(", ")}`);
    return 1;
  }
  console.log("No secret from .dev.vars found in .open-next/.");
  return 0;
}

// Run the CLI only when executed directly, not when a test imports findLeaks.
// realpath: a symlinked checkout path must not turn the guard into a silent no-op.
if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.cwd()));
