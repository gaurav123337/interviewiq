/* safeFetch — SSRF-safe outbound fetching for edge functions (docs/app-security.md G1).
   Two layers:
     1. checkUrl / isBlockedHost / isPrivateIpv4 / isPrivateIpv6 — PURE helpers
        (no Deno globals) so the must-block corpus runs in the app's vitest suite.
     2. safeFetch + readBodyText — Deno-only wrappers: validate → resolve DNS and
        verify EVERY returned address is public → fetch with manual redirects,
        re-validating each hop → timeout + body-size caps.
   Fail-closed: any check that errors or fails throws SafeFetchError BEFORE any
   byte is fetched; a resolver error is treated as blocked (never "proceed").

   Residual risk (documented): a DNS-rebinding attacker could serve a public IP
   at resolve time and swap to a private one at connect time. Deno's fetch has
   no address pinning, so this is mitigated (not eliminated) by rejecting
   IP-literal hosts, private/loopback/metadata ranges, and the deny-list. For
   jobs-fetch, the ATS providers additionally allow-list exact hosts. */

export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

/* Minimal ambient type for the Deno API surface used below, so this file
   typechecks both in the app's tsc program (src imports it for the vitest
   corpus) and under the Deno runtime. Type-only — erased at build time. */
declare const Deno: {
  resolveDns(hostname: string, recordType: "A" | "AAAA"): Promise<string[]>;
};

/* ------------------------------------------------------------------ */
/* Pure helpers — unit-testable anywhere (no Deno at import time)      */
/* ------------------------------------------------------------------ */

/** Strip brackets/port, lowercase, drop the trailing dot. */
export function normalizeHost(host: string): string {
  let h = (host ?? "").trim().toLowerCase();
  if (h.startsWith("[")) h = h.slice(1);
  const endBracket = h.indexOf("]");
  if (endBracket !== -1) h = h.slice(0, endBracket);
  const colon = h.lastIndexOf(":");
  if (colon !== -1 && h.indexOf(":") === colon) h = h.slice(0, colon); // host:port
  return h.replace(/\.$/, "");
}

export function isIpv4Literal(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

export function parseIpv4(host: string): number[] | null {
  if (!isIpv4Literal(host)) return null;
  return host.split(".").map(Number);
}

/** Private / reserved / link-local / metadata / documentation IPv4 ranges. */
export function isPrivateIpv4(a: number, b: number, c: number, d: number): boolean {
  void d;
  if (a === 0) return true;                        // 0.0.0.0/8
  if (a === 10) return true;                       // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true;                      // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;         // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0) return true;           // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET
  if (a === 192 && b === 168) return true;         // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true;  // 198.51.100.0/24 TEST-NET
  if (a === 203 && b === 0 && c === 113) return true;   // 203.0.113.0/24 TEST-NET
  if (a >= 224) return true;                       // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false;
}

/** Extract an embedded IPv4 from an IPv6-mapped address (::ffff:a.b.c.d). */
function mappedIpv4(host: string): number[] | null {
  const m = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return m ? parseIpv4(m[1]) : null;
}

/** Private / loopback / ULA / link-local / multicast / unspecified IPv6. */
export function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = mappedIpv4(h);
  if (mapped) return isPrivateIpv4(mapped[0], mapped[1], mapped[2], mapped[3]);
  if (h === "::" || h === "::1") return true;      // unspecified / loopback
  if (/^fc[0-9a-f]|^fd[0-9a-f]/.test(h)) return true; // fc00::/7 ULA
  if (h.startsWith("fe80") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true; // fe80::/10 link-local
  if (h.startsWith("ff")) return true;             // ff00::/8 multicast
  if (h.startsWith("2001:db8")) return true;       // documentation range
  return false;
}

export function isIpLiteral(host: string): boolean {
  return isIpv4Literal(host) || host.includes(":");
}

const BLOCKED_HOST_NAMES = new Set([
  "localhost", "localhost.localdomain", "local", "broadcasthost",
  "ip6-localhost", "ip6-loopback", "metadata", "metadata.google.internal"
]);

/** Reject hosts that are IP literals, local, private, or known metadata. */
export function isBlockedHost(host: string): { ok: true } | { ok: false; reason: string } {
  const h = normalizeHost(host);
  if (!h) return { ok: false, reason: "empty host" };
  if (isIpLiteral(h)) return { ok: false, reason: `IP-literal host rejected (${h})` };
  if (BLOCKED_HOST_NAMES.has(h)) return { ok: false, reason: `blocked host name (${h})` };
  if (h.endsWith(".local") || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".home.arpa")) {
    return { ok: false, reason: `blocked host suffix (${h})` };
  }
  return { ok: true };
}

export interface CheckUrlOptions {
  /** Allow http: (default false — https only). */
  allowHttp?: boolean;
}

export type CheckUrlResult = { ok: true; url: URL; host: string } | { ok: false; reason: string };

/** Full URL-level validation: scheme, credentials, host rules. */
export function checkUrl(rawUrl: string, opts: CheckUrlOptions = {}): CheckUrlResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "malformed URL" };
  }
  if (url.protocol === "http:" && !opts.allowHttp) return { ok: false, reason: "http is not allowed — use https" };
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: `scheme not allowed (${url.protocol})` };
  if (url.username || url.password) return { ok: false, reason: "credentials in URL are not allowed" };
  const host = normalizeHost(url.hostname);
  const blocked = isBlockedHost(host);
  if (!blocked.ok) return blocked;
  return { ok: true, url, host };
}

/* ------------------------------------------------------------------ */
/* Deno-only wrappers                                                  */
/* ------------------------------------------------------------------ */

export interface SafeFetchOptions extends CheckUrlOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  headers?: HeadersInit;
}

/** Resolve the host and reject if ANY address is private/blocked. */
async function assertPublicHost(host: string): Promise<void> {
  if (isIpLiteral(host)) throw new SafeFetchError(`IP-literal host rejected (${host})`);
  const ipv4 = await Deno.resolveDns(host, "A").catch(() => [] as string[]);
  const ipv6 = await Deno.resolveDns(host, "AAAA").catch(() => [] as string[]);
  const ips = [...ipv4, ...ipv6];
  if (!ips.length) throw new SafeFetchError(`host ${host} did not resolve — refusing to fetch`);
  for (const ip of ips) {
    const clean = normalizeHost(ip);
    if (isIpv4Literal(clean)) {
      const p = parseIpv4(clean)!;
      if (isPrivateIpv4(p[0], p[1], p[2], p[3])) {
        throw new SafeFetchError(`host ${host} resolves to blocked address ${clean}`);
      }
    } else if (isPrivateIpv6(clean)) {
      throw new SafeFetchError(`host ${host} resolves to blocked address ${clean}`);
    }
  }
}

/** SSRF-safe fetch: validate + resolve + verify each redirect hop. */
export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    let current = rawUrl;
    let redirects = 0;
    for (;;) {
      const chk = checkUrl(current, opts);
      if (!chk.ok) throw new SafeFetchError(chk.reason);
      await assertPublicHost(chk.host);
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: opts.headers
      });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) return res;
        if (++redirects > (opts.maxRedirects ?? 3)) throw new SafeFetchError("too many redirects");
        current = new URL(loc, current).toString();
        continue;
      }
      return res;
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Read a response body with a hard size cap (aborts oversized payloads). */
export async function readBodyText(res: Response, maxBytes = 2_000_000): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new SafeFetchError(`response exceeds ${maxBytes} byte limit`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return new TextDecoder().decode(out);
}
