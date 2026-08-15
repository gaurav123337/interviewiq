/* Reputation provider corpus (docs/resource-safety-guard.md L2) — Safe
   Browsing + URLhaus request building, response parsing and the combined
   checker wiring, with an injected fake fetch. Fail-closed: transport errors
   throw (the resourceGuard turns them into "pending", never "approved"). */

import { describe, it, expect, vi } from "vitest";
import {
  checkSafeBrowsing,
  checkUrlhaus,
  makeReputationChecker,
  safeBrowsingMatched,
  safeBrowsingPayload
} from "../../supabase/functions/_shared/reputation";

function fakeFetch(status: number, body: unknown, opts: { throws?: Error } = {}) {
  return vi.fn(async () => {
    if (opts.throws) throw opts.throws;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body
    } as unknown as Response;
  });
}

/* ------------------------------------------------------------------ */
/* Safe Browsing                                                       */
/* ------------------------------------------------------------------ */

describe("safe Browsing payload + matching", () => {
  it("builds a v4 threatMatches body with the standard threat types", () => {
    const p = safeBrowsingPayload("https://react.dev/learn") as {
      threatInfo: { threatEntries: { url: string }[]; platformTypes: string[]; threatTypes: string[] };
    };
    expect(p.threatInfo.threatEntries[0].url).toBe("https://react.dev/learn");
    expect(p.threatInfo.platformTypes).toEqual(["ANY_PLATFORM"]);
    expect(p.threatInfo.threatTypes).toContain("MALWARE");
  });

  it("detects a match", () => {
    expect(safeBrowsingMatched({ matches: [{ threatType: "MALWARE" }] })).toBe(true);
    expect(safeBrowsingMatched({})).toBe(false);
    expect(safeBrowsingMatched(null)).toBe(false);
  });

  it("returns matched=true when Google flags the url", async () => {
    const fetchImpl = fakeFetch(200, { matches: [{ threatType: "SOCIAL_ENGINEERING" }] });
    const r = await checkSafeBrowsing("https://phish.example/x", "key", fetchImpl);
    expect(r.matched).toBe(true);
    expect(r.source).toBe("safe-browsing");
  });

  it("returns matched=false on a clean response", async () => {
    const fetchImpl = fakeFetch(200, {});
    const r = await checkSafeBrowsing("https://react.dev/learn", "key", fetchImpl);
    expect(r.matched).toBe(false);
  });

  it("throws on HTTP errors (fail-closed → pending)", async () => {
    await expect(checkSafeBrowsing("https://x.dev", "bad-key", fakeFetch(403, {}))).rejects.toThrow(/HTTP 403/);
  });
});

/* ------------------------------------------------------------------ */
/* URLhaus                                                             */
/* ------------------------------------------------------------------ */

describe("URLhaus host lookup", () => {
  it("returns tagged when query_status is 1", async () => {
    const fetchImpl = fakeFetch(200, { query_status: "1", host: "evil.example" });
    const r = await checkUrlhaus("evil.example", fetchImpl);
    expect(r.tagged).toBe(true);
  });

  it("returns clean when query_status is 0", async () => {
    const fetchImpl = fakeFetch(200, { query_status: "0", host: "react.dev" });
    const r = await checkUrlhaus("react.dev", fetchImpl);
    expect(r.tagged).toBe(false);
  });

  it("throws on unknown status (fail-closed)", async () => {
    const fetchImpl = fakeFetch(200, { query_status: "2" });
    await expect(checkUrlhaus("bad.example", fetchImpl)).rejects.toThrow(/unknown status/);
  });

  it("throws on transport errors", async () => {
    const fetchImpl = fakeFetch(0, null, { throws: new Error("down") });
    await expect(checkUrlhaus("x.example", fetchImpl)).rejects.toThrow("down");
  });
});

/* ------------------------------------------------------------------ */
/* Combined checker                                                    */
/* ------------------------------------------------------------------ */

const ENV = (key: string | undefined) => ({ get: (k: string) => (k === "SAFE_BROWSING_API_KEY" ? key : undefined) });

describe("makeReputationChecker wiring", () => {
  it("blocks when Safe Browsing flags the url", async () => {
    const checker = makeReputationChecker(ENV("key"), fakeFetch(200, { matches: [{ threatType: "MALWARE" }] }));
    const r = await checker("https://phish.example/x");
    expect(r.safe).toBe(false);
    expect(r.source).toBe("safe-browsing");
  });

  it("approves when both providers are clean", async () => {
    const fetchImpl = fakeFetch(200, {});
    /* Safe Browsing → clean; URLhaus → clean */
    fetchImpl.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ query_status: "0" }) }) as unknown as Response);
    const checker = makeReputationChecker(ENV("key"), fetchImpl);
    const r = await checker("https://react.dev/learn");
    expect(r.safe).toBe(true);
    expect(r.source).toContain("safe-browsing");
    expect(r.source).toContain("urlhaus");
  });

  it("blocks when URLhaus tags the host even if Safe Browsing is clean", async () => {
    const fetchImpl = fakeFetch(200, {});
    let call = 0;
    fetchImpl.mockImplementation(async () => {
      call++;
      return {
        ok: true, status: 200,
        json: async () => (call === 1 ? {} : { query_status: "1" })
      } as unknown as Response;
    });
    const checker = makeReputationChecker(ENV("key"), fetchImpl);
    const r = await checker("https://evil.example/x");
    expect(r.safe).toBe(false);
    expect(r.source).toBe("urlhaus");
  });

  it("errors (→ pending) when NO provider is configured — never blind-approve", async () => {
    const checker = makeReputationChecker(ENV(undefined), fakeFetch(200, {}));
    const r = await checker("https://react.dev/learn");
    expect(r.safe).toBe(false);
    expect(r.error).toMatch(/no reputation provider configured/);
  });

  it("propagates transport errors (→ pending via the guard)", async () => {
    const checker = makeReputationChecker(ENV("key"), fakeFetch(0, null, { throws: new Error("safe browsing down") }));
    await expect(checker("https://react.dev/learn")).rejects.toThrow("safe browsing down");
  });
});
