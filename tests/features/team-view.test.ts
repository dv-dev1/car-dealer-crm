import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import type { Member } from "@/features/team/model";
import { TeamView } from "@/features/team/view";

vi.mock("@/features/team/actions", () => ({ addMemberAction: vi.fn(), removeMemberAction: vi.fn() }));

const ana: Member = { id: "m-ana", name: "Ana", email: "ana@lojaa.com", role: "owner", linked: true };
const beto: Member = { id: "m-beto", name: "Beto", email: "beto@lojaa.com", role: "seller", linked: true };

it("removing asks first, and nobody gets a button to remove themselves", () => {
  const html = renderToStaticMarkup(createElement(TeamView, { members: [ana, beto], role: "owner", selfId: "m-ana" }));
  expect(html).not.toContain("Remover Ana");
  expect(html).toContain("Remover Beto");
  // The first click only opens the question; the submit button is the second step.
  expect(html).toMatch(/<summary[^>]*>Remover<\/summary>/);
  expect(html).toContain("Sim, remover Beto");
});
