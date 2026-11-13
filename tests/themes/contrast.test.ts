import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const THEMES_DIR = fileURLToPath(new URL("../../src/themes", import.meta.url));
const GLOBALS = fileURLToPath(new URL("../../src/app/globals.css", import.meta.url));

// Every token a theme must set. `--font-body` is left out: it lives on the
// `[data-theme-scope]` rule, the only element where `--font-archivo` exists.
const CONTRACT = [
  "primary", "primary-hover", "primary-on-dark", "secondary", "inverso", "veu",
  "background", "sand", "surface", "surface-2", "text", "muted", "muted-strong", "line",
  "success", "success-bg", "success-ink", "warning", "warning-bg", "warning-ink",
  "danger", "danger-bg", "danger-ink", "radius", "shadow-soft", "shadow-hover",
  "on-primary", "radius-control", "signal", "neutral", "neutral-ink",
];

// [text, background]: small text must reach WCAG AA (4.5:1) on every pair.
const PAIRS: [string, string][] = [
  ["text", "background"], ["text", "surface"], ["secondary", "surface"], ["secondary", "surface-2"],
  ["muted", "surface"], ["muted", "background"], ["muted-strong", "surface-2"],
  ["on-primary", "primary"], ["on-primary", "primary-hover"], ["primary", "surface"],
  ["primary-on-dark", "inverso"], ["danger", "surface"], ["danger-ink", "danger-bg"],
  ["success-ink", "success-bg"], ["warning-ink", "warning-bg"], ["neutral-ink", "surface"],
  // Screens put text-on-primary on status fills too (badges, funnel stages).
  ["on-primary", "warning"], ["on-primary", "success"], ["on-primary", "neutral"], ["on-primary", "muted-strong"],
];

type Tokens = Record<string, string>;

// Custom properties of the flat rule whose selector is exactly `selector`, or null.
function block(css: string, selector: string): Tokens | null {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, sel, body] of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (sel.trim() !== selector) continue;
    return Object.fromEntries([...body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
  }
  return null;
}

// WCAG 2.x relative luminance of a #rrggbb color.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = existsSync(THEMES_DIR)
  ? readdirSync(THEMES_DIR).filter((name) => existsSync(join(THEMES_DIR, name, "theme.css")))
  : [];

it("finds at least one theme", () => {
  expect(themes.length).toBeGreaterThan(0);
});

for (const theme of themes) {
  const css = readFileSync(join(THEMES_DIR, theme, "theme.css"), "utf8");
  const light = block(css, `:root[data-theme="${theme}"]`) ?? {};
  const darkOnly = block(css, `:root[data-theme="${theme}"][data-tema="escuro"]`) ?? {};
  const modes: [string, Tokens][] = [["light", light], ["dark", { ...light, ...darkOnly }]];

  describe(`theme ${theme}`, () => {
    it("defines every contract token in the light block", () => {
      expect(CONTRACT.filter((token) => !(token in light))).toEqual([]);
    });

    // theme.css is imported before the base dark rule of globals.css, which has the same
    // specificity as the light block: a token the theme's dark block skips leaks the base dark value.
    it("redefines in its dark block every token the base dark rule sets", () => {
      const base = block(readFileSync(GLOBALS, "utf8"), ':root[data-tema="escuro"]') ?? {};
      expect(Object.keys(base).filter((token) => !(token in darkOnly))).toEqual([]);
    });

    for (const [mode, tokens] of modes) {
      it.each(PAIRS)(`${mode}: %s on %s reaches 4.5:1`, (fg, bg) => {
        expect(tokens[fg], `--${fg}`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(tokens[bg], `--${bg}`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(ratio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}
