import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import nextConfig from "../../next.config";

vi.mock("@opennextjs/cloudflare", () => ({ initOpenNextCloudflareForDev: vi.fn() }));

const EXPECTED = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // The site shows a fictitious store: a real buyer must not find it by search and leave a phone.
  "X-Robots-Tag": "noindex, nofollow",
};

it("every page answers with the security headers", async () => {
  const rules = await nextConfig.headers!();
  const all = rules.find((rule) => rule.source === "/:path*");
  expect(Object.fromEntries(all!.headers.map((header) => [header.key, header.value]))).toEqual(EXPECTED);
});

it("the files the Worker serves without running the app get them too", () => {
  const file = readFileSync("public/_headers", "utf8");
  const everything = file.slice(file.indexOf("\n/*\n"));
  for (const [key, value] of Object.entries(EXPECTED)) expect(everything).toContain(`${key}: ${value}`);
});

it("the error page says nothing of what broke", () => {
  const error = Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"), { digest: "abc123" });
  const html = renderToStaticMarkup(createElement(ErrorPage, { error, reset: () => {} }));
  expect(html).toContain("Algo deu errado. Tente de novo em instantes.");
  expect(html).toContain("Tentar de novo");
  expect(html).not.toMatch(/ECONNREFUSED|hunter2|5432|abc123/);
});
