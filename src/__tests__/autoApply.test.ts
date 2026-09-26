/* Platinum auto-apply bridge — gate honesty, profile export (never invents),
   and the run-command builder. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tier: "free" as string, platinum: false, addon: false, admin: false }));

vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn(async () => null),
  getCloudState: () => ({ user: { email: "o@x.com" }, configured: true, syncing: false, error: null, oauth: [] })
}));
vi.mock("../services/entitlements", () => ({
  getTier: () => mocks.tier,
  isPlatinum: () => mocks.tier === "platinum",
  adminUnlockedActive: () => mocks.admin
}));
vi.mock("../services/entitlement", () => ({
  serverPlatinum: () => mocks.platinum,
  serverAutoApply: () => mocks.addon
}));
vi.mock("../services/profileStore", () => ({
  getCanonicalProfile: vi.fn(() => ({ version: 2, headline: "h", years: 5, location: "Bengaluru", remote: true, workAuth: "", targetTitles: [], summary: "s", skills: {}, roadmapSkills: [], origins: { skills: false, goal: false, career: true, resume: false }, careerUpdatedAt: 1, updatedAt: 1 })),
  toCareerProfile: vi.fn(() => ({
    headline: "Senior Backend Engineer", years: 5, location: "Bengaluru", remote: true,
    workAuth: "Indian citizen", targetTitles: ["Backend Engineer"], skills: ["Node.js", "React"],
    summary: "Ships reliable services.", updatedAt: 1
  })),
  toUploadedResume: vi.fn(() => null)
}));

import { buildEngineProfile, engineCommands, exportProfileJson, extractContacts, platinumActive, APPLY_SITES } from "../services/autoApply";

beforeEach(() => {
  mocks.tier = "free";
  mocks.platinum = false;
  mocks.addon = false;
  mocks.admin = false;
});

describe("platinum gate", () => {
  it("is closed for free/pro users (server Platinum required)", () => {
    expect(platinumActive()).toBe(false);
    mocks.tier = "pro";
    expect(platinumActive()).toBe(false);
  });

  it("opens on a server-verified Platinum entitlement", () => {
    mocks.platinum = true;
    expect(platinumActive()).toBe(true);
  });

  it("opens when the mirrored local tier is platinum", () => {
    mocks.tier = "platinum";
    expect(platinumActive()).toBe(true);
  });

  it("opens for the ADD-ON purchased on ANY tier — including free (pay-extra path)", () => {
    mocks.addon = true;
    expect(platinumActive()).toBe(true); // free tier + add-on
    mocks.tier = "pro";
    expect(platinumActive()).toBe(true); // pro tier + add-on, without Platinum
  });

  it("stays closed when neither Platinum nor the add-on is server-verified", () => {
    mocks.tier = "pro";
    expect(platinumActive()).toBe(false);
  });

  it("opens for ADMINS with no entitlements row at all (all restrictions lifted)", () => {
    mocks.admin = true;
    expect(platinumActive()).toBe(true);
    mocks.admin = false;
    expect(platinumActive()).toBe(false);
  });
});

describe("buildEngineProfile — honest export", () => {
  it("maps the canonical career profile into the engine shape", () => {
    const p = buildEngineProfile();
    expect(p.headline).toBe("Senior Backend Engineer");
    expect(p.years).toBe(5);
    expect(p.locations).toEqual(["Bengaluru", "Remote"]);
    expect(p.openToRemote).toBe(true);
    expect(p.skills).toEqual(["Node.js", "React"]);
    expect(p.summary).toBe("Ships reliable services.");
  });

  it("never exports workAuth (fail-closed questions stay with the human)", () => {
    expect(buildEngineProfile().reasonLeaving).toBeUndefined();
    expect(JSON.stringify(buildEngineProfile())).not.toMatch(/workAuth/i);
  });

  it("exports valid JSON with a trailing newline (the engine's file contract)", () => {
    const raw = exportProfileJson();
    expect(raw.endsWith("\n")).toBe(true);
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe("extractContacts (from the uploaded resume text)", () => {
  it("finds email, phone, and a plausible name near the top", () => {
    const c = extractContacts("GAURAV GUPTA\nBangalore · gaurav.123337@gmail.com · +91 98765 43210\nStaff Frontend Engineer");
    expect(c.email).toBe("gaurav.123337@gmail.com");
    expect(c.phone).toContain("98765");
    expect(c.name).toBe("GAURAV GUPTA");
  });

  it("never invents: junk lines, digits, URLs are not names; missing fields stay undefined", () => {
    expect(extractContacts("gaurav.123337@gmail.com\n14 years experience\nhttps://linkedin.com/in/x").name).toBeUndefined();
    expect(extractContacts("").email).toBeUndefined();
    expect(extractContacts("no contact info here").email).toBeUndefined();
  });
});

describe("engineCommands", () => {
  it("gives login → real run → dry run per site, with the site's submit mode", () => {
    const cmds = engineCommands("linkedin", 7);
    expect(cmds).toHaveLength(3);
    expect(cmds[0].command).toContain("--login-only");
    expect(cmds[1].command).toContain("--max 7");
    expect(cmds[1].command).not.toContain("--dry-run");
    expect(cmds[2].command).toContain("--dry-run");
    expect(cmds[1].submit).toBe("review");
    expect(cmds[1].command).toContain("linkedin.com/jobs");
  });

  it("auto-submit sites are labeled auto (instahyre/naukri)", () => {
    expect(engineCommands("instahyre")[1].submit).toBe("auto");
    expect(engineCommands("naukri")[1].submit).toBe("auto");
  });

  it("covers exactly the owner's three boards", () => {
    expect(APPLY_SITES.map(s => s.id)).toEqual(["instahyre", "naukri", "linkedin"]);
  });
});
