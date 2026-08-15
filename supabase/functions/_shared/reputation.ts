/* reputation — L2 reputation layer for the resource guard (docs/resource-safety-guard.md).
   Two providers:
     - Google Safe Browsing Lookup API v4 (threatMatches:find) — needs the
       SAFE_BROWSING_API_KEY function secret; free quota.
     - URLhaus (abuse.ch) — keyless public API; checks the host reputation.
   Fail-closed: transport errors THROW — the caller (resourceGuard) converts
   any throw into "pending" (human review), never "approved".

   Pure request/response helpers are injectable-fetch so the vitest + Deno
   suites exercise them without network. */

export interface ReputationResult {
  safe: boolean;
  source: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Safe Browsing — Google Lookup API                                   */
/* ------------------------------------------------------------------ */

export const SB_THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION"
] as const;

/** Build the v4 threatMatches:find request body for one URL. */
export function safeBrowsingPayload(url: string, threatTypes: readonly string[] = SB_THREAT_TYPES): unknown {
  return {
    client: { clientId: "interviewiq", clientVersion: "1.0" },
    threatInfo: {
      threatTypes: [...threatTypes],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: [{ url }]
    }
  };
}

/** True when the response contains a threat match (any type). */
export function safeBrowsingMatched(json: unknown): boolean {
  const matches = (json as { matches?: unknown[] } | null)?.matches;
  return Array.isArray(matches) && matches.length > 0;
}

/** Call Safe Browsing. Throws on transport/HTTP errors (fail-closed → pending). */
export async function checkSafeBrowsing(
  url: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ matched: boolean; source: string }> {
  const res = await fetchImpl(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(safeBrowsingPayload(url))
    }
  );
  if (!res.ok) throw new Error(`safe browsing HTTP ${res.status}`);
  const json = await res.json().catch(() => null);
  return { matched: safeBrowsingMatched(json), source: "safe-browsing" };
}

/* ------------------------------------------------------------------ */
/* URLhaus — keyless host reputation                                   */
/* ------------------------------------------------------------------ */

export interface UrlhausLookup {
  query_status: string; /* "0" = not tagged, "1" = tagged, "2" = invalid host */
  host?: string;
  url_count?: number;
  blacklists?: Record<string, string>;
}

/** Call URLhaus /v1/host/. Throws on transport errors or unknown status
    (fail-closed → pending). */
export async function checkUrlhaus(
  host: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ tagged: boolean; source: string }> {
  const res = await fetchImpl("https://urlhaus-api.abuse.ch/v1/host/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ host }).toString()
  });
  if (!res.ok) throw new Error(`urlhaus HTTP ${res.status}`);
  const json = (await res.json().catch(() => null)) as UrlhausLookup | null;
  if (!json) throw new Error("urlhaus returned no parseable response");
  if (json.query_status === "1") return { tagged: true, source: "urlhaus" };
  if (json.query_status === "0") return { tagged: false, source: "urlhaus" };
  throw new Error(`urlhaus unknown status (${json.query_status})`);
}

/* ------------------------------------------------------------------ */
/* Combined checker — wired into resourceGuard.checkReputation         */
/* ------------------------------------------------------------------ */

export interface EnvLike {
  get(key: string): string | undefined;
}

/** Build the checkReputation callback for resourceGuard.
    Safe Browsing runs when SAFE_BROWSING_API_KEY is set (authoritative);
    URLhaus always runs (keyless). Any provider error → error (→ pending).
    If NOTHING is configured, the callback errors — the submission stays
    "pending" rather than being approved on reputation-blind trust. */
export function makeReputationChecker(
  env: EnvLike,
  fetchImpl: typeof fetch = fetch
): (url: string) => Promise<ReputationResult> {
  return async (url: string): Promise<ReputationResult> => {
    const key = env.get("SAFE_BROWSING_API_KEY");
    if (!key) {
      return { safe: false, source: "none", error: "no reputation provider configured (SAFE_BROWSING_API_KEY missing)" };
    }
    const sb = await checkSafeBrowsing(url, key, fetchImpl);
    if (sb.matched) return { safe: false, source: sb.source };
    const host = new URL(url).hostname;
    const uh = await checkUrlhaus(host, fetchImpl);
    if (uh.tagged) return { safe: false, source: uh.source };
    return { safe: true, source: "safe-browsing+urlhaus" };
  };
}
