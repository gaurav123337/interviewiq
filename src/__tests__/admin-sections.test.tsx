// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/* ------------------------------------------------------------------ */
/* Mock all Supabase / cloud services so no real network calls happen   */
/* ------------------------------------------------------------------ */

vi.mock("../services/admin", () => ({
  amOwner: vi.fn().mockResolvedValue(false),
  getAdminState: vi.fn().mockReturnValue({ isAdmin: false, ready: true }),
  subscribeAdmin: vi.fn(() => () => {}),
  adminMetrics: vi.fn().mockResolvedValue(null),
  adminListUsers: vi.fn().mockResolvedValue([]),
  listAdmins: vi.fn().mockResolvedValue([]),
  batchDeleteQuestions: vi.fn(),
  batchSetQuestionsPublished: vi.fn(),
  createQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  setQuestionPublished: vi.fn(),
  updateQuestion: vi.fn(),
  createPdfDocument: vi.fn(),
  deletePdfDocument: vi.fn(),
  listPdfDocuments: vi.fn().mockResolvedValue([]),
  updatePdfDocument: vi.fn(),
  listPdfChunks: vi.fn().mockResolvedValue([]),
  getLastJobsFetchReport: vi.fn().mockResolvedValue(null),
  saveRemoteConfig: vi.fn(),
  saveJobSalaryEnrichment: vi.fn(),
  grantAdmin: vi.fn(),
  revokeAdmin: vi.fn(),
}));

