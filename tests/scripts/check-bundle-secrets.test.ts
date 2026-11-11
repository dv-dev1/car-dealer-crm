import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { findLeaks } from "../../scripts/check-bundle-secrets.mjs";

const SCRIPT = fileURLToPath(new URL("../../scripts/check-bundle-secrets.mjs", import.meta.url));
const dirs: string[] = [];

// A throwaway repo root with an `.open-next/` bundle holding the given files.
function repoWith(bundle: Record<string, string>, extra: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "bundle-secrets-"));
  dirs.push(root);
  mkdirSync(join(root, ".open-next", "cloudflare"), { recursive: true });
  for (const [name, content] of Object.entries(bundle)) {
    writeFileSync(join(root, ".open-next", name), content);
  }
  for (const [name, content] of Object.entries(extra)) writeFileSync(join(root, name), content);
  return root;
}

function runCli(cwd: string) {
  return spawnSync(process.execPath, [SCRIPT], { cwd, encoding: "utf8" });
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("findLeaks", () => {
  it("reports the key whose value is inside a bundled file", () => {
    const root = repoWith({ "cloudflare/next-env.mjs": "export const k = 'sk_test_abcdef123';" });
    expect(findLeaks(join(root, ".open-next"), { WORKOS_API_KEY: "sk_test_abcdef123" })).toEqual([
      "WORKOS_API_KEY",
    ]);
  });

  it("returns nothing for a clean bundle", () => {
    const root = repoWith({ "worker.js": "export default {};" });
    expect(findLeaks(join(root, ".open-next"), { WORKOS_API_KEY: "sk_test_abcdef123" })).toEqual([]);
  });

  it("ignores public keys and short values", () => {
    const root = repoWith({ "worker.js": "http://localhost:8787/callback 1 development" });
    const secrets = {
      NEXT_PUBLIC_X: "http://localhost:8787/callback",
      NEXTJS_ENV: "development",
      FLAG: "1",
    };
    expect(findLeaks(join(root, ".open-next"), secrets)).toEqual([]);
  });
});

describe("check-bundle-secrets CLI", () => {
  it("exits 0 for a clean bundle with only .env.example at the root", () => {
    const root = repoWith(
      { "worker.js": "export default {};" },
      { ".env.example": "X=", ".dev.vars": "WORKOS_API_KEY=sk_test_abcdef123\n" },
    );
    expect(runCli(root).status).toBe(0);
  });

  it("exits 1 and names the key when a .dev.vars value is in the bundle", () => {
    const root = repoWith(
      { "worker.js": "const k = 'sk_test_abcdef123';" },
      { ".dev.vars": "WORKOS_API_KEY=sk_test_abcdef123\n" },
    );
    const result = runCli(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("WORKOS_API_KEY");
    expect(result.stderr).not.toContain("sk_test_abcdef123");
  });

  // Nothing to look for would print the all-clear without checking anything.
  it("exits 1 without .dev.vars", () => {
    const result = runCli(repoWith({ "worker.js": "export default {};" }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("No .dev.vars");
  });

  it("exits 1 when .dev.vars holds no secret value to look for", () => {
    const vars = "NEXTJS_ENV=development\nWORKOS_API_KEY=\nNEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:8787/callback\n";
    const result = runCli(repoWith({ "worker.js": "export default {};" }, { ".dev.vars": vars }));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".dev.vars has no secret");
  });

  it("exits 1 when an .env file other than .env.example exists at the root", () => {
    const root = repoWith({ "worker.js": "export default {};" }, { ".env.local": "X=1" });
    const result = runCli(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".env.local");
  });
});
