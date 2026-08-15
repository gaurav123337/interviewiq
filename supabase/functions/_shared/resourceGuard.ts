/* resourceGuard — layered safety guard for user-submitted resources
   (docs/resource-safety-guard.md, docs/app-security.md §7).

     L0 intake   — plain-text hygiene + prompt-injection heuristics
     L1 hygiene  — link rules: https-only, no credentials, no confusable hosts
     L2 core     — resolve the redirect chain, re-check the FINAL url, run an
                   injected reputation callback (Safe Browsing / URLhaus), and
                   classify the verdict.

   Fail-closed by design: any check that errors, times out, or can't complete
   → status "pending" (human review required), NEVER "approved". Rule
   violations (SSRF, bad scheme, known-malicious reputation) → "blocked".

   The pure helpers (L0/L1) run anywhere — the app's vitest corpus exercises
   them. The network layer is Deno-only (safeFetch) but injectable, so the
   verdict flow is unit-testable with a fake fetch in vitest too. */

import { checkUrl, safeFetch, SafeFetchError } from "./safeFetch.ts";

export type GuardVerdict =
  | { status: "ok"; reasons: string[]; finalUrl: string }
  | { status: "suspect"; reasons: string[]; finalUrl?: string }
  | { status: "blocked"; reasons: string[]; finalUrl?: string }
  | { status: "pending"; reasons: string[]; finalUrl?: string };

/* ------------------------------------------------------------------ */
/* L0 — text hygiene + prompt-injection heuristics                     */
/* ------------------------------------------------------------------ */

/** Strip control chars (C0/C1 except \n \t \r), zero-width and bidi
    overrides — the "single line" hygiene gate for every text field. */
export function cleanText(input: string): string {
  return (input ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")   // control chars
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")                               // zero-width
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "");                            // bidi embedding/override
}

/** Case-insensitive prompt-injection heuristics — the instruction-override
    family. Returns { injected, reason }. Best-effort: this is a tripwire, the
    human gate (L4) catches what heuristics can't. */
export function looksInjected(text: string): { injected: boolean; reason?: string } {
  const t = (text ?? "").toLowerCase();
  const patterns: { re: RegExp; reason: string }[] = [
    { re: /ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/, reason: "instruction-override ('ignore previous instructions')" },
    { re: /disregard\s+(all\s+|the\s+)?(above|previous|prior)/, reason: "instruction-override ('disregard above')" },
    { re: /you\s+are\s+now\s+(?:an?|a\s+free)\s+\w{1,40}\s+(?:with\s+no\s+(?:rules|limits|restrictions))/, reason: "role-jailbreak ('you are now X with no rules')" },
    { re: /(?:reveal|show|output|print)\s+(?:your\s+)?(?:system\s+)?prompt/, reason: "prompt extraction ('reveal your prompt')" },
    { re: /(?:new|updated)\s+(?:system|developer)\s+(?:prompt|instructions?)\s*:/, reason: "prompt-injection declaration" },
    { re: /act\s+as\s+if\s+you\s+(?:have|are)\s+no\s+(?:rules|restrictions|guidelines)/, reason: "jailbreak framing" },
    { re: /jailbreak|d\s?e\s?v\s?m\s?o\s?d\s?e/i, reason: "jailbreak term" },
    { re: /\b(everything|all)\s+(above|before|prior|previous)\s+is\s+(false|a\s+test|ignored)\b/, reason: "context-erasure framing" }
  ];
  for (const p of patterns) {
    if (p.re.test(t)) return { injected: true, reason: p.reason };
  }
  return { injected: false };
}

/** Length + shape cap for submitted text (titles, descriptions, lines). */
export function textWithinLimits(text: string, maxLen = 500): boolean {
  return typeof text === "string" && text.trim().length > 0 && text.trim().length <= maxLen;
}

/* ------------------------------------------------------------------ */
/* L1 — link hygiene                                                   */
/* ------------------------------------------------------------------ */

const MAX_URL_LENGTH = 2048;

/** Code points that visually resemble ASCII letters but are NOT them —
    homoglyph/confusable-host detection (e.g. react.dév vs react.dev). */
const CONFUSABLE_RE = /[\u00C0-\u00FF\u0100-\u017F\u0180-\u024F\u0250-\u02AF\u0370-\u03FF\u0400-\u04FF\u1E00-\u1EFF\u2070-\u209F\u2150-\u218F\u2200-\u22FF\u2460-\u24FF\uFB00-\uFB4F\uFF00-\uFFEF]/;

export interface GuardLinkResult {
  ok: boolean;
  url?: URL;
  host?: string;
  reason?: string;
}

/** The raw authority (host[:port]) as typed — BEFORE URL normalization, so
    punycode can't hide homoglyph/confusable characters (react.dév vs react.dev). */
