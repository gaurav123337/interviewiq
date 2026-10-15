// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/* AppliedByUserPanel pins: the resolved-history panel is STANDALONE (owner's
   call — it used to hide inside the review queue where nobody found it).
   Same ⏱ fail-open filter semantics as the queue/report, its own state, an
   honest degraded shell when the RPC isn't applied yet, and un-resolve
   (fat-finger recovery). Services fully mocked; the real
   scripts/apply-engine-lib.js supplies the filter/chip/title helpers. */
vi.mock("../services/jobSites.ts", () => ({
  listResolvedJobReviews: vi.fn(),
  unresolveJobReview: vi.fn().mockResolvedValue(undefined),
}));
import AppliedByUserPanel from "../components/jobs/AppliedByUserPanel";
import { listResolvedJobReviews, unresolveJobReview, type ResolvedReviewItem } from "../services/jobSites.ts";

const row = (id: string, status: ResolvedReviewItem["status"], posted_age_h: number | null): ResolvedReviewItem => ({
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
  status,
  resolved_at: new Date().toISOString(),
});

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AppliedByUserPanel (standalone resolved history)", () => {
  it("renders an honest degraded shell — NOT a crash — when the RPC isn't applied yet", async () => {
    vi.mocked(listResolvedJobReviews).mockRejectedValue(new Error("Could not find the function admin_list_resolved_job_reviews"));
    render(<AppliedByUserPanel />);
    expect(await screen.findByText(/review-queue-resolved\.sql/)).toBeTruthy();
  });

  it("collapsed by default; expanding shows one row per posting with the verdict badge", async () => {
    vi.mocked(listResolvedJobReviews).mockResolvedValue([
      row("r1", "done", 24),
      row("r2", "dismissed", null),
    ]);
    render(<AppliedByUserPanel />);
    expect(await screen.findByText(/Applied by User/)).toBeTruthy();
    expect(screen.queryByText("Job r1")).toBeNull(); // collapsed
    fireEvent.click(screen.getByText(/Applied by User/)); // expand
    expect(await screen.findByText("Job r1")).toBeTruthy();
    expect(screen.getByText(/✓ applied/)).toBeTruthy();
    expect(screen.getByText(/✕ not interested/)).toBeTruthy();
  });

  it("its own ⏱ filter is fail-open on unstamped rows and independent (≤7d drops only stamped-stale)", async () => {
    vi.mocked(listResolvedJobReviews).mockResolvedValue([
      row("fresh", "done", 24),
      row("stale", "done", 30 * 24),
      row("undated", "done", null),
    ]);
    render(<AppliedByUserPanel />);
    await screen.findByText(/Applied by User/);
    fireEvent.click(screen.getByText(/Applied by User/)); // expand
    await screen.findByText("Job fresh", { exact: false });
    fireEvent.click(screen.getByTitle(/cycle any/)); // → ≤7d
    expect(screen.queryByText("Job stale")).toBeNull();
    expect(screen.getByText("Job fresh")).toBeTruthy();
    expect(screen.getByText("Job undated")).toBeTruthy(); // fail-open
    expect(screen.getByText("2 of 3 shown")).toBeTruthy();
    expect(screen.getAllByText(/no stamp/).length).toBe(1); // undated marker while a cap is active
  });

  it("Un-resolve calls the RPC: the row leaves the list; success refetches", async () => {
    vi.mocked(listResolvedJobReviews)
      .mockResolvedValueOnce([row("r1", "done", null)])
      .mockResolvedValueOnce([]); // post-unresolve refetch: gone
    render(<AppliedByUserPanel />);
    await screen.findByText(/Applied by User/);
    fireEvent.click(screen.getByText(/Applied by User/)); // expand
    const unBtn = await screen.findByTitle(/BACK into the pending review queue/i);
    await screen.findByText("Job r1", { exact: false });
    fireEvent.click(unBtn);
    expect(vi.mocked(unresolveJobReview)).toHaveBeenCalledWith("r1");
    await vi.waitFor(() => expect(screen.queryByText("Job r1")).toBeNull());
  });
});