vi.mock("../services/remoteConfig", () => ({
  getAnnouncements: vi.fn().mockReturnValue([]),
  getPublishedQuestions: vi.fn().mockReturnValue([]),
  getRemoteConfig: vi.fn().mockReturnValue({
    features: {},
    ai: { enabled: true },
    limits: {},
    rag: {},
  }),
  saveRemoteConfig: vi.fn(),
  BASE_LIMITS: { sessionsPerMonth: 3, aiPerDay: 5 },
  FREE_LIMITS: { sessionsPerMonth: 3, aiPerDay: 5 },
  isPaywallEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock("../services/cloud", () => ({
  getCloudState: vi.fn().mockReturnValue({ user: null }),
  subscribeCloud: vi.fn(() => () => {}),
  cloudFnHeaders: vi.fn().mockResolvedValue({}),
  getSupabaseClient: vi.fn(),
  isCloudConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock("../services/teams", () => ({
  getTeamsState: vi.fn().mockReturnValue({}),
  subscribeTeams: vi.fn(() => () => {}),
}));

vi.mock("../services/quality", () => ({
  adminQuestionQuality: vi.fn().mockResolvedValue([]),
  adminFeedbackFeed: vi.fn().mockResolvedValue([]),
  adminCodingQuality: vi.fn().mockResolvedValue([]),
  adminCoachGaps: vi.fn().mockResolvedValue([]),
  adminRagHealth: vi.fn().mockResolvedValue([]),
  adminRagDocuments: vi.fn().mockResolvedValue([]),
  adminRagWeeklyDigest: vi.fn().mockResolvedValue(null),
  adminRagDomains: vi.fn().mockResolvedValue([]),
  adminKbSuggestions: vi.fn().mockResolvedValue([]),
  adminKbDocuments: vi.fn().mockResolvedValue([]),
  bestTuningCell: vi.fn().mockReturnValue(null),
  evaluateRagDigest: vi.fn().mockReturnValue([]),
  mergeQuality: vi.fn().mockReturnValue([]),
  ragHealthSummary: vi.fn().mockReturnValue({ total: 0 }),
  ragHistogram: vi.fn().mockReturnValue([]),
  simulateTuning: vi.fn().mockReturnValue([]),
  suggestHardFloor: vi.fn().mockReturnValue(0.5),
  touchQuestion: vi.fn(),
}));

vi.mock("../services/entitlement", () => ({
  adminCreateGrant: vi.fn(),
  adminIssueDiscount: vi.fn(),
  adminListEntitlements: vi.fn().mockResolvedValue([]),
  adminSetEntitlement: vi.fn(),
  PLANS: [],
}));

vi.mock("../services/billing", () => ({
  adminBillingActions: vi.fn().mockResolvedValue([]),
  adminCancelSubscription: vi.fn(),
  adminCreateCoupon: vi.fn(),
  adminListCoupons: vi.fn().mockResolvedValue([]),
  adminListPayments: vi.fn().mockResolvedValue([]),
  adminListSubscriptions: vi.fn().mockResolvedValue([]),
  adminRefundPayment: vi.fn(),
  adminSimulatePurchase: vi.fn(),
  fmtMinor: vi.fn().mockReturnValue("$0"),
  getRefundPolicy: vi.fn().mockReturnValue({}),
  publishRefundPolicy: vi.fn(),
  revenueSummary: vi.fn().mockReturnValue({ paidCount: 0, total: 0 }),
  subscriptionSummary: vi.fn().mockReturnValue({ active: 0 }),
  REFUND_POLICY_DEFAULTS: {},
}));

vi.mock("../services/rag", () => ({
  effectiveGroundingMinSim: vi.fn().mockReturnValue(0.45),
  effectiveHardFloor: vi.fn().mockReturnValue(0.8),
  getRagDigestOpts: vi.fn().mockReturnValue({}),
}));

vi.mock("../services/duplicates", () => ({
  draftIssues: vi.fn().mockReturnValue([]),
  findDuplicates: vi.fn().mockReturnValue([]),
  triageLevel: vi.fn().mockReturnValue("ready"),
}));

vi.mock("../services/cleaner", () => ({
  cleanTextToQuestions: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/import", () => ({
  parseQuestionBatch: vi.fn().mockReturnValue({ ok: [], skipped: [] }),
}));

vi.mock("../services/pdf", () => ({
  extractFileText: vi.fn().mockResolvedValue(""),
}));

vi.mock("../services/indexer", () => ({
  prepareChunks: vi.fn().mockReturnValue([]),
  reindexDocument: vi.fn().mockResolvedValue({ changed: 0, fresh: 0, reused: 0 }),
}));

vi.mock("../services/secrets", () => ({
  fetchSecretStatus: vi.fn().mockResolvedValue(null),
  sendTestEmail: vi.fn(),
}));

vi.mock("../services/aiProvider", () => ({
  getAiProviderConfig: vi.fn().mockResolvedValue(null),
  saveAiProviderConfig: vi.fn(),
  testAiProvider: vi.fn(),
}));

vi.mock("../services/edgeSecrets", () => ({
  getEdgeSecrets: vi.fn().mockResolvedValue([]),
  saveEdgeSecret: vi.fn(),
  APP_MANAGED_SECRETS: [],
}));

const storageStore = new Map<string, unknown>();
vi.mock("../services/storage", () => ({
  storageGet: vi.fn().mockImplementation((key: string, fallback: unknown) => {
    const v = storageStore.get(key);
    return v !== undefined ? v : fallback;
  }),
  storageSet: vi.fn().mockImplementation((key: string, value: unknown) => {
    storageStore.set(key, value);
  }),
  STORAGE_KEYS: { ragAlertWeek: "iq.ragAlertWeek", ragDigestWeek: "iq.ragDigestWeek" },
}));

vi.mock("../services/notifications", () => ({
  weekKey: vi.fn().mockReturnValue("2026-W34"),
}));

vi.mock("../services/policies", () => ({
  getPublishedPolicies: vi.fn().mockResolvedValue({}),
  publishPolicies: vi.fn(),
}));

vi.mock("../data/policies", () => ({
  POLICY_DEFAULTS: {},
  POLICY_META: {},
}));

vi.mock("../services/jobs", () => ({
  getCareerProfile: vi.fn().mockReturnValue(null),
  indiaDigest: vi.fn().mockReturnValue(""),
  lastJobsRefresh: vi.fn().mockReturnValue(0),
  listJobs: vi.fn().mockReturnValue([]),
  rankCompanies: vi.fn().mockReturnValue([]),
  recommendationsDigest: vi.fn().mockReturnValue(""),
  refreshJobs: vi.fn().mockResolvedValue({ total: 0, added: 0, updated: 0, errors: {} }),
}));

vi.mock("../services/applyTrack", () => ({
  applyDigest: vi.fn().mockReturnValue(""),
}));

vi.mock("../ai", () => ({
  chat: vi.fn(),
  aiAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock("../services/drill", () => ({
  practiceForRound: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/questionBank", () => ({
  bankFromRound: vi.fn().mockReturnValue([]),
  listBank: vi.fn().mockResolvedValue([]),
  removeFromBank: vi.fn(),
}));

vi.mock("../services/systemDesignTutor", () => ({
  explainSystemDesign: vi.fn(),
  systemDesignChat: vi.fn(),
}));

vi.mock("../services/rag", () => ({
  effectiveGroundingMinSim: vi.fn().mockReturnValue(0.45),
  effectiveHardFloor: vi.fn().mockReturnValue(0.8),
  getRagDigestOpts: vi.fn().mockReturnValue({}),
  lexicalSearch: vi.fn().mockResolvedValue([]),
  documentTitles: vi.fn().mockReturnValue([]),
  ragTuningInfo: vi.fn().mockReturnValue(""),
}));

vi.mock("../services/goal", () => ({
  getGoal: vi.fn().mockReturnValue(null),
}));

vi.mock("../toast", () => ({
  toast: vi.fn(),
}));

vi.mock("../config", () => ({
  CONFIG: { supabase: { url: "https://test.supabase.co" } },
}));

beforeEach(() => {
  localStorage.clear();
  storageStore.clear();
  cleanup();
});

/* ------------------------------------------------------------------ */
/* Test: OverviewSection exports and renders                            */
/* ------------------------------------------------------------------ */

describe("admin section components", () => {
  it("OverviewSection exports and is a function", async () => {
    const mod = await import("../components/admin/OverviewSection");
    expect(typeof mod.OverviewSection).toBe("function");
  });

  it("AnnouncementsSection exports and is a function", async () => {
    const mod = await import("../components/admin/AnnouncementsSection");
    expect(typeof mod.AnnouncementsSection).toBe("function");
  });

  it("TeamsSection exports and is a function", async () => {
    const mod = await import("../components/admin/TeamsSection");
    expect(typeof mod.TeamsSection).toBe("function");
  });

  it("SecuritySection exports and is a function", async () => {
    const mod = await import("../components/admin/SecuritySection");
    expect(typeof mod.SecuritySection).toBe("function");
  });

  it("ResourcesSection exports and is a function", async () => {
    const mod = await import("../components/admin/ResourcesSection");
    expect(typeof mod.ResourcesSection).toBe("function");
  });

  it("TrendsSection exports and is a function", async () => {
    const mod = await import("../components/admin/TrendsSection");
    expect(typeof mod.TrendsSection).toBe("function");
  });

  it("QuestionsSection exports and is a function", async () => {
    const mod = await import("../components/admin/QuestionsSection");
    expect(typeof mod.QuestionsSection).toBe("function");
  });

  it("ActivitySection exports and is a function", async () => {
    const mod = await import("../components/admin/ActivitySection");
    expect(typeof mod.ActivitySection).toBe("function");
  });

  it("ScraperSection exports and is a function", async () => {
    const mod = await import("../components/admin/ScraperSection");
    expect(typeof mod.ScraperSection).toBe("function");
  });

  it("SecretsSection exports and is a function", async () => {
    const mod = await import("../components/admin/SecretsSection");
    expect(typeof mod.SecretsSection).toBe("function");
  });

  it("BillingSection exports and is a function", async () => {
    const mod = await import("../components/admin/BillingSection");
    expect(typeof mod.BillingSection).toBe("function");
  });

  it("ReviewInbox exports and is a function", async () => {
    const mod = await import("../components/admin/ReviewInbox");
    expect(typeof mod.ReviewInbox).toBe("function");
  });

  it("AutoFill (ImportSection) exports and is a function", async () => {
    const mod = await import("../components/admin/ImportSection");
    expect(typeof mod.AutoFill).toBe("function");
  });

  it("UsersSection exports and is a function", async () => {
    const mod = await import("../components/admin/UsersSection");
    expect(typeof mod.UsersSection).toBe("function");
  });

  it("QualitySection exports and is a function", async () => {
    const mod = await import("../components/admin/QualitySection");
    expect(typeof mod.QualitySection).toBe("function");
  });

  it("ConfigSection exports and is a function", async () => {
    const mod = await import("../components/admin/ConfigSection");
    expect(typeof mod.ConfigSection).toBe("function");
  });

  it("Admin exports and renders access-denied for non-admin", async () => {
    const { Admin } = await import("../components/Admin");
    render(<Admin />);
    expect(screen.getByText(/Admin only/)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* Test: system-design components export correctly                      */
/* ------------------------------------------------------------------ */

describe("system-design section components", () => {
  it("TimedPractice exports", async () => {
    const mod = await import("../components/system-design/TimedPractice");
    expect(typeof mod.TimedPractice).toBe("function");
  });

  it("StatsDrawer exports", async () => {
    const mod = await import("../components/system-design/StatsDrawer");
    expect(typeof mod.StatsDrawer).toBe("function");
  });

  it("FlashcardDrawer exports", async () => {
    const mod = await import("../components/system-design/FlashcardDrawer");
    expect(typeof mod.FlashcardDrawer).toBe("function");
  });

  it("CaseCard exports", async () => {
    const mod = await import("../components/system-design/CaseCard");
    expect(typeof mod.CaseCard).toBe("function");
  });

  it("CaseDrawer exports", async () => {
    const mod = await import("../components/system-design/CaseDrawer");
    expect(typeof mod.CaseDrawer).toBe("function");
  });

  it("utils exports persistence helpers", async () => {
    const mod = await import("../components/system-design/utils");
    expect(typeof mod.loadQuiz).toBe("function");
    expect(typeof mod.saveQuiz).toBe("function");
    expect(typeof mod.loadCompleted).toBe("function");
    expect(typeof mod.markCompleted).toBe("function");
    expect(typeof mod.calculateStreak).toBe("function");
    expect(typeof mod.exportProgress).toBe("function");
    expect(typeof mod.CATEGORY_META).toBe("object");
  });
});

/* ------------------------------------------------------------------ */
/* Test: jobs modal components export correctly                         */
/* ------------------------------------------------------------------ */

describe("jobs modal components", () => {
  it("ReportModal exports", async () => {
    const mod = await import("../components/jobs/ReportModal");
    expect(typeof mod.ReportModal).toBe("function");
  });

  it("RoundModal exports", async () => {
    const mod = await import("../components/jobs/RoundModal");
    expect(typeof mod.RoundModal).toBe("function");
  });

  it("DraftModal exports", async () => {
    const mod = await import("../components/jobs/DraftModal");
    expect(typeof mod.DraftModal).toBe("function");
  });

  it("RecsDigestModal exports", async () => {
    const mod = await import("../components/jobs/RecsDigestModal");
    expect(typeof mod.RecsDigestModal).toBe("function");
  });

  it("TagInput exports", async () => {
    const mod = await import("../components/jobs/TagInput");
    expect(typeof mod.TagInput).toBe("function");
  });
});

/* ------------------------------------------------------------------ */
/* Test: system-design utils persistence round-trip                     */
/* ------------------------------------------------------------------ */

describe("system-design persistence", () => {
  it("loadQuiz returns default when empty", async () => {
    const { loadQuiz } = await import("../components/system-design/utils");
    const q = loadQuiz();
    expect(q.active).toBe(false);
    expect(q.caseIds).toEqual([]);
    expect(q.currentIdx).toBe(0);
    expect(q.score).toBe(0);
  });

  it("saveQuiz and loadQuiz round-trip", async () => {
    const { loadQuiz, saveQuiz } = await import("../components/system-design/utils");
    const custom = { active: true, caseIds: ["a", "b"], currentIdx: 1, timePerCase: 120, startedAt: 1000, caseStartedAt: 2000, score: 3, answeredCaseIds: ["a"] };
    saveQuiz(custom);
    const loaded = loadQuiz();
    expect(loaded.active).toBe(true);
    expect(loaded.caseIds).toEqual(["a", "b"]);
    expect(loaded.score).toBe(3);
  });

  it("markCompleted stores timestamp", async () => {
    const { markCompleted, loadCompleted } = await import("../components/system-design/utils");
    const before = Date.now();
    markCompleted("test-case-1");
    const c = loadCompleted();
    expect(c["test-case-1"]).toBeGreaterThanOrEqual(before);
  });

  it("calculateStreak returns 0 for empty", async () => {
    const { calculateStreak } = await import("../components/system-design/utils");
    const s = calculateStreak({});
    expect(s.current).toBe(0);
    expect(s.best).toBe(0);
  });

  it("exportProgress returns valid JSON", async () => {
    const { exportProgress } = await import("../components/system-design/utils");
    const json = exportProgress();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty("exportedAt");
    expect(parsed).toHaveProperty("completed");
    expect(parsed).toHaveProperty("history");
  });
});
