import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ nav: vi.fn(), getRoadmapBySlug: vi.fn() }));
vi.mock("../store", () => ({ useApp: () => ({ nav: mocks.nav, state: { ob: {}, config: {} }, startWeakSession: vi.fn() }) }));
vi.mock("../services/skillRoadmapService", () => ({
  getRoadmapBySlug: mocks.getRoadmapBySlug,
  resolvePath: vi.fn(),
  isAvailable: vi.fn(() => true),
  roadmapPrepSel: vi.fn(),
  skillRoadmapShareText: vi.fn()
}));
vi.mock("../services/entitlements", () => ({ getTier: () => "free", isPaywallEnabled: () => true }));
vi.mock("../services/profileStore", () => ({ ownedSkillSlugs: () => [] }));
vi.mock("../services/goal", () => ({ getGoal: vi.fn(), saveGoal: vi.fn() }));

import { SkillDetail } from "../components/SkillDetail";

beforeEach(() => {
  localStorage.removeItem("iq.learnSlug");
  mocks.nav.mockReset();
  mocks.getRoadmapBySlug.mockReset();
});
afterEach(cleanup);

describe("skill detail recovery", () => {
  it("offers the explorer instead of loading forever without a selected skill", async () => {
    render(<SkillDetail />);
    expect(await screen.findByText("Skill roadmap not found")).toBeTruthy();
    expect(screen.queryByText(/Loading roadmap/)).toBeNull();
    expect(mocks.getRoadmapBySlug).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "← Back to Skills" }));
    expect(mocks.nav).toHaveBeenCalledWith("learn");
  });

  it("recovers when loading the selected roadmap rejects", async () => {
    localStorage.setItem("iq.learnSlug", "react");
    mocks.getRoadmapBySlug.mockRejectedValue(new Error("offline"));
    render(<SkillDetail />);
    expect(await screen.findByText("Skill roadmap not found")).toBeTruthy();
    expect(screen.queryByText(/Loading roadmap/)).toBeNull();
  });
});
