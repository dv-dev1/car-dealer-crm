import { expect, it } from "vitest";
import { photoUploads } from "../../scripts/demo-photos.ts";

it("lists one upload per photo in the manifest", () => {
  expect(photoUploads({ onix: ["01.webp"] }, "db/demo-photos")).toEqual([{ key: "demo/onix/01.webp", file: "db/demo-photos/onix/01.webp" }]);
  expect(photoUploads({ onix: ["01.webp", "02.webp"], hb20: [] }, "x")).toHaveLength(2);
});

it("refuses a manifest entry that is not a demo photo key", () => {
  expect(() => photoUploads({ "../stores": ["01.webp"] }, "x")).toThrow(/demo photo/);
  expect(() => photoUploads({ onix: ["01.gif"] }, "x")).toThrow(/demo photo/);
});
