/* Tests for the job-sites registry service (UI half of the discovery engine). */
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Mock the cloud module: clientFn.value controls what getSupabaseClient resolves to. */
const clientFn = { value: null as unknown };
vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn(() => Promise.resolve(clientFn.value)),
}));

import { listJobSites, setJobSiteStatus, summarizeSite, listJobReviews, resolveJobReview, getNotifyConfig, setNotifyConfig, getApplyConfig, setApplyConfig, listApplyResults, applyResultCounts, sendApplyFeedback, getSkillStrikes, putJudgeExemplar, listJudgeExemplars, deleteJudgeExemplar, testNotifyConfig } from "../services/jobSites";

const rpc = vi.fn();
const client = { rpc };

beforeEach(() => {
  rpc.mockReset();
  clientFn.value = client;
});

describe("listJobSites", () => {
  it("returns the admin_list_job_sites rows", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { id: "s1", host: "instahyre.com", label: "Instahyre", status: "active", session_ok: true, last_run_at: "2026-09-27T05:00:00Z", last_submitted: 1, last_collected: 4, last_ok: true },
        { id: "s2", host: "cutshort.io", label: "Cutshort", status: "pending", session_ok: false, last_run_at: null, last_submitted: 0, last_collected: 0, last_ok: null },
      ],
      error: null,
    });
    const sites = await listJobSites();
    expect(rpc).toHaveBeenCalledWith("admin_list_job_sites");
    expect(sites).toHaveLength(2);
    expect(sites[0].host).toBe("instahyre.com");
    expect(sites[1].status).toBe("pending");
  });

  it("throws when cloud is not configured", async () => {
    clientFn.value = null;
    await expect(listJobSites()).rejects.toThrow(/cloud not configured/);
    clientFn.value = client;
  });
});

describe("setJobSiteStatus", () => {
  it("calls admin_set_job_site_status with the id + status", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await setJobSiteStatus("s2", "active");
    expect(rpc).toHaveBeenCalledWith("admin_set_job_site_status", { p_id: "s2", p_status: "active" });
  });

  it("propagates RPC errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    await expect(setJobSiteStatus("s2", "active")).rejects.toThrow("forbidden");
  });
});

describe("summarizeSite", () => {
  it("describes never-run, failed, and ok runs", () => {
    expect(summarizeSite({ last_run_at: null } as never)).toBe("never run");
    expect(summarizeSite({ last_run_at: "2026-09-27T05:00:00Z", last_ok: false } as never)).toMatch(/failed/);
    expect(summarizeSite({ last_run_at: "2026-09-27T05:00:00Z", last_ok: true, last_submitted: 2, last_collected: 5 } as never)).toMatch(/2 submitted \/ 5 seen/);
  });
});

describe("review queue", () => {
  it("returns pending review items via admin_list_job_reviews", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { id: "r1", site_host: "linkedin.com", job_url: "https://x/job", title: "Frontend Engineer", company: "Acme", form_url: "https://x/form", reason: "review gate", created_at: "2026-09-27T09:00:00Z" },
      ],
      error: null,
    });
    const rows = await listJobReviews();
    expect(rpc).toHaveBeenCalledWith("admin_list_job_reviews");
    expect(rows).toHaveLength(1);
    expect(rows[0].site_host).toBe("linkedin.com");
    expect(rows[0].form_url).toBe("https://x/form");
  });

  it("throws when cloud is not configured", async () => {
    clientFn.value = null;
    await expect(listJobReviews()).rejects.toThrow(/cloud not configured/);
    clientFn.value = client;
  });

  it("resolves an item with admin_resolve_job_review", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await resolveJobReview("r1", "done");
    expect(rpc).toHaveBeenCalledWith("admin_resolve_job_review", { p_id: "r1", p_status: "done" });
  });

  it("putJudgeExemplar writes the owner verdict with posting id when known", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await putJudgeExemplar("positive", "Senior Frontend Developer at Acme (4471345244): owner-confirmed relevant", "guest view", "https://www.linkedin.com/jobs/view/4471345244/");
    expect(rpc).toHaveBeenCalledWith("admin_put_judge_exemplar", { p_kind: "positive", p_summary: "Senior Frontend Developer at Acme (4471345244): owner-confirmed relevant", p_reason: "guest view", p_source_url: "https://www.linkedin.com/jobs/view/4471345244/" });
  });

  it("propagates resolve errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    await expect(resolveJobReview("r1", "dismissed")).rejects.toThrow("forbidden");
  });

  it("passes the closed status through (posting no longer accepting)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await resolveJobReview("r2", "closed");
    expect(rpc).toHaveBeenCalledWith("admin_resolve_job_review", { p_id: "r2", p_status: "closed" });
  });
});

