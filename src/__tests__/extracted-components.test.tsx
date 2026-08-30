// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {render} from "@testing-library/react";
import type { JobPosting } from "../types";

/* ------------------------------------------------------------------ */
/* Mock all external services                                          */
/* ------------------------------------------------------------------ */

vi.mock("../services/jobs", () => ({
  EMPTY_FILTERS: { query: "", remote: null, companySize: null, currency: "", salaryMin: null, salaryMax: null, source: null },
  salaryLabel: vi.fn().mockReturnValue(null),
  VERDICT_META: {
    strong: { label: "Strong Match", tone: "ok" },
    good: { label: "Good Match", tone: "co" },
    moderate: { label: "Moderate", tone: "warn" },
    stretch: { label: "Stretch", tone: "warn" },
    no: { label: "Not a Match", tone: "bad" },
  },
}));

vi.mock("../services/importJob", () => ({
  sourceLabel: vi.fn().mockReturnValue("LinkedIn"),
  trustOf: vi.fn().mockReturnValue({ icon: "🔗", label: "LinkedIn", title: "Trusted" }),
}));

vi.mock("../services/applyKit", () => ({
  jdKeywords: vi.fn().mockReturnValue([]),
}));

vi.mock("../services/applyTrack", () => ({
  STATUS_META: {
    saved: { emoji: "📌", label: "Saved" },
    applied: { emoji: "📤", label: "Applied" },
    interview: { emoji: "🎤", label: "Interview" },
    offer: { emoji: "🎉", label: "Offer" },
    rejected: { emoji: "❌", label: "Rejected" },
  },
  STATUS_ORDER: ["saved", "applied", "interview", "offer", "rejected"],
}));

vi.mock("../services/currency", () => ({
  getDisplayCurrency: vi.fn().mockReturnValue("USD"),
}));

vi.mock("../services/runner", () => ({}));

/* ------------------------------------------------------------------ */
/* FeedFilters tests                                                   */
/* ------------------------------------------------------------------ */

import { FeedFilters } from "../components/jobs/FeedFilters";

describe("FeedFilters", () => {
  const defaultProps = {
    filters: { query: "", remote: null, companySize: null, currency: "", salaryMin: null, salaryMax: null, source: null },
    setFilters: vi.fn(),
    displayCurrency: "USD",
    setDisplayCurrency: vi.fn(),
    feedSources: [
      { s: "linkedin", n: 10, label: "LinkedIn" },
      { s: "greenhouse", n: 5, label: "Greenhouse" },
    ],
    jobCount: 15,
  };

  it("renders search input", () => {
    const { container } = render(<FeedFilters {...defaultProps} />);
    expect(container.querySelector("input[placeholder]")).toBeTruthy();
  });

  it("renders select dropdowns", () => {
    const { container } = render(<FeedFilters {...defaultProps} />);
    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("renders source section", () => {
    const { container } = render(<FeedFilters {...defaultProps} />);
    expect(container.textContent).toContain("Source:");
    expect(container.textContent).toContain("All");
  });

  it("renders clear button when filters active", () => {
    const { container } = render(<FeedFilters {...defaultProps} filters={{ ...defaultProps.filters, query: "react" }} />);
    expect(container.textContent).toContain("Clear");
  });

  it("hides clear button when no filters active", () => {
    const { container } = render(<FeedFilters {...defaultProps} />);
    expect(container.textContent).not.toContain("Clear");
  });
});

/* ------------------------------------------------------------------ */
/* MatchFeedCard tests                                                 */
/* ------------------------------------------------------------------ */

import { MatchFeedCard } from "../components/jobs/MatchFeedCard";

describe("MatchFeedCard", () => {
  const job: JobPosting = {
    id: "linkedin:j1",
    externalId: "j1",
    title: "Senior React Developer",
    company: "TechCorp",
    location: "San Francisco",
    remote: true,
    level: "Senior",
    source: "linkedin",
    description: "Build React apps with TypeScript.",
    url: "https://example.com",
    skills: ["React", "TypeScript"],
    salary: { min: 150000, max: 200000, currency: "USD", source: "posting" },
    companySize: "large",
    postedAt: null,
    alsoSources: [],
  };

  const match = {
    score: 85,
    verdict: "good",
    matched: ["React", "TypeScript"],
    missing: ["GraphQL"],
    blockers: [],
  };

  const baseProps = {
    job,
    match,
    locked: false,
    track: undefined,
    displayCurrency: "USD",
    profile: null,
    onAddSkill: vi.fn(),
    onGapPlan: vi.fn(),
    onKit: vi.fn(),
    onApply: vi.fn(),
    onStatusChange: vi.fn(),
    onFollowUpDate: vi.fn(),
    onDraft: vi.fn(),
    onRound: vi.fn(),
    onUpgrade: vi.fn(),
    isDue: false,
  };

  const renderCard = (props = {}) => {
    return render(<ul><MatchFeedCard {...baseProps} {...props} /></ul>);
  };

  it("renders job title and company", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("Senior React Developer");
    expect(container.textContent).toContain("TechCorp");
  });

  it("renders match score", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("85%");
  });

  it("renders locked state", () => {
    const { container } = renderCard({ locked: true });
    expect(container.textContent).toContain("Match verdict");
  });

  it("renders remote chip", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("REMOTE");
  });

  it("renders view link", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("View");
  });

  it("renders apply button", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("Apply on");
  });

  it("renders tracking section", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("Track:");
  });

  it("calls onAddSkill when missing skill clicked", () => {
    const { container } = renderCard();
    const addBtn = container.querySelector("button[title*='Add']");
    if (addBtn) (addBtn as HTMLElement).click();
    expect(baseProps.onAddSkill).toHaveBeenCalledWith("GraphQL");
  });
});

