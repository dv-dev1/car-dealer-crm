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
import type { Veiculo } from "@/types/veiculo";

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

const CAR: Veiculo = {
  id: "1", slug: "fiat-argo-drive-1-0", marca: "Fiat", modelo: "Argo", titulo: "Fiat Argo Drive 1.0", ano: 2023, km: 30000, preco: 68900,
  cambio: "Manual", combustivel: "Flex", fotos: [], equipamentos: [], fichaTecnica: {}, status: "disponivel", destaque: false,
};

it("a car without photos shows a placeholder", () => {
  const html = renderToStaticMarkup(createElement(VeiculoCard, { veiculo: CAR }));
  expect(html).toContain("Sem foto");
  expect(html).not.toContain("<img");
  const galeria = renderToStaticMarkup(createElement(Galeria, { fotos: [], titulo: "Fiat Argo Drive 1.0" }));
  expect(galeria).toContain("Sem foto");
  expect(galeria).not.toContain("<img");
});

it("the menus only link to sections the home still has", () => {
  for (const menu of [Header, Footer]) {
    const html = renderToStaticMarkup(createElement(WhatsappProvider, { children: createElement(menu) }));
    expect(html).toContain("Garantia 90 dias");
    expect(html).not.toMatch(/#equipe|#fundador|Nossa equipe/);
  }
});
