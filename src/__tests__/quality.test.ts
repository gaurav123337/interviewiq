// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: null, configured: true, syncing: false, error: null, oauth: [] }),
  getSupabaseClient: vi.fn(),
  subscribeCloud: () => () => {}
}));

import { getSupabaseClient } from "../services/cloud";
import {
  draftIssues, findDuplicates, normalizeText, tokenJaccard, triageLevel
} from "../services/duplicates";
import { hasVoted, sendFeedback, voteCount } from "../services/feedback";
import {
  mergeQuality, qualityBand, qualityScore, stalenessDays
} from "../services/quality";

beforeEach(() => {
  localStorage.clear();
  vi.mocked(getSupabaseClient).mockReset();
});

describe("duplicates", () => {
  it("normalizes text for comparison", () => {
    expect(normalizeText("Design a  URL-shortener!")).toBe("design a url shortener");
    expect(normalizeText("  Tell   me about React? ")).toBe("tell me about react");
  });

  it("token Jaccard: identical = 1, disjoint = 0", () => {
    expect(tokenJaccard("Design a URL shortener.", "Design a URL shortener.")).toBe(1);
    expect(tokenJaccard("Design a URL shortener.", "What is your favorite color?")).toBe(0);
    expect(tokenJaccard("Design a rate limiter.", "Design a rate limiter for APIs")).toBeGreaterThan(0.6);
    expect(tokenJaccard("Design a chat app.", "Design a news feed.")).toBeLessThan(0.5);
  });

  it("findDuplicates flags near-dupes above the threshold", () => {
    const bank = [
      "Design a URL shortener for a large company.",
      "Design a news feed."
    ];
    const matches = findDuplicates("Design a URL shortener.", bank, 0.5);
    expect(matches).toHaveLength(1);
    expect(matches[0].sim).toBeGreaterThan(0.5);
    expect(findDuplicates("How do you handle conflict?", bank)).toHaveLength(0);
  });
});

describe("draft triage", () => {
  it("flags weak drafts", () => {
    expect(draftIssues({ question: "", answer: "", keyPoints: [] })).toContain("missing question");
    const weak = draftIssues({ question: "React?", answer: "yes", keyPoints: [] });
    expect(weak).toContain("answer too short");
    expect(weak).toContain("no key points");
    expect(weak).toContain("question too short");
    expect(weak).not.toContain("missing model answer"); /* 'yes' is not empty */
    expect(triageLevel(weak)).toBe("review-first");
  });

  it("passes strong drafts", () => {
    const strong = draftIssues({
      question: "Explain how React reconciliation works and when it re-renders?",
      answer: "React diffs the virtual DOM between renders, reconciles changes by component type and key, and re-renders when state, props or context change.",
      keyPoints: ["virtual dom diff", "keys", "render triggers"]
    });
    expect(strong).toHaveLength(0);
    expect(triageLevel(strong)).toBe("ready");
  });

  it("flags statements that aren't questions", () => {
    const issues = draftIssues({ question: "The event loop in Node.js.", answer: "x".repeat(80), keyPoints: ["k1", "k2"] });
    expect(issues).toContain("looks like a statement, not a question");
  });
});

describe("quality score", () => {
  const row = {
    question: "q", fieldId: "backend", level: "senior",
    attempts: 10, avgScore: 3.5, missRate: 20, passRate: 70,
    ups: 2, downs: 0, flags: 0, lastSeen: null
  };

  it("healthy question scores high", () => {
    expect(qualityScore(row, 10)).toBeGreaterThanOrEqual(80);
    expect(qualityBand(qualityScore(row, 10))).toBe("healthy");
  });

  it("penalizes misses, flags, and staleness", () => {
    const fresh = qualityScore(row, 10);
    const bad = qualityScore({ ...row, avgScore: 1.5, missRate: 70, downs: 3, flags: 2 }, 400);
    expect(bad).toBeLessThan(fresh - 30);
    expect(qualityBand(bad)).toBe("fix");
  });

  it("penalizes both too-easy and too-hard pass rates", () => {
    const ideal = qualityScore(row, 10);
    expect(qualityScore({ ...row, passRate: 98 }, 10)).toBeLessThan(ideal);
    expect(qualityScore({ ...row, passRate: 10 }, 10)).toBeLessThan(ideal);
  });

  it("clamps to 0-100", () => {
    expect(qualityScore({ ...row, avgScore: 5, ups: 50 }, 5)).toBeLessThanOrEqual(100);
    expect(qualityScore({ ...row, avgScore: 0, missRate: 100, flags: 20, downs: 20 }, 999)).toBeGreaterThanOrEqual(0);
  });

  it("stalenessDays is null for unknown and 0 for fresh", () => {
    expect(stalenessDays(null)).toBeNull();
    expect(stalenessDays(new Date().toISOString())).toBe(0);
    expect(stalenessDays(new Date(Date.now() - 400 * 86_400_000).toISOString())).toBeGreaterThan(300);
  });

  it("mergeQuality sorts worst-first and merges staleness from the bank", () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const merged = mergeQuality(
      [
        { ...row, question: "good", attempts: 9 },
        { ...row, question: "bad", avgScore: 1, missRate: 80, passRate: 15, attempts: 12 }
      ],
      [
        { question: "bad", updatedAt: old },
        { question: "good", updatedAt: new Date().toISOString() }
      ]
    );
    expect(merged[0].question).toBe("bad");
    expect(merged[0].staleDays).toBeGreaterThan(300);
    expect(merged[1].staleDays).toBeLessThan(5);
  });
});

describe("feedback", () => {
  function fakeClient() {
    const calls: { table: string; row: Record<string, unknown> }[] = [];
    return {
      client: {
        auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
        from: (table: string) => ({
          insert: async (row: Record<string, unknown>) => {
            calls.push({ table, row });
            return { error: null };
          }
        })
      },
      calls
    };
  }

  it("sends feedback and remembers the vote", async () => {
    const { client, calls } = fakeClient();
    vi.mocked(getSupabaseClient).mockResolvedValue(client as never);

    const ok = await sendFeedback({ question: "Q1?", kind: "up", fieldId: "backend", level: "senior" });
    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].row).toMatchObject({ question: "Q1?", kind: "up", user_id: "u1" });
    expect(hasVoted("Q1?", "up")).toBe(true);
    expect(voteCount()).toBe(1);
  });

  it("does not double-count", async () => {
    const { client } = fakeClient();
    vi.mocked(getSupabaseClient).mockResolvedValue(client as never);
    await sendFeedback({ question: "Q1?", kind: "up" });
    await sendFeedback({ question: "Q1?", kind: "down" });
    /* second vote is still sent but hasVoted now reflects the latest kind */
    expect(hasVoted("Q1?", "down")).toBe(true);
    expect(voteCount()).toBe(1);
  });

  it("is best-effort: no client → not recorded", async () => {
    vi.mocked(getSupabaseClient).mockResolvedValue(null as never);
    const ok = await sendFeedback({ question: "Q1?", kind: "flag", reason: "outdated" });
    expect(ok).toBe(false);
    expect(hasVoted("Q1?")).toBe(false);
  });
});
