import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The panel screens must work under any store theme, so they may only read
// theme tokens: no literal colors, no hardcoded text color on the primary fill,
// and no pill shapes on controls (the theme picks their corners).

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCREENS = ["src/components/gestao", "src/app/gestao", "src/features/team", "src/features/auth/view.tsx", "src/features/demo/view.tsx"];
const SCREEN_DATA = ["src/data/agenda.ts", "src/data/clientes-mock.ts"];

function sourceFiles(path: string): string[] {
  if (statSync(ROOT + path).isFile()) return [path];
  return readdirSync(ROOT + path, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => `${path}/${file}`);
}

/** `file:line` of every line that breaks the rule. */
function offendingLines(paths: string[], breaks: (line: string) => boolean): string[] {
  return paths.flatMap(sourceFiles).flatMap((file) =>
    readFileSync(ROOT + file, "utf8")
      .split("\n")
      .flatMap((line, i) => (breaks(line) ? [`${file}:${i + 1}`] : [])),
  );
}

/** Matches a whole Tailwind class (variants like `hover:` allowed), not a longer name. */
const utility = (name: string) => new RegExp(`(?:^|[^\\w-])${name}(?![\\w-])`);
/** Values of every bare `h-*` (or `w-*`) class on the line, ignoring `min-h-*`/`max-h-*`. */
const sizes = (axis: "h" | "w", line: string) =>
  [...line.matchAll(new RegExp(`(?:^|[^\\w-])${axis}-([^\\s"'\`]+)`, "g"))].map((m) => m[1]);

const HEX = /#[0-9a-f]{6}(?:[0-9a-f]{2})?\b/i;
/** Strong fills whose light/dark flip needs `text-on-primary`, any variant (`hover:`, `group-hover:`). */
const STRONG_FILL = utility("bg-(?:primary|warning|success|neutral|muted-strong)");
const TEXT_WHITE = utility("text-white");
const ROUNDED_FULL = utility("rounded(?:-[lrtb]{1,2})?-full");
const MIN_W = utility("min-w-[^\\s\"'`]+");

/** A circle or dot: same height and width, or a counter that only grows sideways. */
function isRoundShape(line: string): boolean {
  const widths = sizes("w", line);
  return sizes("h", line).some((h) => widths.includes(h)) || MIN_W.test(line);
}

describe("panel screens read only theme tokens", () => {
  it("has no literal hex color", () => {
    expect(offendingLines([...SCREENS, ...SCREEN_DATA], (line) => HEX.test(line))).toEqual([]);
  });

  it("never pairs a strong fill with text-white", () => {
    expect(offendingLines(SCREENS, (line) => STRONG_FILL.test(line) && TEXT_WHITE.test(line))).toEqual([]);
  });

  it("keeps rounded-full only on circles and dots", () => {
    expect(offendingLines(SCREENS, (line) => ROUNDED_FULL.test(line) && !isRoundShape(line))).toEqual([]);
  });
});
