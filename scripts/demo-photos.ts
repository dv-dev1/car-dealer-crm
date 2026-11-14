import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { DEMO_PHOTOS } from "../src/features/demo/photos.ts";

const BUCKET = "car-dealer-crm-photos"; // wrangler.jsonc, binding PHOTOS
const ROOT = "db/demo-photos";
const DEMO_KEY = /^demo\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/; // a subset of PHOTO_KEY in src/features/stock/photos.ts

const USAGE = "Usage: node scripts/demo-photos.ts --local | --remote";

/** One R2 object per photo in the manifest; `root` holds the files as <model key>/<file>. */
export function photoUploads(manifest: Record<string, string[]>, root: string): { key: string; file: string }[] {
  return Object.entries(manifest).flatMap(([model, files]) =>
    files.map((name) => {
      const key = `demo/${model}/${name}`;
      if (!DEMO_KEY.test(key)) throw new Error(`Not a demo photo: "${key}"`);
      return { key, file: join(root, model, name) };
    }),
  );
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { local: { type: "boolean" }, remote: { type: "boolean" } } });
  if (values.local === values.remote) {
    console.error(USAGE);
    process.exit(1);
  }
  const uploads = photoUploads(DEMO_PHOTOS, ROOT);
  const missing = uploads.filter((upload) => !existsSync(upload.file));
  if (missing.length > 0) {
    console.error(`Missing files:\n${missing.map((upload) => upload.file).join("\n")}`);
    process.exit(1);
  }
  for (const { key, file } of uploads) {
    execFileSync(
      "npx",
      ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", "image/webp", values.local ? "--local" : "--remote"],
      { stdio: "inherit" },
    );
  }
  console.log(`${uploads.length} photos uploaded (${values.local ? "local" : "remote"}).`);
}
