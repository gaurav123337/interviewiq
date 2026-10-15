// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/* ReviewQueuePanel pins: the ⏱ posting-age FILTER (the Applications report's
   filter semantics mirrored into the queue — see applyEngine.test.ts's
   passesAgeFilter test). The services layer is fully mocked; the real
   scripts/apply-engine-lib.js supplies passesAgeFilter/postedAgeChip. */
vi.mock("../services/jobSites.ts", () => ({
  listJobReviews: vi.fn(),
  listResolvedJobReviews: vi.fn(),
  resolveJobReview: vi.fn().mockResolvedValue(undefined),
  getNotifyConfig: vi.fn().mockResolvedValue(null),
  setNotifyConfig: vi.fn().mockResolvedValue(undefined),
  putJudgeExemplar: vi.fn().mockResolvedValue(undefined),
  testNotifyConfig: vi.fn().mockResolvedValue("sent"),
}));
vi.mock("../services/entitlement.ts", () => ({ serverAutoApply: vi.fn().mockReturnValue(true) }));
vi.mock("../services/cloud.ts", () => ({ getCloudState: vi.fn().mockReturnValue({ user: null }) }));

import ReviewQueuePanel from "../components/jobs/ReviewQueuePanel";
import { listJobReviews, listResolvedJobReviews, type ReviewItem, type ResolvedReviewItem } from "../services/jobSites.ts";

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

const resolvedItem = (id: string, status: ResolvedReviewItem["status"], posted_age_h: number | null): ResolvedReviewItem => ({
  ...item(id, posted_age_h),
  status,
  resolved_at: new Date().toISOString(),
});

/* every default mock: history RPC not applied (null) — the section must
   hide honestly without breaking the pending list */
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(listResolvedJobReviews).mockResolvedValue(null as unknown as ResolvedReviewItem[]);
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

  it("degrades honestly when the resolved-history RPC isn't applied yet (null → section hidden, queue intact)", async () => {
    vi.mocked(listResolvedJobReviews).mockRejectedValue(new Error("Could not find the function admin_list_resolved_job_reviews"));
    vi.mocked(listJobReviews).mockResolvedValue([item("a", null)]);
    render(<ReviewQueuePanel />);
    fireEvent.click(await screen.findByText(/Review queue/));
    expect(await screen.findByText("Job a")).toBeTruthy(); // queue unaffected
    expect(screen.queryByText(/Applied by User/)).toBeNull(); // honest skip, not a crash
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
    /* the owner's pick: undated rows survive every cap BUT are marked, so a
       10d-posted row under ≤7d reads as "no stamp", never "filter bug" —
       shown only while a cap is active */
    expect(screen.getAllByText(/no stamp/).length).toBe(1);
  });

  it("the 'no stamp' marker hides when no cap is active — chips only speak when the ⏱ filter matters", async () => {
    vi.mocked(listJobReviews).mockResolvedValue([item("undated", null)]);
    render(<ReviewQueuePanel />);
    fireEvent.click(await screen.findByText(/Review queue/));
    await screen.findByText("Job undated");
    expect(screen.queryByText(/no stamp/)).toBeNull(); // posting age: any → unmarked
    fireEvent.click(screen.getByTitle(/cycle any/)); // → ≤7d
    expect(screen.getByText(/no stamp/)).toBeTruthy();
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

  describe("Applied by User (resolved history section)", () => {
    it("shows resolved rows ONLY when the panel is open, one per posting, with the verdict badge", async () => {
      vi.mocked(listResolvedJobReviews).mockResolvedValue([
        resolvedItem("r1", "done", 24),
        resolvedItem("r2", "dismissed", null),
      ]);
      vi.mocked(listJobReviews).mockResolvedValue([]);
      render(<ReviewQueuePanel />);
      fireEvent.click(await screen.findByText(/Review queue/));
      /* collapsed by default: count chip visible, rows not */
      expect(await screen.findByText(/Applied by User/)).toBeTruthy();
      expect(screen.queryByText("Job r1")).toBeNull();
      fireEvent.click(screen.getByText(/Applied by User/)); // expand
      expect(screen.getByText("Job r1")).toBeTruthy();
      expect(screen.getByText(/✓ applied/)).toBeTruthy();
      expect(screen.getByText(/✕ not interested/)).toBeTruthy();
      /* count appears only while a cap is active (same rule as the pending
         list): activate the resolved section's own ⏱ — both rows are 24h
         old and null-stamped (fail-open) so both survive ≤7d */
      const cycleBtns = screen.getAllByTitle(/cycle any/);
      fireEvent.click(cycleBtns[cycleBtns.length - 1]);
      expect(screen.getByText("2 of 2 shown")).toBeTruthy();
    });

    it("its ⏱ filter is independent of the pending list's and fail-open on unstamped rows", async () => {
      vi.mocked(listResolvedJobReviews).mockResolvedValue([
        resolvedItem("fresh", "done", 24),
        resolvedItem("stale", "done", 30 * 24),
        resolvedItem("undated", "done", null),
      ]);
      vi.mocked(listJobReviews).mockResolvedValue([]);
      render(<ReviewQueuePanel />);
      fireEvent.click(await screen.findByText(/Review queue/));
      await screen.findByText(/Applied by User/);
      fireEvent.click(screen.getByText(/Applied by User/)); // expand
      expect(await screen.findByText("Job fresh")).toBeTruthy();
      /* there are now TWO ⏱ buttons (pending + resolved); grab the second */
      const cycleBtns = screen.getAllByTitle(/cycle any/);
      fireEvent.click(cycleBtns[cycleBtns.length - 1]); // resolved section → ≤7d
      expect(screen.queryByText("Job stale")).toBeNull();
      expect(screen.getByText("Job fresh")).toBeTruthy();
      expect(screen.getByText("Job undated")).toBeTruthy(); // fail-open
      expect(screen.getByText(/no stamp/)).toBeTruthy();
      /* pending section's button untouched: still 'any' (2 remaining ⏱ buttons,
         one in each section — the resolved one now shows '≤ 7d') */
      expect(screen.getAllByText(/posting age: any/).length).toBe(1);
    });
  });
});
