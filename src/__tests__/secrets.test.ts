/* Edge Function secret status — the admin service that answers "which
   secrets are configured vs missing". The server only reports presence
   (never values); the client maps the report and surfaces rejections. */

import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  getSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getSession }
  })
}));

afterEach(() => {
  vi.unstubAllGlobals();
  getSession.mockReset();
});

const REPORT = {
  ok: true,
  checkedAt: "2026-08-17T00:00:00Z",
  serviceRoleAvailable: true,
  secrets: [
    { name: "RESEND_API_KEY", configured: true, required: true, builtin: false, functions: ["send-apply-digest"], note: "Resend API key" },
    { name: "TRENDS_REFRESH_SECRET", configured: false, required: true, builtin: false, functions: ["trends-refresh"], note: "cron secret" },
    { name: "GITHUB_TOKEN", configured: false, required: false, builtin: false, functions: ["trends-refresh"], note: "optional" }
  ],
  summary: {
    total: 3,
    configured: 1,
    missing: 2,
    missingRequired: 1,
    missingOptional: 1,
    missingRequiredNames: ["TRENDS_REFRESH_SECRET"],
    missingOptionalNames: ["GITHUB_TOKEN"]
  }
};

describe("fetchSecretStatus", () => {
  it("GETs the secret-status function with the session token and maps the report", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => REPORT });
    vi.stubGlobal("fetch", fetchMock);
    getSession.mockResolvedValue({ data: { session: { access_token: "tok-secrets" } } });

    const { fetchSecretStatus } = await import("../services/secrets");
    const r = await fetchSecretStatus();

    expect(r.ok).toBe(true);
    expect(r.summary.missingRequiredNames).toEqual(["TRENDS_REFRESH_SECRET"]);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/secret-status");
    expect(opts.method).toBe("GET");
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer tok-secrets");
  });

  it("throws with the server error when the caller isn't an admin", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: "forbidden — admin session required" }) }));
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });

    const { fetchSecretStatus } = await import("../services/secrets");
    await expect(fetchSecretStatus()).rejects.toThrow(/forbidden/);
  });

  it("throws when signed out", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const { fetchSecretStatus } = await import("../services/secrets");
    await expect(fetchSecretStatus()).rejects.toThrow(/signed out/);
  });
});
