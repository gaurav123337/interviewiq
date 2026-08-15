/* contentScan — the L3 content layer of the resource guard
   (docs/resource-safety-guard.md). Fetches the target page SERVER-SIDE (the
   user's IP never touches the target) and applies static heuristics:
     - credential-harvesting forms (password/OTP/card fields, foreign form
       actions, phishing-form titles)
     - hidden-text / SEO cloaking
     - obfuscated payloads (eval/document.write/fromCharCode, base64 blobs,
       meta-refresh javascript:, script srcs from IP-literal or non-https hosts)
     - prompt-injection content in the page body (the "AI reads poisoned
       content" risk — the app's AI must treat fetched content as untrusted
       data, never as instructions)
   NEVER executes anything — pure static analysis of the fetched text.

   Fail-closed: scanPage is pure; scanRemote throws on fetch/safety errors so
   the caller can treat the submission as "pending", never "approved". */

import { looksInjected } from "./resourceGuard.ts";
import { readBodyText, safeFetch, SafeFetchError } from "./safeFetch.ts";

export type Severity = "high" | "medium" | "low";

export interface ScanFinding {
  severity: Severity;
  label: string;
  evidence: string;
}

export interface ContentScanResult {
  blocked: boolean;
  findings: ScanFinding[];
  title?: string;
}

/* ------------------------------------------------------------------ */
/* Pure heuristics — unit-testable anywhere                            */
/* ------------------------------------------------------------------ */

function findHost(raw: string): string {
  try { return new URL(raw).hostname.toLowerCase(); } catch { return ""; }
}

/** Rough registrable host: last two labels (last three for .co.uk etc.). */
export function registrableHost(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const two = parts.slice(-2).join(".");
  const suffixes = ["co.uk", "com.au", "co.in", "org.uk", "ac.uk", "gov.uk", "com.br", "com.mx"];
  return suffixes.includes(two) ? parts.slice(-3).join(".") : two;
}

/** Count of characters hidden from the visitor: text inside elements whose
    style hides it (display:none, visibility:hidden, opacity:0, font-size:0,
    negative text-indent, off-screen absolute) plus aria-hidden blocks. */
