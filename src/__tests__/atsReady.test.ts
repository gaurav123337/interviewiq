// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Mock the AI ladder — the service must route through chat(module: "ats") */
const chatMock = vi.fn();
vi.mock("../ai", () => ({ chat: (...a: unknown[]) => chatMock(...a) }));
vi.mock("../services/entitlements", () => ({ recordAiCall: vi.fn() }));

import { makeAtsReady } from "../services/atsReady";
import { MODULE_LIST } from "../services/moduleModels";
import type { JobPosting } from "../types";

const JOB: JobPosting = {
  id: "gh:1", source: "gh", externalId: "1", title: "Backend Engineer", company: "Acme",
  location: "Remote", remote: true, description: "", url: "",
  skills: ["PostgreSQL", "Node.js", "Docker"], level: "mid", salary: null,
  companySize: null, postedAt: null
};

const RESUME = `John Doe
Backend Developer
john@example.com · +1 415 555 0123 · linkedin.com/in/johndoe

SKILLS
PostgreSQL, Node.js

EXPERIENCE
- Built APIs at Acme Corp from 2020 to 2023 using Node.js and PostgreSQL
- Deployed services with Docker

EDUCATION
B.Tech Computer Science, 2020`;

const GOOD = JSON.stringify({
  resume: `JOHN DOE
Backend Developer
john@example.com · +1 415 555 0123 · linkedin.com/in/johndoe

SUMMARY
Backend developer with production PostgreSQL and Node.js experience.

SKILLS
- PostgreSQL
- Node.js
- Docker (used in deployments)

EXPERIENCE
- Built production APIs with Node.js and PostgreSQL at Acme Corp
- Deployed containerized services with Docker

EDUCATION
- B.Tech Computer Science, 2020`,
  changes: ["Standardized section headers", "Mirrored posting keywords in SUMMARY"],
  mirroredSkills: ["PostgreSQL", "Node.js", "Docker", "Kubernetes"]
});

const NO_CONTACT = JSON.stringify({
  resume: `JOHN DOE

SUMMARY
Backend developer with solid production experience building services.

SKILLS
- PostgreSQL
- Node.js

EXPERIENCE
- Built APIs with Node.js and PostgreSQL for three years

EDUCATION
- B.Tech, 2020`,
  changes: [], mirroredSkills: []
});

beforeEach(() => {
  chatMock.mockReset();
});

describe("makeAtsReady", () => {
  it("rewrites via the ats module and pairs before/after parse reports", async () => {
    chatMock.mockResolvedValueOnce(GOOD);
    const r = await makeAtsReady({ resumeText: RESUME, job: JOB });

    expect(chatMock).toHaveBeenCalledTimes(1);
    const [messages, opts] = chatMock.mock.calls[0] as [Array<{ role: string; content: string }>, { module?: string }];
    expect(opts.module).toBe("ats");
    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toContain("Backend Engineer"); // target job
    expect(messages[1].content).toContain("PostgreSQL, Node.js, Docker"); // posting keywords
    expect(messages[1].content).toContain("John Doe"); // original resume text

    expect(r.text).toContain("SUMMARY");
    expect(r.before.wordCount).toBeGreaterThan(0);
    expect(r.after.wordCount).toBeGreaterThan(0);
    expect(r.after.coverage.found).toContain("Docker");
    expect(r.after.sections.length).toBeGreaterThan(0);
  });

  it("filters mirrored skills to those actually in the posting", async () => {
    chatMock.mockResolvedValueOnce(GOOD);
    const r = await makeAtsReady({ resumeText: RESUME, job: JOB });
    /* "Kubernetes" is not in JOB.skills — the model inventing it must not surface */
    expect(r.mirroredSkills).toEqual(["PostgreSQL", "Node.js", "Docker"]);
  });

  it("repairs contact info the rewrite dropped", async () => {
    chatMock.mockResolvedValueOnce(NO_CONTACT);
    const r = await makeAtsReady({ resumeText: RESUME, job: JOB });
    expect(r.text).toContain("john@example.com");
    expect(r.text).toContain("+1 415 555 0123");
    expect(r.text.toLowerCase()).toContain("linkedin.com/in/johndoe");
  });

  it("throws a usable error on non-JSON AI output", async () => {
    chatMock.mockResolvedValueOnce("Here is your polished resume! It is really great and long enough.");
    await expect(makeAtsReady({ resumeText: RESUME, job: JOB })).rejects.toThrow(/not usable JSON/);
  });

  it("rejects output that leaks HTML or markdown fences", async () => {
    chatMock.mockResolvedValueOnce(JSON.stringify({ resume: "BAD\n<script>alert(1)</script>\n".repeat(12), changes: [], mirroredSkills: [] }));
    await expect(makeAtsReady({ resumeText: RESUME, job: JOB })).rejects.toThrow(/failed validation/);
    chatMock.mockResolvedValueOnce(JSON.stringify({ resume: "```json\nstuff\n```", changes: [], mirroredSkills: [] }));
    await expect(makeAtsReady({ resumeText: RESUME, job: JOB })).rejects.toThrow(/failed validation/);
  });

  it("fails fast on a too-short resume without calling the AI", async () => {
    await expect(makeAtsReady({ resumeText: "hi" })).rejects.toThrow(/too short/);
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("works without a target job (generic cleanup)", async () => {
    chatMock.mockResolvedValueOnce(GOOD);
    const r = await makeAtsReady({ resumeText: RESUME });
    const [, opts] = chatMock.mock.calls[0] as [unknown[], { module?: string }];
    expect(opts.module).toBe("ats");
    expect(r.text).toContain("SUMMARY");
    expect(r.mirroredSkills).toEqual([]); // no posting → nothing validated as mirrored
  });
});

describe("ats module routing", () => {
  it("registers an ats module for per-model overrides", () => {
    const ats = MODULE_LIST.find(m => m.id === "ats");
    expect(ats).toBeDefined();
    expect(ats?.needsJson).toBe(true);
    expect(ats?.label).toContain("ATS");
  });
});
