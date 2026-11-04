// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/* ResumeVariantsPanel (Phase 2 approval surface): rows render honestly, the
   approve/revert buttons call the service and reflect back, and an unapplied
   SQL state surfaces as an error line — never as a silent fake-empty list.
   Services fully mocked; no engine-lib dependency is required by this panel. */
vi.mock("../services/jobSites.ts", () => ({
  listResumeVariants: vi.fn(),
  approveResumeVariant: vi.fn().mockResolvedValue(undefined),
}));

import ResumeVariantsPanel from "../components/jobs/ResumeVariantsPanel";
import { listResumeVariants, approveResumeVariant, type ResumeVariantRow } from "../services/jobSites.ts";

const variant = (id: string, approved: boolean, keywords: string[] = ["GraphQL"]): ResumeVariantRow => ({
  id,
  site_host: "instahyre.com",
  job_url: `https://www.instahyre.com/job/${id}`,
  title: `Role ${id}`,
  company: "Acme",
  master_text: "SUMMARY\nFrontend.",
  variant_text: "SUMMARY\nFrontend + GraphQL.",
  diff_summary: {
    sections: [{ heading: "SUMMARY", status: "changed", matchedKeywords: keywords }],
    changedCount: 1,
    matchedKeywords: keywords,
  },
  variant_id: `v${id}`,
  approved,
  created_at: new Date().toISOString(),
  approved_at: approved ? new Date().toISOString() : null,
});

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ResumeVariantsPanel — the approval loop", () => {
  it("renders unapproved rows and approves via the RPC", async () => {
    vi.mocked(listResumeVariants).mockResolvedValue([variant("a", false)]);
    render(<ResumeVariantsPanel />);
    fireEvent.click(await screen.findByText(/Tailored resumes/)); // expand
    expect(await screen.findByText("Role a · Acme")).toBeTruthy();
    expect(screen.getByText(/^1 awaiting approval$|^1/)).toBeTruthy();

    fireEvent.click(await screen.findByText("✓ approve"));
    expect(approveResumeVariant).toHaveBeenCalledWith("a", true);
  });

  it("shows the diff with the keyword justification on demand", async () => {
    vi.mocked(listResumeVariants).mockResolvedValue([variant("b", false)]);
    render(<ResumeVariantsPanel />);
    fireEvent.click(await screen.findByText(/Tailored resumes/));
    fireEvent.click(await screen.findByText("diff"));
    expect(await screen.findByText(/SUMMARY/)).toBeTruthy();
    expect(screen.getByText(/justified by GraphQL/)).toBeTruthy();
  });

  it("an unsupported edit is flagged instead of smuggled past the owner", async () => {
    vi.mocked(listResumeVariants).mockResolvedValue([variant("c", false, [])]);
    render(<ResumeVariantsPanel />);
    fireEvent.click(await screen.findByText(/Tailored resumes/));
    fireEvent.click(await screen.findByText("diff"));
    expect(await screen.findByText(/no JD keyword support/)).toBeTruthy();
  });

  it("unapplied SQL surfaces as the honest error, not a fake empty list", async () => {
    vi.mocked(listResumeVariants).mockRejectedValue(new Error("rpc admin_list_resume_variants 404 (PGRST202)"));
    render(<ResumeVariantsPanel />);
    fireEvent.click(await screen.findByText(/Tailored resumes/));
    expect(await screen.findByText(/admin_list_resume_variants/)).toBeTruthy();
  });

  it("reverts an approved row", async () => {
    vi.mocked(listResumeVariants).mockResolvedValue([variant("d", true)]);
    render(<ResumeVariantsPanel />);
    fireEvent.click(await screen.findByText(/Tailored resumes/));
    expect(await screen.findByText("all approved")).toBeTruthy();
    fireEvent.click(await screen.findByText("✕ revert"));
    expect(approveResumeVariant).toHaveBeenCalledWith("d", false);
  });
});