export function hiddenTextVolume(html: string): number {
  let total = 0;
  /* opening tag with a hiding style → measure its text up to the matching close */
  const hiddenRe = /<([a-z][a-z0-9]*)[^>]*style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.\d+)?|font-size\s*:\s*0|text-indent\s*:\s*-\d{3,}|clip(?:-path)?\s*:|position\s*:\s*absolute[^"']*left\s*:\s*-\d{3,})[^"']*["'][^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = hiddenRe.exec(html))) {
    const inner = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    total += inner.length;
  }
  const ariaBlocks = html.match(/aria-hidden\s*=\s*["']true["'][^>]*>([\s\S]*?)<\/[a-z][a-z0-9]*\s*>/gi) ?? [];
  for (const a of ariaBlocks) total += a.replace(/<[^>]+>/g, " ").replace(/\s+/g, "").length;
  return total;
}

/** True when the page contains a credential-ish input (password/otp/card/ssn). */
export function hasCredentialInput(html: string): boolean {
  return /<(?:input|textarea)[^>]*(?:type\s*=\s*["']password["']|name\s*=\s*["'][^"']*(?:password|otp|pin|card|cvv|ssn|aadhaar|pan)[^"']*["']|id\s*=\s*["'][^"']*(?:password|otp|pin|card|cvv|ssn|aadhaar|pan)[^"']*["'])/i
    .test(html);
}

export interface FormActionInfo {
  count: number;
  foreign: boolean;
  unsafe: boolean;
  noAction: number;
}

/** Examine every <form>: where does it post? Foreign registrable host,
    non-https action, or IP-literal action are red flags. */
export function formActions(html: string, pageUrl: string): FormActionInfo {
  const pageHost = findHost(pageUrl);
  const pageReg = registrableHost(pageHost);
  const forms = html.match(/<form\b[^>]*>/gi) ?? [];
  let foreign = false;
  let unsafe = false;
  let noAction = 0;
  for (const f of forms) {
    const m = f.match(/action\s*=\s*["']([^"']*)["']/i);
    if (!m) { noAction++; continue; }
    const action = m[1];
    if (action.startsWith("javascript:") || action.startsWith("data:")) { unsafe = true; continue; }
    if (!/^https?:\/\//.test(action)) continue; /* relative action — same host */
    try {
      const u = new URL(action);
      if (u.protocol !== "https:") unsafe = true;
      if (registrableHost(u.hostname) !== pageReg) foreign = true;
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) unsafe = true;
    } catch { unsafe = true; }
  }
  return { count: forms.length, foreign, unsafe, noAction };
}

/** Obfuscation / execution-sink heuristics in script/meta content. */
export function obfuscationFindings(html: string): ScanFinding[] {
  const out: ScanFinding[] = [];
  const lower = html.toLowerCase();
  if (/\beval\s*\(/.test(lower)) out.push({ severity: "high", label: "eval() execution sink", evidence: "page contains eval() — possible obfuscated payload" });
  if (/document\.write\s*\(/.test(lower)) out.push({ severity: "medium", label: "document.write()", evidence: "dynamic document.write — possible cloaked content" });
  if (/string\.fromcharcode\s*\(/.test(lower)) out.push({ severity: "medium", label: "fromCharCode payload", evidence: "character-code obfuscation present" });
  if (/<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*url\s*=\s*["']?javascript:/i.test(html)) {
    out.push({ severity: "high", label: "meta-refresh javascript:", evidence: "auto-navigation to executable javascript: url" });
  }
  const b64 = lower.match(/[a-z0-9+/=]{200,}/g);
  if (b64 && b64.some(b => b.length > 400)) {
    out.push({ severity: "medium", label: "large base64 blob", evidence: `${b64.length} long base64 block(s) — possible encoded payload` });
  }
  return out;
}

/** Script <src> hosts that are IP-literals, private, or non-https. */
export function riskyScriptSrcs(html: string): string[] {
  const srcs = (html.match(/<script\b[^>]*src\s*=\s*["']([^"']+)["']/gi) ?? [])
    .map(s => (s.match(/src\s*=\s*["']([^"']+)["']/i) ?? [])[1])
    .filter(Boolean);
  const risky: string[] = [];
  for (const src of srcs) {
    if (src.startsWith("//") || !/^https?:\/\//.test(src)) continue;
    try {
      const u = new URL(src);
      if (u.protocol !== "https:") { risky.push(src); continue; }
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) risky.push(src);
    } catch { risky.push(src); }
  }
  return risky;
}

/** Full static scan of one page. Pure — no network, no execution. */
export function scanPage(html: string, pageUrl: string): ContentScanResult {
  const findings: ScanFinding[] = [];
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) ?? [])[1]?.trim() ?? "";

  /* 1 — credential harvesting */
  if (hasCredentialInput(html)) {
    findings.push({ severity: "medium", label: "credential input present", evidence: "password/OTP/card-style field found on the page" });
  }
  const forms = formActions(html, pageUrl);
  if (forms.count > 0) {
    if (forms.unsafe) findings.push({ severity: "high", label: "unsafe form action", evidence: "a form posts to a non-https, javascript: or IP-literal target" });
    if (forms.foreign) findings.push({ severity: "high", label: "foreign form action", evidence: "a form posts to a different registrable host — possible credential relay" });
    if (forms.noAction === forms.count && forms.count > 0) {
      findings.push({ severity: "low", label: "forms without actions", evidence: `${forms.count} form(s) with no action — behavior unclear` });
    }
  }
  const phishingTitle = /(bank|login|sign\s?in|verify|unlock|update\s+(?:your\s+)?account)/i.test(title);
  if (hasCredentialInput(html) && (forms.foreign || forms.unsafe) && phishingTitle) {
    findings.push({ severity: "high", label: "phishing-form profile", evidence: `credential field + suspicious form action + title "${title.slice(0, 60)}"` });
  }

  /* 2 — hidden text / cloaking */
  const hidden = hiddenTextVolume(html);
  if (hidden > 800) findings.push({ severity: "medium", label: "large volume of hidden text", evidence: `~${hidden} chars hidden via css/aria — possible cloaking` });

  /* 3 — obfuscated payloads */
  findings.push(...obfuscationFindings(html));
  const riskySrcs = riskyScriptSrcs(html);
  if (riskySrcs.length) {
    findings.push({ severity: "high", label: "risky script source", evidence: riskySrcs[0].slice(0, 120) });
  }

  /* 4 — prompt-injection content (the app's AI must treat this as untrusted) */
  const textish = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 6000);
  const inj = looksInjected(textish);
  if (inj.injected) {
    findings.push({ severity: "medium", label: "prompt-injection content", evidence: inj.reason ?? "injection heuristic fired" });
  }

  return {
    blocked: findings.some(f => f.severity === "high"),
    findings,
    title: title || undefined
  };
}

/* ------------------------------------------------------------------ */
/* Network wrapper — server-side fetch + scan, fail-closed             */
/* ------------------------------------------------------------------ */

export interface ScanOptions {
  timeoutMs?: number;
  maxBytes?: number;
  /** Injectable fetch for tests; defaults to SSRF-safe safeFetch. */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

/** Fetch the page through the SSRF-safe path and scan it. Throws on any
    fetch/safety error — the caller converts that into "pending". */
export async function scanRemote(url: string, opts: ScanOptions = {}): Promise<ContentScanResult> {
  const fetchImpl = opts.fetchImpl ?? ((u: string, init?: RequestInit) =>
    safeFetch(u, { ...(init ?? {}), timeoutMs: opts.timeoutMs ?? 12_000 }));
  const res = await fetchImpl(url, {
    redirect: "manual",
    headers: {
      "user-agent": "InterviewIQ-ContentScan/1.0 (+contact: admin)",
      accept: "text/html,application/xhtml+xml,*/*;q=0.8"
    }
  });
  if (res.status >= 400) {
    throw new Error(`page returned HTTP ${res.status} — cannot scan`);
  }
  const html = await readBodyText(res, opts.maxBytes ?? 1_500_000).catch((e: unknown) => {
    throw e instanceof SafeFetchError ? e : new Error("page body too large to scan");
  });
  return scanPage(html, url);
}
