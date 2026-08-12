/* Public legal policies — template defaults, admin-published overrides,
   placeholder filling, and the publish path (app_config → "policies"). */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIG } from "../config";
import { POLICY_DEFAULTS } from "../data/policies";
import { setRemoteConfig } from "../services/remoteConfig";
import { STORAGE_KEYS, storageRemove } from "../services/storage";

const from = vi.hoisted(() => vi.fn());
const upsert = vi.hoisted(() => vi.fn());

vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: null, configured: true, syncing: false, error: null, oauth: [] }),
  getSupabaseClient: vi.fn().mockResolvedValue({ from })
}));

beforeEach(() => {
  from.mockReset();
  upsert.mockReset();
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
  setRemoteConfig({});
});

afterEach(() => {
  from.mockReset();
  upsert.mockReset();
  Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
});

describe("getPolicyDoc", () => {
  it("returns the baked-in template with placeholders filled", async () => {
    const { getPolicyDoc } = await import("../services/policies");
    const body = getPolicyDoc("terms");
    expect(body).toContain(CONFIG.productName);
    expect(body).toContain(CONFIG.supportEmail);
    expect(body).not.toContain("{{company}}");
    expect(body).not.toContain("{{email}}");
    /* {{url}} only appears in the privacy doc; it resolves to the live origin
       (jsdom supplies its own origin in tests, so we only check it's filled) */
    const privacy = getPolicyDoc("privacy");
    expect(privacy).not.toContain("{{url}}");
    expect(privacy).toContain("http");
    /* all four docs exist and are non-trivial */
    for (const id of Object.keys(POLICY_DEFAULTS) as (keyof typeof POLICY_DEFAULTS)[]) {
      expect(getPolicyDoc(id).length).toBeGreaterThan(200);
    }
  });

  it("an admin-published override wins over the baked-in template", async () => {
    setRemoteConfig({ policies: { terms: "## Custom Terms\nOur custom rules." } });
    const { getPolicyDoc } = await import("../services/policies");
    const body = getPolicyDoc("terms");
    expect(body).toContain("Custom Terms");
    expect(body).toContain("Our custom rules.");
    expect(body).not.toContain("Acceptance of Terms");
  });

  it("missing keys in the published set fall back to defaults", async () => {
    setRemoteConfig({ policies: { privacy: "## Custom Privacy" } });
    const { getPolicyDoc } = await import("../services/policies");
    expect(getPolicyDoc("privacy")).toContain("Custom Privacy");
    expect(getPolicyDoc("terms")).toContain("Acceptance of Terms");
  });

  it("getPolicyDocs returns all four ids", async () => {
    const { getPolicyDocs } = await import("../services/policies");
    const docs = getPolicyDocs();
    expect(docs.map(d => d.id).sort()).toEqual(["privacy", "refunds", "shipping", "terms"]);
  });
});

describe("publish + read", () => {
  it("publishes overrides via app_config upsert (key = policies)", async () => {
    from.mockReturnValue({ upsert });
    upsert.mockResolvedValue({ error: null });
    const { publishPolicies } = await import("../services/policies");
    await publishPolicies({ terms: "X", privacy: "Y", refunds: "Z", shipping: "W" });
    expect(from).toHaveBeenCalledWith("app_config");
    const [arg] = upsert.mock.calls[0] as [{ key: string; value: Record<string, string> }];
    expect(arg.key).toBe("policies");
    expect(arg.value).toMatchObject({ terms: "X", privacy: "Y", refunds: "Z", shipping: "W" });
  });

  it("reads published overrides; empty when unpublished", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { value: { terms: "Published T" } }, error: null });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) });
    const { getPublishedPolicies } = await import("../services/policies");
    const p = await getPublishedPolicies();
    expect(p.terms).toBe("Published T");
    expect(from).toHaveBeenCalledWith("app_config");

    from.mockReset();
    const empty = vi.fn().mockResolvedValue({ data: null, error: null });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: empty }) }) });
    const p2 = await getPublishedPolicies();
    expect(p2).toEqual({});
  });

  it("publish surfaces a server rejection", async () => {
    from.mockReturnValue({ upsert });
    upsert.mockResolvedValue({ error: { message: "permission denied for table app_config" } });
    const { publishPolicies } = await import("../services/policies");
    await expect(publishPolicies({ terms: "X", privacy: "Y", refunds: "Z", shipping: "W" }))
      .rejects.toThrow(/permission denied/);
  });
});
