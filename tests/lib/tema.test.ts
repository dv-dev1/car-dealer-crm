import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { activateTheme, esquecerTema } from "@/lib/tema";

// Just the parts of the browser that tema.ts touches.
let dataset: Record<string, string>;
let saved: Record<string, string>;

beforeEach(() => {
  dataset = {};
  saved = {};
  vi.stubGlobal("document", { documentElement: { dataset } });
  vi.stubGlobal("localStorage", { getItem: (key: string) => saved[key] ?? null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("marks <html> with the theme and the dark mode saved under gestao.tema", () => {
  saved["gestao.tema"] = "escuro";
  activateTheme("autohub");
  expect(dataset).toEqual({ theme: "autohub", tema: "escuro" });
});

it("ignores the dark mode saved under the old cassiano.tema key", () => {
  saved["cassiano.tema"] = "escuro";
  activateTheme("autohub");
  expect(dataset).toEqual({ theme: "autohub" });
});

it("clears both the theme and the dark mode when leaving the area", () => {
  saved["gestao.tema"] = "escuro";
  activateTheme("autohub");
  esquecerTema();
  expect(dataset).toEqual({});
});