export function rawAuthority(rawUrl: string): string {
  return (rawUrl ?? "").replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "").split(/[/?#]/)[0].toLowerCase();
}

/** Full L1 gate: scheme (https-only), no credentials, no IP-literal/private
    hosts (via checkUrl), confusable-host check (on the RAW host, pre-punycode),
    sane length. */
export function guardLink(rawUrl: string): GuardLinkResult {
  if (!rawUrl || typeof rawUrl !== "string") return { ok: false, reason: "empty url" };
  if (rawUrl.length > MAX_URL_LENGTH) return { ok: false, reason: `url exceeds ${MAX_URL_LENGTH} chars` };
  const chk = checkUrl(rawUrl);
  if (!chk.ok) return { ok: false, reason: chk.reason };
  const host = chk.url.hostname.toLowerCase();
  /* confusable/homoglyph characters in the host as typed — before the URL
     parser punycodes it (react.dév → xn--dv-8ea, which scans as clean ASCII) */
  if (CONFUSABLE_RE.test(rawAuthority(rawUrl))) {
    return { ok: false, reason: `host contains confusable characters (${rawAuthority(rawUrl)}) — possible lookalike domain` };
  }
  return { ok: true, url: chk.url, host };
}

/* ------------------------------------------------------------------ */
/* L2 — redirect-chain resolution + reputation (network layer)         */
/* ------------------------------------------------------------------ */

export interface GuardOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  userAgent?: string;
  /** Reputation check (Safe Browsing, URLhaus…). Errors → pending. */
  checkReputation?: (url: string) => Promise<{ safe: boolean; source: string; error?: string }>;
  /** Injectable fetch for tests; defaults to SSRF-safe safeFetch. */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

const DEFAULT_UA = "InterviewIQ-ResourceGuard/1.0 (+contact: admin)";

function isOkStatus(status: number): boolean {
  return status >= 200 && status < 400;
}

/** Run the L2-core guard on a raw url. Fail-closed → verdict. */
export async function guardResource(rawUrl: string, opts: GuardOptions = {}): Promise<GuardVerdict> {
  const reasons: string[] = [];

  /* L1 before any network I/O */
  const link = guardLink(rawUrl);
  if (!link.ok || !link.url) {
    return { status: "blocked", reasons: [link.reason ?? "link hygiene failed"] };
  }
  reasons.push(`scheme+host ok (${link.host})`);

  const fetchImpl = opts.fetchImpl ?? ((url: string, init?: RequestInit) =>
    safeFetch(url, { ...(init ?? {}), timeoutMs: opts.timeoutMs ?? 10_000, maxRedirects: opts.maxRedirects ?? 3 }));

  /* Resolve the redirect chain and re-check the FINAL url (a shortener
     pointing at malware is caught at the destination) */
  let finalUrl: string | undefined;
  try {
    const res = await fetchImpl(link.url.toString(), {
      redirect: "manual",
      headers: { "user-agent": opts.userAgent ?? DEFAULT_UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8" }
    });
    finalUrl = res.url && res.url !== link.url.toString() ? res.url : link.url.toString();
    if (finalUrl && finalUrl !== link.url.toString()) {
      const fin = guardLink(finalUrl);
      if (!fin.ok) return { status: "blocked", reasons: [...reasons, `final url failed hygiene: ${fin.reason}`], finalUrl };
      reasons.push(`redirect chain resolves to a vetted host (${fin.host})`);
    }
    if (!isOkStatus(res.status)) {
      return { status: "suspect", reasons: [...reasons, `destination returned HTTP ${res.status}`], finalUrl };
    }
    reasons.push(`destination reachable (HTTP ${res.status})`);
  } catch (e) {
    /* rule violation → blocked; anything else (timeout, DNS wobble) → pending */
    if (e instanceof SafeFetchError) {
      return { status: "blocked", reasons: [...reasons, e.message], finalUrl };
    }
    return { status: "pending", reasons: [...reasons, `fetch could not complete: ${(e as Error).message}`], finalUrl };
  }

  /* L2 reputation — injectable (Safe Browsing / URLhaus in production).
     Errors or no-answer → pending, never approved. */
  if (opts.checkReputation) {
    let rep: { safe: boolean; source: string; error?: string };
    try {
      rep = await opts.checkReputation(finalUrl);
    } catch (e) {
      return { status: "pending", reasons: [...reasons, `reputation check errored: ${(e as Error).message}`], finalUrl };
    }
    if (rep.error) {
      return { status: "pending", reasons: [...reasons, `reputation check unavailable: ${rep.error}`], finalUrl };
    }
    if (!rep.safe) {
      return { status: "blocked", reasons: [...reasons, `flagged by ${rep.source}`], finalUrl };
    }
    reasons.push(`reputation clear (${rep.source})`);
  }

  return { status: "ok", reasons, finalUrl: finalUrl ?? link.url.toString() };
}