describe("judge exemplar management", () => {
  it("lists every taught exemplar with ids via admin_list_judge_exemplars", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { id: "e1", kind: "positive", summary: "Senior Frontend Developer at Acme (4471345244): owner-confirmed relevant", reason: "owner applied", source_url: "https://x/j", created_at: "2026-09-29T16:22:00Z" },
        { id: "e2", kind: "negative", summary: "DevOps Engineer at CloudCo: owner not interested", reason: null, source_url: null, created_at: "2026-09-28T10:00:00Z" },
      ],
      error: null,
    });
    const rows = await listJudgeExemplars();
    expect(rpc).toHaveBeenCalledWith("admin_list_judge_exemplars");
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe("positive");
    expect(rows[0].source_url).toBe("https://x/j");
  });

  it("deletes one lesson via admin_delete_judge_exemplar", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await deleteJudgeExemplar("e2");
    expect(rpc).toHaveBeenCalledWith("admin_delete_judge_exemplar", { p_id: "e2" });
  });

  it("propagates exemplar list errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    await expect(listJudgeExemplars()).rejects.toThrow("forbidden");
  });
});

describe("notify test-fire", () => {
  it("returns the server-reported delivery status", async () => {
    rpc.mockResolvedValueOnce({ data: "sent", error: null });
    const res = await testNotifyConfig();
    expect(rpc).toHaveBeenCalledWith("admin_test_notify_config");
    expect(res).toBe("sent");
  });

  it("surfaces config errors from the RPC (bad token etc.)", async () => {
    rpc.mockResolvedValueOnce({ data: "error 401: Unauthorized", error: null });
    const res = await testNotifyConfig();
    expect(res).toMatch(/error 401/);
  });

  it("propagates RPC errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    await expect(testNotifyConfig()).rejects.toThrow("forbidden");
  });
});

describe("apply mode config (off/local/cloud)", () => {
  it("reads the global row via admin_get_apply_config", async () => {
    rpc.mockResolvedValueOnce({ data: [{ mode: "off", cloud_provider: null, cloud_endpoint: null, updated_at: "2026-09-28T06:00:00Z" }], error: null });
    const cfg = await getApplyConfig();
    expect(rpc).toHaveBeenCalledWith("admin_get_apply_config");
    expect(cfg?.mode).toBe("off");
  });

  it("returns null when the config row is missing", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await getApplyConfig()).toBeNull();
  });

  it("off mode sends no cloud fields (the kill switch needs nothing else)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await setApplyConfig("off");
    expect(rpc).toHaveBeenCalledWith("admin_set_apply_config", { p_mode: "off", p_cloud_provider: null, p_cloud_endpoint: null });
  });

  it("cloud mode carries the provider + CDP endpoint", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await setApplyConfig("cloud", "browserbase", "wss://cdn.browserbase.com/session/x");
    expect(rpc).toHaveBeenCalledWith("admin_set_apply_config", { p_mode: "cloud", p_cloud_provider: "browserbase", p_cloud_endpoint: "wss://cdn.browserbase.com/session/x" });
  });

  it("propagates the RPC rejection (cloud without endpoint is rejected server-side)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "cloud mode needs a CDP endpoint" } });
    await expect(setApplyConfig("cloud", "browserbase", "")).rejects.toThrow(/CDP endpoint/);
  });
});

