// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/* Smoke: Admin → Discovery end-to-end — REAL classifier, faked DB.     */
/* Mirrors admin-sections.test.tsx: mock the service boundary, render,  */
/* assert what an admin would see and what their clicks send.           */
/* ------------------------------------------------------------------ */

vi.mock("../services/cloud", () => ({ getSupabaseClient: vi.fn().mockResolvedValue(null) }));

const calls: string[] = [];
vi.mock("../services/discovery", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../services/discovery")>();
  return {
    ...orig, /* classifyUrlPreview stays REAL — the crawler's own engine */
    addManualSeed: vi.fn(async () => { calls.push("addManualSeed"); return { ok: true }; }),
    decideSeed: vi.fn(async (id: number, decision: string) => {
      calls.push(`decideSeed:${id}:${decision}`);
      return { ok: true };
    }),
    decideResource: vi.fn(async (id: number, decision: string) => {
      calls.push(`decideResource:${id}:${decision}`);
      return { ok: true };
    }),
    listDiscoverySeeds: vi.fn(async () => [
      {
        id: 6, url: "https://github.com/search?q=javascript%20interview-questions&type=repositories",
        kind: "html" as const, origin: "skill-auto" as const, originDetail: "skill-auto: JavaScript (github repo-search)",
        status: "pending" as const, skill: "JavaScript", note: "",
        createdAt: "2026-09-24T00:00:00Z", decidedAt: null
      }
    ]),
    listDiscoveredResources: vi.fn(async () => [
      {
        id: 11, url: "https://github.com/foo/bar/blob/main/README.md", title: "bar — interview questions",
        kind: "resource" as const,
        attribution: { source: "github", owner: "foo", repo: "bar" },
        license: "no-license", status: "pending" as const, needsLicenseReview: true,
        seedId: 6, meta: { needs_license_review: true },
        createdAt: "2026-09-24T01:00:00Z", decidedAt: null
      }
    ]),
    discoveryCredits: vi.fn(async () => ({ sources: [], total: 0 }))
  };
});

import { DiscoverySection } from "../components/admin/DiscoverySection";

afterEach(() => {
  cleanup();
  calls.length = 0;
  vi.clearAllMocks();
});

describe("Admin → Discovery smoke", () => {
  it("classifies typed input with the REAL engine and queues the seed on click", async () => {
    render(<DiscoverySection />);
    const input = screen.getByPlaceholderText(/github\.com\/topics/);
    fireEvent.change(input, { target: { value: "https://github.com/topics/two-pointer/" } });

    /* real classifySeed + planDiscovery ran inside the component */
    expect((await screen.findAllByText(/github-topic/)).length).toBeGreaterThan(0); // kind chip + crawl action
    expect(screen.getByText("https://github.com/topics/two-pointer")).toBeTruthy(); // canonicalized
    expect(screen.getByText(/github-topic-listing/)).toBeTruthy(); // the exact crawl action

    fireEvent.click(screen.getByText("Queue seed"));
    await waitFor(() => expect(calls).toContain("addManualSeed"));
  });

  it("lists pending seeds/resources and sends approve decisions", async () => {
    render(<DiscoverySection />);
    await screen.findByText(/javascript%20interview-questions/);
    expect(screen.getByText(/auto \(D5\)/)).toBeTruthy();

    /* approve the seed (seeds tab)… */
    fireEvent.click(screen.getByText("✓ Approve"));
    await waitFor(() => expect(calls).toContain("decideSeed:6:approved"));

    /* …then switch to the resources tab: license-review chip + approve there */
    fireEvent.click(screen.getByText(/Resources \(1\)/));
    expect(await screen.findByText(/needs license review/)).toBeTruthy();
    fireEvent.click(screen.getByText("✓ Approve"));
    await waitFor(() => expect(calls).toContain("decideResource:11:approved"));
  });
});
