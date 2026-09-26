#!/usr/bin/env node
/* apply-engine-lib — PURE logic for the local auto-apply engine (no Playwright
 * I/O): per-site rules, form-question classification, honest answer drafting,
 * fuzzy option matching, and run-report builders. The browser-driving script
 * (auto-apply-jobs.mjs) imports these; unit tests pin the pure behavior.
 *
 * Safety model baked in here:
 *  - auto-submit is a PER-SITE rule (LinkedIn never auto-submits — review gate)
 *  - any required question the engine cannot answer confidently marks the
 *    application needs-review and BLOCKS submission (fail-closed), even on
 *    auto-submit sites. A wrong submission is worse than a skipped one.
 */

/* ─────────────────────────── site rules ─────────────────────────── */

export const SITE_RULES = {
  linkedin: {
    label: "LinkedIn",
    jobsUrlHosts: ["linkedin.com"],
    loginPathHints: ["authwall", "/login", "checkpoint"],
    loggedInHint: "/feed",
    applyButtonText: /easy\s*apply/i,
    steps: ["contact", "resume", "questions", "review"],
    autoSubmit: false, // owner decision: LinkedIn accounts are precious — review gate
    successText: /application\s+sent|your application was sent/i,
    listSelectorHints: ["a[href*='/jobs/view/']", ".jobs-search-results__list-item", ".job-card-container"],
    minIntervalMs: 4000, // LinkedIn rate-limits hard; keep it slow
  },
  naukri: {
    label: "Naukri",
    jobsUrlHosts: ["naukri.com"],
    loginPathHints: ["/login", "nj.login", "register"],
    loggedInHint: "/mnjuser/",
    applyButtonText: /^apply$/i,
    steps: ["apply"],
    autoSubmit: true,
    successText: /applied|application (has been )?submitted/i,
    listSelectorHints: ["a[href*='job-detail']", "a[href*='joblisting']", "a.job-title-href", ".job-tittle a"],
    minIntervalMs: 2500,
  },
  instahyre: {
    label: "Instahyre",
    jobsUrlHosts: ["instahyre.com"],
    loginPathHints: ["/accounts/login"],
    loggedInHint: "/candidate/opportunities",
    applyButtonText: /apply|interested/i,
    steps: ["apply"],
    autoSubmit: true,
    successText: /applied|application sent|we'll be in touch/i,
    listSelectorHints: ["a[href*='/candidate/opportunities/']", ".opportunity a", ".job-card a"],
    minIntervalMs: 2500,
  },
  generic: {
    label: "Generic",
    jobsUrlHosts: [],
    loginPathHints: [],
    loggedInHint: "",
    applyButtonText: /^apply( now)?$/i,
    steps: ["apply"],
    autoSubmit: false, // unknown ATS — never auto-submit
    successText: /application (was|has been) (sent|submitted)|thanks for applying/i,
    listSelectorHints: ["a[href*='job']", "a[href*='career']", "a[href*='position']"],
    minIntervalMs: 1500,
  },
};

/** Which site rules apply for a jobs-list URL? Falls back to `generic`. */
export function siteFromUrl(url) {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* handled below */ }
  for (const [key, rules] of Object.entries(SITE_RULES)) {
    if (rules.jobsUrlHosts.some(h => host === h || host.endsWith("." + h))) return key;
  }
  return "generic";
}

/* ─────────────────── form-question intelligence ─────────────────── */

/**
 * Classifies an application-form question from its label (+ input kind).
 * `kind` drives draftAnswer; `confidence: "review"` means the engine refuses
 * to guess (fail-closed) — the caller leaves it blank and flags the job.
 */
export function classifyQuestion(label, { tag = "", required = false } = {}) {
  const t = String(label || "").toLowerCase();
  const isTextarea = tag === "textarea";
  const has = (re) => re.test(t);

  if (has(/\bemail\b/)) return { kind: "email", confidence: "answer" };
  if (has(/phone|mobile|contact number/)) return { kind: "phone", confidence: "answer" };
  if (has(/years.*experience|experience.*years|total experience/)) return { kind: "years", confidence: "answer" };
  if (has(/notice period|availability|available (from|to start)|earliest (start|join)|can you start/)) return { kind: "notice", confidence: "answer" };
  if (has(/expected (ctc|salary|compensation)|current (ctc|salary)|salary expectation|compensation expectation/)) return { kind: "salary", confidence: "answer" };
  if (has(/relocat/)) return { kind: "relocation", confidence: "answer" };
  if (has(/remote|work from home|hybrid/)) return { kind: "remote", confidence: "answer" };
  if (has(/current location|city|where are you based|are you (based|located)/)) return { kind: "location", confidence: "answer" };
  if (has(/sponsorship|work authorization|work permit|visa status|authorized to work/)) return { kind: "workAuth", confidence: required ? "review" : "answer" };
  if (has(/certification|license|licensure/)) return { kind: "certificate", confidence: required ? "review" : "answer" };
  if (isTextarea && has(/cover letter|why (do you want|should we|are you|this (company|role))|message to|additional information|anything else|summary/)) return { kind: "coverLetter", confidence: "answer" };
  if (isTextarea) return { kind: "longText", confidence: required ? "review" : "answer" };
  if (has(/linkedin|portfolio|website|github|url/)) return { kind: "link", confidence: "answer" };
  if (has(/^first name|given name/)) return { kind: "firstName", confidence: "answer" };
  if (has(/^last name|surname|family name/)) return { kind: "lastName", confidence: "answer" };
  if (has(/full name|^name$/)) return { kind: "fullName", confidence: "answer" };
  if (has(/how did you hear|referral source|source of job/)) return { kind: "source", confidence: "answer" };
  if (has(/reason for (leaving|change)|why (are you )?leaving/)) return { kind: "reasonLeaving", confidence: required ? "review" : "answer" };
  return { kind: "unknown", confidence: required ? "review" : "answer" };
}

