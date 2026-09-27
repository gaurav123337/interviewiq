/* Tests for the job-sites registry service (UI half of the discovery engine). */
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Mock the cloud module: clientFn.value controls what getSupabaseClient resolves to. */
const clientFn = { value: null as unknown };
vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn(() => Promise.resolve(clientFn.value)),
}));

import { listJobSites, setJobSiteStatus, summarizeSite, listJobReviews, resolveJobReview, getNotifyConfig, setNotifyConfig } from "../services/jobSites";

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

  it("propagates resolve errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    await expect(resolveJobReview("r1", "dismissed")).rejects.toThrow("forbidden");
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
