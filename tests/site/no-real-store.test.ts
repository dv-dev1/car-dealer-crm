import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Galeria } from "@/app/carro/[slug]/Galeria";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { VeiculoCard } from "@/components/VeiculoCard";
import { WhatsappProvider } from "@/components/whatsapp/WhatsappProvider";
import { veiculosMock } from "@/data/veiculos-mock";
import { MODELS } from "@/features/demo/catalog";
import { getVeiculoBySlug } from "@/lib/veiculos";

// The prototype was made for a real store whose sale did not happen: none of its data may ship.
const REAL_STORE = /cassiano|37\.203\.730|99607|trevo auto|supabase/i;

it("no trace of the real store in the code or the public files", () => {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
    .split("\n")
    .filter((f) => f && existsSync(f) && !f.startsWith("tests/") && f !== "package-lock.json");
  const binary = /\.(png|webp|jpe?g|ico|gif|woff2?)$/;
  const hits = files.filter((f) => REAL_STORE.test(f) || (!binary.test(f) && REAL_STORE.test(readFileSync(f, "utf8"))));
  expect(hits).toEqual([]);
  expect(files.filter((f) => /^public\/(logo-cv|veiculos\/|equipe|concessionaria)/.test(f))).toEqual([]);
});

it("a car without photos shows a placeholder", () => {
  const html = renderToStaticMarkup(createElement(VeiculoCard, { veiculo: { ...veiculosMock[0], fotos: [] } }));
  expect(html).toContain("Sem foto");
  expect(html).not.toContain("<img");
  const galeria = renderToStaticMarkup(createElement(Galeria, { fotos: [], titulo: "Fiat Argo Drive 1.0" }));
  expect(galeria).toContain("Sem foto");
  expect(galeria).not.toContain("<img");
});

it("the site's cars are the demo catalog's, without photos", async () => {
  expect(veiculosMock.length).toBeGreaterThanOrEqual(4);
  for (const v of veiculosMock) {
    expect(MODELS.some((m) => m.brand === v.marca && m.model === v.modelo)).toBe(true);
    expect(v.fotos).toEqual([]);
  }
  expect(await getVeiculoBySlug("toyota-sw4-diamond")).toBeNull();
});

it("the menus only link to sections the home still has", () => {
  for (const menu of [Header, Footer]) {
    const html = renderToStaticMarkup(createElement(WhatsappProvider, { children: createElement(menu) }));
    expect(html).toContain("Garantia 90 dias");
    expect(html).not.toMatch(/#equipe|#fundador|Nossa equipe/);
  }
});