/**
 * Drafts an honest answer for a classified question. Returns "" (leave blank)
 * when the profile has no data — the caller decides whether that blocks
 * submission (required fields do). NEVER invents facts.
 */
export function draftAnswer(kind, profile, job) {
  const p = profile || {};
  switch (kind) {
    case "email": return p.email ?? "";
    case "phone": return p.phone ?? "";
    case "years": return p.years != null ? String(p.years) : "";
    case "firstName": return (p.name || "").trim().split(/\s+/)[0] ?? "";
    case "lastName": { const parts = (p.name || "").trim().split(/\s+/); return parts.length > 1 ? parts[parts.length - 1] : ""; }
    case "fullName": return p.name ?? "";
    case "location": return p.locations?.[0] ?? job?.location ?? "";
    case "notice": return p.noticePeriod ?? "";
    case "salary": return p.salaryExpectation ?? "";
    case "relocation": return p.openToRelocate == null ? "" : (p.openToRelocate ? "Yes" : "No");
    case "remote": return p.openToRemote == null ? "" : (p.openToRemote ? "Yes" : "No");
    case "link": return p.portfolio ?? p.linkedin ?? "";
    case "source": return "Job board search";
    case "reasonLeaving": return p.reasonLeaving ?? "";
    case "coverLetter": return job?.__coverLetter ?? ""; // the AI-tailored letter, injected by the engine
    case "longText": return job?.__coverLetter ?? ""; // a textarea gets the letter, never a guess
    default: return ""; // unknown / workAuth / certificate → never guessed
  }
}

/** Fuzzy "does this dropdown option match my drafted answer?" — exact after
    normalization, containment either way, or numeric equality (3 ≈ "3 years"). */
export function valueMatchesList(answer, optionText) {
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9. ]+/g, " ").replace(/\s+/g, " ").trim();
  const a = norm(answer), b = norm(optionText);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.includes(a) || a.includes(b)) return true;
  const na = parseFloat(a), nb = parseFloat(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && norm(a).length <= 4 && norm(b).length <= 12) return na === nb;
  const ta = new Set(a.split(" ")), tb = new Set(b.split(" "));
  if (ta.size && tb.size) {
    const hit = [...ta].filter(w => w.length > 2 && tb.has(w)).length;
    if (hit / ta.size >= 0.8) return true;
  }
  return false;
}

/* ─────────────────────────── run reports ─────────────────────────── */

export function newReport(sourceUrl, site) {
  return { sourceUrl, site, startedAt: Date.now(), results: [], counts: { submitted: 0, needsReview: 0, skipped: 0, error: 0 } };
}

export function recordResult(report, job, result, detail = "") {
  report.results.push({ title: job?.title ?? "?", company: job?.company ?? "?", url: job?.url ?? "", result, detail, at: Date.now() });
  const key = { submitted: "submitted", needsReview: "needsReview", skipped: "skipped", error: "error" }[result];
  if (key) report.counts[key] += 1;
}

const ANSI = { green: (s) => `\x1b[32m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m` };

/** One-line console summary — the selector-drift-alarm spirit: a run where
    nothing was submitted AND nothing needs review is suspicious. */
export function reportLine(report) {
  const c = report.counts;
  const line = `submitted ${c.submitted} · review ${c.needsReview} · skipped ${c.skipped} · errors ${c.error}`;
  if (c.submitted === 0 && c.needsReview === 0) return ANSI.red(`SUSPICIOUS RUN — ${line} (check selectors/login; see report)`);
  return `${ANSI.green("DONE")} — ${line}`;
}

/** Markdown report body (written next to the JSON report). */
export function buildReportMarkdown(report) {
  const mins = ((Date.now() - report.startedAt) / 60000).toFixed(1);
  const rows = report.results.map(r =>
    `| ${r.result} | ${r.company} | ${r.title} | ${r.detail.replace(/\|/g, "/")} |`).join("\n");
  return [
    `# Auto-apply run — ${new Date(report.startedAt).toISOString()}`,
    "",
    `- Source: ${report.sourceUrl} (${report.site})`,
    `- Took: ${mins} min — ${reportLine(report).replace(/\x1b\[[0-9;]*m/g, "")}`,
    "",
    "| Result | Company | Role | Detail |",
    "|---|---|---|---|",
    rows || "| (none) | | | |",
    "",
  ].join("\n");
}

/** jobs_fetch_reports row (source 'apply-engine') so the admin Cron/scraper
    log shows apply runs alongside the other pipelines. Pure row builder. */
export function buildApplyReportSql(report, { totalSeen }) {
  const c = report.counts;
  const ok = c.error < Math.max(1, report.results.length);
  const message = `apply-engine ${report.site}: submitted ${c.submitted}, review ${c.needsReview}, skipped ${c.skipped}, errors ${c.error}`;
  const esc = (s) => String(s ?? "").replace(/'/g, "''");
  return [
    "INSERT INTO jobs_fetch_reports (source, target, started_at, finished_at, ok, fetched, inserted, updated, dropped, errors, message, per_source) VALUES (",
    `'${esc("apply-engine")}', '${esc(report.sourceUrl)}', ${report.startedAt}, ${Date.now()}, ${ok}, ${totalSeen}, ${c.submitted}, ${c.needsReview}, ${c.skipped}, ${c.error},`,
    `'${esc(message)}', '${esc(JSON.stringify({ site: report.site, results: report.results.slice(0, 50) }))}');`,
  ].join(" ");
}
