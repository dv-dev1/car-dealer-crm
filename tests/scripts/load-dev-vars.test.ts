import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";

const PRELOAD = fileURLToPath(new URL("../../scripts/load-dev-vars.mjs", import.meta.url));
const dirs: string[] = [];

// Runs node the way `npm run dev` does, in a throwaway repo root.
function devIn(setup: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "dev-vars-"));
  dirs.push(root);
  setup(root);
  return spawnSync(process.execPath, ["--import", PRELOAD, "-e", "console.log(process.env.DEV_VARS_PROBE ?? 'unset')"], {
    cwd: root,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

it("loads .dev.vars into process.env", () => {
  const result = devIn((root) => writeFileSync(join(root, ".dev.vars"), "DEV_VARS_PROBE=loaded\n"));
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("loaded");
  expect(result.stderr).toBe("");
});

it("starts with one warning line when .dev.vars is missing", () => {
  const result = devIn(() => {});
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("unset");
  expect(result.stderr.trim().split("\n")).toHaveLength(1);
  expect(result.stderr).toContain(".dev.vars");
});

it("still fails when .dev.vars exists but cannot be read", () => {
  const result = devIn((root) => mkdirSync(join(root, ".dev.vars")));
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(".dev.vars");
});
