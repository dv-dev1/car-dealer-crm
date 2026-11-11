import { describe, expect, it } from "vitest";

import { normalizeEmail } from "@/shared/email";

describe("normalizeEmail", () => {
  it.each([
    ["  Ana@LojaA.com ", "ana@lojaa.com"],
    ["abc", null],
    ["a@b", null],
    ["", null],
    ["ana @lojaa.com", null],
    ["a@@b.com", null],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeEmail(raw)).toBe(expected);
  });

  it("accepts 254 characters and rejects 255", () => {
    const atLimit = `${"a".repeat(244)}@lojaa.com`;

    expect(normalizeEmail(atLimit)).toBe(atLimit);
    expect(normalizeEmail(`a${atLimit}`)).toBeNull();
  });
});
