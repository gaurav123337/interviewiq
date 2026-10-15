// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/* ReviewQueuePanel pins: the ⏱ posting-age FILTER (the Applications report's
   filter semantics mirrored into the queue — see applyEngine.test.ts's
   passesAgeFilter test). The services layer is fully mocked; the real
   scripts/apply-engine-lib.js supplies passesAgeFilter/postedAgeChip. */
vi.mock("../services/jobSites.ts", () => ({
  listJobReviews: vi.fn(),
  resolveJobReview: vi.fn().mockResolvedValue(undefined),
  getNotifyConfig: vi.fn().mockResolvedValue(null),
  setNotifyConfig: vi.fn().mockResolvedValue(undefined),
  putJudgeExemplar: vi.fn().mockResolvedValue(undefined),
  testNotifyConfig: vi.fn().mockResolvedValue("sent"),
}));
vi.mock("../services/entitlement.ts", () => ({ serverAutoApply: vi.fn().mockReturnValue(true) }));
vi.mock("../services/cloud.ts", () => ({ getCloudState: vi.fn().mockReturnValue({ user: null }) }));

import ReviewQueuePanel from "../components/jobs/ReviewQueuePanel";
import { listJobReviews, type ReviewItem } from "../services/jobSites.ts";

const item = (id: string, posted_age_h: number | null): ReviewItem => ({
  id,
  site_host: "linkedin.com",
  job_url: `https://www.linkedin.com/jobs/view/${id}`,
  title: `Job ${id}`,
  company: null,
  form_url: null,
  reason: null,
  fit: null,
  form_fields: null,
  posted_age_h,
  created_at: new Date().toISOString(),
});

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReviewQueuePanel ⏱ posting-age filter", () => {
  it("defaults to showing every row (posting age: any)", async () => {
    vi.mocked(listJobReviews).mockResolvedValue([
      item("fresh", 24),
      item("stale", 30 * 24),
      item("undated", null),
    ]);
    render(<ReviewQueuePanel />);
    fireEvent.click(await screen.findByText(/Review queue/)); // expand the panel
    expect(await screen.findByText("Job fresh")).toBeTruthy();
    expect(screen.getByText("Job stale")).toBeTruthy();
    expect(screen.getByText("Job undated")).toBeTruthy();
    expect(screen.getByText(/posting age: any/)).toBeTruthy();
    expect(screen.queryByText(/of 3 shown/)).toBeNull(); // count only when filtering
  });

  it("≤7d hides STALE rows but keeps FRESH + UNDATED rows (fail-open like the report)", async () => {
    vi.mocked(listJobReviews).mockResolvedValue([
      item("fresh", 24),
      item("stale", 30 * 24),
      item("undated", null),
    ]);
    render(<ReviewQueuePanel />);
    fireEvent.click(await screen.findByText(/Review queue/));
    await screen.findByText("Job fresh");
    fireEvent.click(screen.getByTitle(/cycle any/)); // → ≤ 7d
    expect(screen.queryByText("Job stale")).toBeNull();
    expect(screen.getByText("Job fresh")).toBeTruthy();
    expect(screen.getByText("Job undated")).toBeTruthy(); // missing stamp never hides a row
    expect(screen.getByText("2 of 3 shown")).toBeTruthy();
  });

  it("full cycle any → ≤7d → ≤14d → ≤30d → any restores every row", async () => {
    vi.mocked(listJobReviews).mockResolvedValue([
      item("fresh", 24),
      item("stale", 30 * 24),
      item("undated", null),
    ]);
    render(<ReviewQueuePanel />);
    fireEvent.click(await screen.findByText(/Review queue/));
    await screen.findByText("Job fresh");
    const cycleBtn = screen.getByTitle(/cycle any/);
    fireEvent.click(cycleBtn); // ≤7d
    fireEvent.click(cycleBtn); // ≤14d
    fireEvent.click(cycleBtn); // ≤30d — the 1d-old row is still INSIDE the window;
    // only the 30d-old row (age == cap → not < cap) drops out
    expect(screen.queryByText("Job stale")).toBeNull();
    expect(screen.getByText("Job fresh")).toBeTruthy();
    expect(screen.getByText(/posting ≤ 30d/)).toBeTruthy();
    fireEvent.click(cycleBtn); // back to any
    expect(screen.getByText("Job stale")).toBeTruthy();
    expect(screen.getByText("Job fresh")).toBeTruthy();
    expect(screen.getByText(/posting age: any/)).toBeTruthy();
  });
});
