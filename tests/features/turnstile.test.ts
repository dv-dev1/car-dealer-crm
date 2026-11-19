import { expect, it } from "vitest";
import { turnstileSize } from "@/shared/Turnstile";

it("the widget is compact where the 300 px one would leave the card, as on a 360 px phone", () => {
  expect(turnstileSize(270)).toBe("compact");
  expect(turnstileSize(299)).toBe("compact");
  expect(turnstileSize(300)).toBe("normal");
  expect(turnstileSize(455)).toBe("normal");
});
