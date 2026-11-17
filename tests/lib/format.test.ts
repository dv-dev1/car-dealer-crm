import { expect, it } from "vitest";
import { reaisEmDigitos } from "@/lib/format";

it("reads whole reais from what a person types, cents dropped", () => {
  expect(reaisEmDigitos("68.000,00")).toBe("68000");
  expect(reaisEmDigitos("R$ 68.000")).toBe("68000");
  expect(reaisEmDigitos("68000")).toBe("68000");
  expect(reaisEmDigitos("68000,5")).toBe("68000");
  expect(reaisEmDigitos("")).toBe("");
});

// Phone keyboards often offer only the dot: "89.90" is 89 reais and 90 cents, while "1.200" is a thousand separator.
it("reads a dot before one or two final digits as the cents", () => {
  expect(reaisEmDigitos("89.90")).toBe("89");
  expect(reaisEmDigitos("89.9")).toBe("89");
  expect(reaisEmDigitos("1.200")).toBe("1200");
  expect(reaisEmDigitos("1.200.50")).toBe("1200");
});
