/* Tests for the job-sites registry service (UI half of the discovery engine). */
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Mock the cloud module: clientFn.value controls what getSupabaseClient resolves to. */
const clientFn = { value: null as unknown };
vi.mock("../services/cloud", () => ({
  getSupabaseClient: vi.fn(() => Promise.resolve(clientFn.value)),
}));

import { listJobSites, setJobSiteStatus, summarizeSite } from "../services/jobSites";

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
