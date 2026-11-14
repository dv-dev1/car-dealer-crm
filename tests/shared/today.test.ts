import { expect, it } from "vitest";
import { STORE_TIME_ZONE, todayIso } from "@/shared/today";

it("counts the day in the store's time zone, three hours behind UTC", () => {
  expect(STORE_TIME_ZONE).toBe("America/Fortaleza");
  expect(todayIso(new Date("2026-11-14T02:59:00Z"))).toBe("2026-11-13");
  expect(todayIso(new Date("2026-11-14T03:00:00Z"))).toBe("2026-11-14");
});