describe("applications report", () => {
  it("lists per-job decisions via admin_list_apply_results", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { id: "a1", site_host: "naukri.com", job_url: "https://x/1", title: "FE Eng", company: "Acme", result: "submitted", detail: "ok", fit: 90, created_at: "2026-09-28T06:00:00Z" },
        { id: "a2", site_host: "naukri.com", job_url: "https://x/2", title: "BE Eng", company: "Beta", result: "skipped", detail: "JD requires go — not on the resume", fit: null, created_at: "2026-09-28T05:00:00Z" },
      ],
      error: null,
    });
    const rows = await listApplyResults(50);
    expect(rpc).toHaveBeenCalledWith("admin_list_apply_results", { p_limit: 50 });
    expect(rows).toHaveLength(2);
    expect(rows[0].result).toBe("submitted");
  });

  it("throws when cloud is not configured", async () => {
    clientFn.value = null;
    await expect(listApplyResults()).rejects.toThrow(/cloud not configured/);
    clientFn.value = client;
  });

  it("tallies the four result kinds (and ignores unknowns)", () => {
    const rows = [
      { result: "submitted" }, { result: "submitted" },
      { result: "needs_review" },
      { result: "skipped" }, { result: "skipped" }, { result: "skipped" },
      { result: "error" },
      { result: "something-else" },
    ] as never;
    const c = applyResultCounts(rows);
    expect(c).toEqual({ submitted: 2, needs_review: 1, skipped: 3, error: 1 });
  });
});

describe("feedback learning loop (👍/👎 → learned strikes)", () => {
  it("👎 sends the verdict + missing-core skills and returns strike counts", async () => {
    rpc.mockResolvedValueOnce({ data: [{ skill: "python", strikes: 1 }], error: null });
    const out = await sendApplyFeedback("row-1", "bad", ["python"]);
    expect(rpc).toHaveBeenCalledWith("engine_apply_feedback", { p_result_id: "row-1", p_verdict: "bad", p_skills: ["python"] });
    expect(out[0]).toEqual({ skill: "python", strikes: 1 });
  });

  it("👍 clears strikes (skills array still passed)", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await sendApplyFeedback("row-2", "good", ["python"]);
    expect(rpc).toHaveBeenCalledWith("engine_apply_feedback", { p_result_id: "row-2", p_verdict: "good", p_skills: ["python"] });
  });

  it("empty skills list is sent as null (verdict-only feedback)", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await sendApplyFeedback("row-3", "bad", []);
    expect(rpc).toHaveBeenCalledWith("engine_apply_feedback", { p_result_id: "row-3", p_verdict: "bad", p_skills: null });
  });

  it("reads learned strikes for the UI strip", async () => {
    rpc.mockResolvedValueOnce({ data: [{ skill: "python", strikes: 2 }], error: null });
    const s = await getSkillStrikes();
    expect(rpc).toHaveBeenCalledWith("admin_get_skill_strikes");
    expect(s).toEqual([{ skill: "python", strikes: 2 }]);
  });

  it("propagates feedback errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    await expect(sendApplyFeedback("row-x", "bad", [])).rejects.toThrow("forbidden");
  });
});

describe("notify config", () => {
  it("reads the telegram row via admin_get_notify_config", async () => {
    rpc.mockResolvedValueOnce({ data: [{ chat_id: "42", bot_token: "tok", updated_at: "2026-09-27T09:00:00Z" }], error: null });
    const cfg = await getNotifyConfig();
    expect(rpc).toHaveBeenCalledWith("admin_get_notify_config");
    expect(cfg?.chat_id).toBe("42");
  });

  it("returns null when unset", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await getNotifyConfig()).toBeNull();
  });

  it("saves via admin_set_notify_config", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await setNotifyConfig("42", "tok");
    expect(rpc).toHaveBeenCalledWith("admin_set_notify_config", { p_chat_id: "42", p_bot_token: "tok" });
  });
});