/* ------------------------------------------------------------------ */
/* OutputPanel tests                                                   */
/* ------------------------------------------------------------------ */

import { OutputPanel } from "../components/playground/OutputPanel";

describe("OutputPanel", () => {
  const baseProps = {
    isFn: false,
    isUi: false,
    customIn: "",
    setCustomIn: vi.fn(),
    runOut: null,
    cases: null,
    fnCases: null,
    uiCases: null,
    testCount: 0,
    hiddenCount: 0,
    assertionCount: 0,
    hiddenAssertionCount: 0,
  };

  it("renders custom input for CLI mode", () => {
    const { container } = render(<OutputPanel {...baseProps} />);
    expect(container.textContent).toContain("Custom input");
  });

  it("hides custom input for function mode", () => {
    const { container } = render(<OutputPanel {...baseProps} isFn={true} />);
    expect(container.textContent).not.toContain("Custom input");
  });

  it("renders CLI stdout", () => {
    const { container } = render(<OutputPanel {...baseProps} runOut={{ stdout: "Hello World", ok: true }} />);
    expect(container.textContent).toContain("Hello World");
  });

  it("renders CLI test results", () => {
    const { container } = render(
      <OutputPanel
        {...baseProps}
        cases={[
          { pass: true, stdin: "1", expect: "2", got: "2" },
          { pass: false, stdin: "3", expect: "6", got: "9" },
        ]}
        testCount={2}
      />
    );
    expect(container.textContent).toContain("Pass");
    expect(container.textContent).toContain("Fail");
    expect(container.textContent).toContain("1/2 passing");
  });

  it("renders function results", () => {
    const { container } = render(
      <OutputPanel
        {...baseProps}
        isFn={true}
        fnCases={[
          { pass: true, label: "basic", args: [1], expect: 2, got: 2, ms: 1 },
          { pass: false, label: "edge", args: [0], expect: 1, got: undefined, error: "Error", ms: 0 },
        ]}
        testCount={2}
      />
    );
    expect(container.textContent).toContain("basic");
    expect(container.textContent).toContain("edge");
    expect(container.textContent).toContain("1/2 passing");
  });

  it("hides custom input for UI mode", () => {
    const { container } = render(<OutputPanel {...baseProps} isUi={true} />);
    expect(container.textContent).not.toContain("Custom input");
  });
});
