import { expect, it } from "vitest";
import { reaisEmDigitos } from "@/lib/format";

it("reads whole reais from what a person types, cents dropped", () => {
  expect(reaisEmDigitos("68.000,00")).toBe("68000");
  expect(reaisEmDigitos("R$ 68.000")).toBe("68000");
  expect(reaisEmDigitos("68000")).toBe("68000");
  expect(reaisEmDigitos("68000,5")).toBe("68000");
  expect(reaisEmDigitos("")).toBe("");
});
