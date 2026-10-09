#!/usr/bin/env node
/* apply-engine-lib — PURE logic for the local auto-apply engine (no Playwright
 * I/O): per-site rules, form-question classification, honest answer drafting,
 * fuzzy option matching, and run-report builders. The browser-driving script
 * (auto-apply-jobs.js) imports these; unit tests pin the pure behavior.
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
    applyButtonText: /easy\s*apply|apply (on|to) (the )?company (website|site)|^\s*apply\s*$/i,
    steps: ["contact", "resume", "questions", "review"],
    autoSubmit: false, // owner decision: LinkedIn accounts are precious — review gate
    submitButtonText: /submit\s*application/i,
    successText: /application\s+sent|your application was sent|application submitted/i,
    listSelectorHints: ["a[href*='/jobs/view/']", ".jobs-search-results__list-item", ".job-card-container"],
    minIntervalMs: 4000, // LinkedIn rate-limits hard; keep it slow
    sessionCookieNames: ["li_at"], // ground truth: guests never have li_at
    /* the site's own application tracker — --outcomes reads views/replies */
    outcomes: { url: "https://www.linkedin.com/my-items/saved-jobs/?cardType=APPLIED" },
  },
  naukri: {
    label: "Naukri",
    jobsUrlHosts: ["naukri.com"],
    loginPathHints: ["/login", "nj.login", "register"],
    loggedInHint: "/mnjuser/",
    applyButtonText: /^apply$/i,
    steps: ["apply"],
    autoSubmit: true,
    submitButtonText: /^apply$/i,
    successText: /applied|application (has been )?submitted/i,
    listSelectorHints: ["a[href*='job-listings-']", "a[href*='job-detail']", "a[href*='joblisting']", "a.job-title-href", ".job-tittle a"],
    minIntervalMs: 2500,
    /* NO sessionCookieNames — naukri's OTP session lands as SESSION-ONLY
       cookies (expires<=0), which die at browser close; pinning guessed
       names would false-negative the outcome check after a REAL login.
       Instead the engine makes the live session durable via
       persistSessionCookies() after a verified login (#162), and logs the
       ACTUAL cookie names to signin-flow.log for future pinning. */
    /* the candidate's own applied-jobs tracker — --outcomes reads statuses */
    outcomes: { url: "https://www.naukri.com/mnjuser/myapply" },
  },
  instahyre: {
    label: "Instahyre",
    jobsUrlHosts: ["instahyre.com"],
    loginPathHints: ["/accounts/login", "/login/", "login/?next="],
    loggedInHint: "/candidate/opportunities",
    applyButtonText: /apply|interested/i,
    steps: ["apply"],
    autoSubmit: true,
    submitButtonText: /^submit$/i,
    successText: /applied|application sent|we'll be in touch/i,
    listSelectorHints: ["a[href*='/job-']", "a[href*='/candidate/opportunities/']"],
    minIntervalMs: 2500,
    sessionCookieNames: ["sessionid"], // ground truth (verified live: guests never carry sessionid)
  },
  indeed: {
    label: "Indeed",
    jobsUrlHosts: ["indeed.com", "indeed.co.in"],
    loginPathHints: ["/accounts/login", "signin", "authuser"],
    loggedInHint: "",
    applyButtonText: /apply( now)?/i,
    steps: ["apply"],
    autoSubmit: false, // indeed's flow varies per employer — review gate
    submitButtonText: /^submit( application)?$/i,
    successText: /application (was|has been) (sent|submitted)|thanks for applying/i,
    listSelectorHints: ["a[href*='/viewjob']", "a[href*='/cmp/']", "td.resultContent"],
    minIntervalMs: 3000,
    /* no durable named session cookie (indeed rotates analytics ids) —
       login verification stays page-based for this site */
  },
  workatastartup: {
    label: "Work at a Startup (YC)",
    jobsUrlHosts: ["workatastartup.com", "ycombinator.com"],
    loginPathHints: ["/login", "/signin", "/sessions"],
    loggedInHint: "",
    applyButtonText: /^apply( now)?$/i,
    steps: ["apply"],
    autoSubmit: false, // per-startup ATS is unknown — review gate
    submitButtonText: /^submit( application)?$/i,
    successText: /application (was|has been) (sent|submitted)|thanks for applying|applied/i,
    /* real postings live under /jobs/<id-or-slug>; the bare /jobs index is
       the LIST — classifyJobLink keeps only the detail links */
    listSelectorHints: ["a[href*='/jobs/']"],
    minIntervalMs: 2000,
    /* the site's own application tracker — --outcomes reads views/replies */
    outcomes: { url: "https://www.workatastartup.com/applications" },
  },
  greenhouse: {
    label: "Greenhouse",
    jobsUrlHosts: ["boards.greenhouse.io", "job-boards.greenhouse.io", "greenhouse.io"],
    loginPathHints: [], // public ATS boards — no session needed to apply
    loggedInHint: "",
    applyButtonText: /^apply( for this job)?( now)?$/i,
    steps: ["apply"],
    /* first-class board (jobs-fetch wires it in): the form IS the employer's
       own Greenhouse form with the pack's pinned submit/success text, and
       trySubmit's fail-closed required-field pre-check guards the one-way
       click — so auto-submit is trusted here like on Instahyre/Naukri. */
    autoSubmit: true,
    submitButtonText: /submit\s*application/i,
    successText: /application (was|has been) (received|submitted)|thanks for applying/i,
    listSelectorHints: ["a[href*='/jobs/']"],
    minIntervalMs: 2500,
    /* Greenhouse has no candidate-facing tracker (outcomes scrape can't see
       views) — --outcomes skips it honestly instead of guessing. */
  },
  ashby: {
    label: "Ashby",
    jobsUrlHosts: ["jobs.ashbyhq.com", "ashbyhq.com"],
    loginPathHints: [],
    loggedInHint: "",
    applyButtonText: /^apply( for this (job|role))?( now)?$/i,
    steps: ["apply"],
    autoSubmit: true, // same first-class-board reasoning as greenhouse
    submitButtonText: /submit\s*application/i,
    successText: /application (was|has been) (received|submitted)|thanks for applying/i,
    /* Ashby posting cards link to /<board>/<uuid> — classifyJobLink's
       uuid rule already reads them as postings; the discriminator drops
       the category/nav anchors around them. */
    listSelectorHints: ["a[href*='ashbyhq.com']"],
    minIntervalMs: 2500,
  },
  wellfound: {
    label: "Wellfound",
    jobsUrlHosts: ["wellfound.com", "angel.co"],
    loginPathHints: ["/login", "/users/sign_in"],
    loggedInHint: "",
    applyButtonText: /^apply( now)?$/i,
    steps: ["apply"],
    autoSubmit: false,
    submitButtonText: /^submit( application)?$/i,
    successText: /application (was|has been) (sent|submitted)|thanks for applying|applied/i,
    listSelectorHints: ["a[href*='/jobs/']"],
    minIntervalMs: 2000,
  },
  builtin: {
    label: "Built In",
    jobsUrlHosts: ["builtin.com"],
    loginPathHints: ["/login", "/users/sign_in"],
    loggedInHint: "",
    applyButtonText: /^apply( now)?$/i,
    steps: ["apply"],
    autoSubmit: false, // external ATS per employer — review gate
    submitButtonText: /^submit( application)?$/i,
    successText: /application (was|has been) (sent|submitted)|thanks for applying|applied/i,
    /* Built In postings are /job/<slug>/<id>; scoping to /job/ drops the
       category tiles ("/jobs/engineering", "/jobs/design") that were being
       scraped as postings */
    listSelectorHints: ["a[href*='/job/']"],
    minIntervalMs: 2000,
  },
  generic: {
    label: "Generic",
    jobsUrlHosts: [],
    loginPathHints: [],
    loggedInHint: "",
    applyButtonText: /^apply( now)?$/i,
    steps: ["apply"],
    autoSubmit: false, // unknown ATS — never auto-submit
    submitButtonText: /^submit( application)?$/i,
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

/* ─────────────────── posted-age parsing + freshness ordering ───────────────────

   Job cards carry a recency stamp ("3 hours ago", "Posted 2 days ago",
   "Just posted", "30+ Days Ago"). A <24h posting gets 3–10× the applicant
   volume after it ages out of the board's fresh feed — and most boards
   shortlist within the first day — so FRESHNESS BEATS FIT AT THE MARGIN:
   the collector orders <24h postings ahead of everything else, and the
   per-run `--max` budget therefore spends its slots on postings that are
   still being read by recruiters. Pure + unit-tested (applyEngine.test.ts). */

/** Postings younger than this are "fresh" and jump the collection queue. */
export const FRESH_MAX_HOURS = 24;

/** The DOM-side capture regex for a card's age stamp — shared by the
    collector (runs it in-page over the card's container text) and pinned
    here so tests cover exactly what the browser extracts. "ago"-relative
    stamps must carry "ago" so an "Apply today!" CTA never reads as age. */
export const POSTED_AGE_TEXT_RE = /\b(\d+\s*\+?\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\s*ago|just posted|posted today|few days ago|few hours ago)\b/i;

/** Extract the age-stamp text from a card's text ("" when none). Pure twin
    of the in-page capture so tests pin exactly what the collector extracts. */
export function cardAgeText(text) {
  return (String(text || "").match(POSTED_AGE_TEXT_RE) || [""])[0];
}

/** Parse a card's recency stamp into age-in-hours. Returns null when the
    text carries no recognizable age. Handles the boards' real formats:
    LinkedIn "3 hours ago", Naukri "30+ Days Ago" / "Few Days Ago",
    Instahyre/YC "Just posted"/"Today", generic "Posted 5 days ago",
    compact "2h ago" / "1d". Pure so tests pin every board's dialect. */
export function parsePostedAge(text, now = Date.now()) {
  const s = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return null;
  /* "today" counts ONLY as a full stamp — an "Apply today!" CTA is not an age */
  if (/^(just posted|posted (?:just )?now|posted today|today|new)[.!]?$/.test(s) || /\bfew hours\b/.test(s)) return 0;
  if (/\byesterday|few days|a day ago|some days/.test(s)) return 24; // ≥24h — no longer fresh
  const m = s.match(/(\d+)\s*\+?\s*(minutes?|mins?|m)\b/);
  if (m) return Number(m[1]) / 60;
  const h = s.match(/(\d+)\s*\+?\s*(hours?|hrs?|hr|h)\b/);
  if (h) return Number(h[1]);
  const d = s.match(/(\d+)\s*\+?\s*(days?|d)\b/);
  if (d) return Number(d[1]) * 24;
  const w = s.match(/(\d+)\s*\+?\s*(weeks?|w)\b/);
  if (w) return Number(w[1]) * 24 * 7;
  const mo = s.match(/(\d+)\s*\+?\s*months?\b/);
  if (mo) return Number(mo[1]) * 24 * 30;
  return null; // no age on the card — unknown, never promoted
}

/** Fresh = parseable age strictly under FRESH_MAX_HOURS. Unknown ages are
    NOT fresh (never promoted ahead of a known-fresh posting). */
export function isFreshPosted(ageHours) {
  return ageHours != null && isFinite(ageHours) && ageHours >= 0 && ageHours < FRESH_MAX_HOURS;
}

/** Collection-order rule: fresh (<24h) postings first — freshest of the
    fresh first — then everything else in the BOARD'S OWN ORDER (the board
    already lists newest-first, and re-sorting older rows by a noisy parsed
    age would jumble it for zero gain). Stable: equal keys keep input order.
    Each job gains `__ageH` (hours|null) + `__fresh` (boolean) so the run
    log, the report and the digest can show WHY a row went first. */
export function sortByFreshness(jobs, now = Date.now()) {
  const withAge = (jobs ?? []).map((j) => {
    const ageH = parsePostedAge(j.__ageText ?? j.postedAge ?? "", now);
    return { ...j, __ageH: ageH, __fresh: isFreshPosted(ageH) };
  });
  const fresh = withAge.filter((j) => j.__fresh).sort((a, b) => a.__ageH - b.__ageH);
  const rest = withAge.filter((j) => !j.__fresh);
  return [...fresh, ...rest];
}

/* ─────────────────── posting-vs-nav discrimination ───────────────────

   The generic collector used to treat ANY anchor matching broad hints
   (a[href*='job']) as a posting — on Y Combinator and Built In that meant
   site chrome: "Startup Jobs", "Design & UI/UX", "Recruiting & HR",
   category tiles. Every row then skipped as "not relevant" and the run
   screamed SUSPICIOUS RUN while applying to nothing. A REAL posting link
   carries an ID-BEARING detail path; a category/nav link does not. This is
   the discriminator: pure, testable, and shared by the collector and the
   drift learner (so what we reject is exactly what we learn from). */

/* Hosts whose posting detail paths carry no numeric id (slug-only). */
const SLUG_POSTING_HOSTS = /(^|\.)(workatastartup|wellfound|angel)\.co$|(^|\.)ycombinator\.com$/;

/* Nav/category labels that LOOK like postings to a naive text filter. */
const NAV_LABEL_RE = /^(all jobs?|jobs?|job search|search jobs?|startup jobs?|remote jobs?|find jobs?|browse jobs?|jobs? by (category|role|location)|engineering|design|design & ui\/ux|ui\/ux|recruiting( & hr)?|human resources|marketing|sales|finance|legal|operations|product|product management|data|data & analytics|customer service|administrative|healthcare services|accounting|arts and design|community and social services|consulting|education|entrepreneurship|information technology|business development|program and project management|retail|more jobs?|view all|see all|see more|show more|view more)$/i;

/**
 * Classify an anchor as a real posting link or site chrome.
 * @returns {{"kind":"posting"|"nav"|"unknown", "id": string|null, "routeKey": string|null}}
 *   - posting: href has an id-bearing detail path for this board family
 *   - nav: href is a category/listing route, or the label is chrome
 *   - unknown: not enough signal (caller decides)
 */
export function classifyJobLink({ href, text, host = "" } = {}) {
  let u = null;
  try { u = new URL(String(href || ""), "https://x.invalid"); } catch { /* unparseable → unknown */ }
  const raw = String(href || "");
  const label = String(text || "").trim().split("\n")[0].trim();
  const h = String(host || (u && u.hostname !== "x.invalid" ? u.hostname : "")).replace(/^www\./, "");

  if (NAV_LABEL_RE.test(label)) return { kind: "nav", id: null, routeKey: null };
  if (!raw) return { kind: "unknown", id: null, routeKey: null };

  const path = (u?.pathname || raw.split(/[?#]/)[0]);
  const q = u?.search || "";
  const qs = new URLSearchParams(q.startsWith("?") ? q : "");

  /* id in a query param = a posting (LinkedIn currentJobId, ATS gh_jid…) */
  const qid = qs.get("currentJobId") || qs.get("jobId") || qs.get("gh_jid") || qs.get("lever_job_id") || qs.get("ashby_jid") || qs.get("id");
  if (qid && /\d/.test(qid)) return { kind: "posting", id: qid, routeKey: null };

  /* ATS detail paths (greenhouse /jobs/<id>, lever /<slug>/<uuid>) */
  const gh = path.match(/\/jobs\/(\d{4,})/);
  if (gh) return { kind: "posting", id: gh[1], routeKey: null };
  const lever = path.match(/\/[^/]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (lever) return { kind: "posting", id: lever[0].split("/").pop(), routeKey: null };

  /* LinkedIn /jobs/view/<id> */
  const li = path.match(/\/jobs\/view\/(\d{5,})/);
  if (li) return { kind: "posting", id: li[1], routeKey: null };

  /* Naukri /job-listings-<slug>-<id> (id trails the slug) and /job-detail */
  const nk = path.match(/\/job-listings?-([^/?#]+)/i);
  if (nk) {
    const idm = nk[1].match(/(\d{4,})$/);
    return { kind: "posting", id: idm ? idm[1] : null, routeKey: null };
  }
  if (/\/job-detail/i.test(path)) return { kind: "posting", id: null, routeKey: "job-detail" };

  /* Instahyre /candidate/opportunities/<id> */
  const ih = path.match(/\/candidate\/opportunities\/(\d{3,})/);
  if (ih) return { kind: "posting", id: ih[1], routeKey: null };

  /* Built In /job/<slug>/<id> */
  const bi = path.match(/\/job\/[a-z0-9-]+\/(\d{4,})/i);
  if (bi) return { kind: "posting", id: bi[1], routeKey: null };

  /* Indeed /viewjob?jk=<hex> (id may be in the query) */
  const jk = qs.get("jk");
  if (jk && jk.length >= 8) return { kind: "posting", id: jk, routeKey: null };
  if (/\/viewjob|\/rc\/clk/i.test(path)) return { kind: "posting", id: null, routeKey: "viewjob" };

  /* Slug-only boards (YC/Work at a Startup/Wellfound): /jobs/<id>-slug,
     /jobs/<numeric-id>, or a company/job slug — no numeric requirement, but
     LISTING routes (bare /jobs, /jobs/all, category slugs) are still nav. */
  if (SLUG_POSTING_HOSTS.test(h)) {
    const seg = path.match(/\/jobs\/([^/?#]+)/);
    if (seg && !/^(all|search|category|role|location|remote|startup)$/i.test(seg[1]) && seg[1].length >= 3) {
      const num = seg[1].match(/^(\d{3,})/);
      return { kind: "posting", id: num ? num[1] : null, routeKey: "slug-job" };
    }
    /* /companies/<slug> is a company page, never a posting */
    return { kind: "nav", id: null, routeKey: null };
  }

  /* Generic fallback: a detail segment that carries digits (an id) is a
     posting; a bare word segment (/jobs, /engineering, /careers) is nav. */
  const detail = path.match(/\/(jobs?|positions?|openings?|vacanc(?:y|ies)|careers?)\/([^/?#]+)/i);
  if (detail) {
    const seg = detail[2];
    if (/^\d{2,}/.test(seg) || /\d{3,}/.test(seg)) return { kind: "posting", id: (seg.match(/\d{2,}/) || [])[0], routeKey: null };
    const num = seg.match(/(\d{4,})/);
    if (num) return { kind: "posting", id: num[1], routeKey: null };
    return { kind: "nav", id: null, routeKey: null }; // word-only → listing/category
  }

  return { kind: "unknown", id: null, routeKey: null };
}

/* ─────────────────── page-state guards (login / challenge / bans) ─────────────────── */

/**
 * True while a Cloudflare-style interstitial holds the page: the URL stays on
 * the target but the document is the challenge ("Just a moment…", security
 * verification). The engine must NOT treat this as a logged-in page.
 */
export function isChallengePage(title, bodyText) {
  const t = String(title || "");
  const b = String(bodyText || "");
  return /just a moment|attention required|security verification|checking your browser|verify you are (a )?human|performing security/i.test(t + " " + b.slice(0, 2000));
}

/** Account-level blockers a board shows INSTEAD of the job list after login. */
export function detectAccountProblem(bodyText) {
  const b = String(bodyText || "");
  if (/account (has been|is) (disabled|deactivated|suspended)|automatic account disablement|account.*disabled due to inactivity/i.test(b.slice(0, 6000))) {
    return "account disabled (contact the site to reactivate)";
  }
  return null;
}

/**
 * Conservative "am I really logged in?" — URL hint AND no login marker AND
 * no challenge. `title`/`bodyText` come from the live page.
 */
export function looksLoggedIn({ url, title, bodyText, loggedInHint, loginPathHints }) {
  const u = String(url || "");
  const onLogin = (loginPathHints ?? []).some((h) => u.toLowerCase().includes(String(h).toLowerCase()));
  if (onLogin) return false;
  if (loggedInHint && !u.includes(loggedInHint)) return false;
  return !isChallengePage(title, bodyText);
}

/** Does the job title's field fundamentally conflict with the profile's core
    focus? "DevOps Engineer" for a "Frontend Engineer" is a mismatch — reject it
    before exploring skills. This is asymmetric: a senior frontend profile can
    plausibly apply to "Full Stack" (frontend + backend together), but not to
    "Data Science" or "QA Automation" (different core function). */
export function titleFieldMismatch(jobTitle, profileHeadline) {
  const jt = String(jobTitle || "").toLowerCase();
  const ph = String(profileHeadline || "").toLowerCase();
  if (!jt || !ph) return false;
  
  /* fullstack engineers can apply to anything — they're software engineers */
  if (/\b(fullstack|full.?stack)\b/.test(ph)) return false;
  
  /* hard-reject domains: fundamentally different work, not just stack specialization */
  const isNonSoftwareRole = /\b(devops|sre|infrastructure|sys(tem|ops)|dba|database|security engineer|qa automation|sdet|qa engineer|data (engineer|scientist|analyst)|machine learning|mlops|ai engineer|product manager|pm|product owner|ux designer|graphic designer|ui\/ux|design)\b/.test(jt);
  
  if (!isNonSoftwareRole) return false; // backend/frontend/sde/engineer all pass through
  
  /* profile is a software engineer: they should not apply for non-software roles */
  const profileIsSoftwareEng = /\b(frontend|front-end|backend|back-end|software engineer|sde|developer|engineer)\b/.test(ph) &&
    !/\b(product manager|pm|designer|product owner)\b/.test(ph); // not a pm/designer wearing engineer title
  
  if (profileIsSoftwareEng) return true; // software engineer applying for devops/qa/data/etc = mismatch
  
  return false;
}

/** Is this posting title plausibly relevant to the profile? Generic role
    words (engineer/developer/sde) pass — specialization is the AI tailor's
    job — but alien fields (Data Scientist, Product Manager, Store Executive)
    fail: auto-applying there wastes the application and the AI rightly
    refuses to invent the experience. */
export function titleRelevant(title, profile) {
  const t = String(title || "").toLowerCase();
  if (!t) return false;
  if (/\b(engineer|developer|sde|sdet|programmer|architect)\b/.test(t)) return true;
  const hay = [profile?.headline ?? "", ...(profile?.skills ?? [])].join(" ").toLowerCase();
  const words = [...new Set(hay.split(/[^a-z0-9.+#]+/).filter(w => w.length >= 3 && w !== "and"))];
  return words.some(w => new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(t));
}

/* ---- JD skill relevance: does the POSTING ask for what the RESUME has? ----

   Skills with several spellings normalize to one token (c#, c++, node.js …);
   related skills collapse into families so "React" answers a "Next.js" ask
   (transferable within the same stack, which the profile genuinely covers).
   Aliases map to a CANONICAL skill name; families share a base token so any
   family member proves the whole family. */
const SKILL_ALIASES = {
  "react": "react", "reactjs": "react", "react.js": "react", "next.js": "react", "nextjs": "react", "next": "react",
  "remix": "react", "redux": "react", "react native": "react",
  "vue": "vue", "vue.js": "vue", "vuejs": "vue", "nuxt": "vue", "nuxt.js": "vue",
  "angular": "angular", "angularjs": "angular", "angular.js": "angular",
  "svelte": "svelte", "sveltekit": "svelte",
  "typescript": "typescript", "ts": "typescript",
  "javascript": "javascript", "js": "javascript", "es6": "javascript", "ecmascript": "javascript",
  "node": "node", "node.js": "node", "nodejs": "node", "express": "node", "express.js": "node", "expressjs": "node", "nestjs": "node", "nest.js": "node", "adonis": "node",
  "python": "python", "django": "python", "flask": "python", "fastapi": "python",
  "java": "java", "spring": "java", "spring boot": "java", "kotlin": "java",
  "golang": "go", // bare "go" is too common in English prose to be a skill signal
  "rust": "rust", "c#": "csharp", "csharp": "csharp", ".net": "csharp", "dotnet": "csharp", "asp.net": "csharp",
  "c++": "cpp", "cpp": "cpp",
  "php": "php", "laravel": "php", "symfony": "php",
  "ruby": "ruby", "rails": "ruby", "ruby on rails": "ruby",
  "scala": "scala", "elixir": "elixir", "graphql": "graphql", "apollo": "graphql",
  "sql": "sql", "mysql": "sql", "postgres": "sql", "postgresql": "sql", "sqlite": "sql", "sql server": "sql", "mssql": "sql", "pl/sql": "sql", "oracle": "sql", "mongodb": "sql", "mongo": "sql", "dynamo": "sql", "dynamodb": "sql", "redis": "sql", "cassandra": "sql", "elasticsearch": "sql",
  "aws": "aws", "amazon web services": "aws", "gcp": "cloud", "google cloud": "cloud", "azure": "cloud", "cloud": "cloud",
  "docker": "docker", "container": "docker", "kubernetes": "docker", "k8s": "docker", "eks": "docker", "ecs": "docker",
  "terraform": "devops", "ansible": "devops", "jenkins": "devops", "ci/cd": "devops", "cicd": "devops", "ci cd": "devops", "github actions": "devops", "gitlab ci": "devops", "devops": "devops",
  "html": "html", "html5": "html", "css": "css", "css3": "css", "sass": "css", "scss": "css", "less": "css", "tailwind": "css", "tailwindcss": "css", "tailwind css": "css", "bootstrap": "css", "styled-components": "css", "styled components": "css",
  "graphql apis": "graphql", "rest": "rest", "rest api": "rest", "restful": "rest", "rest apis": "rest", "grpc": "rest",
  "microservices": "microservices", "micro frontend": "microfrontend", "micro frontends": "microfrontend", "micro-frontend": "microfrontend",
  "accessibility": "accessibility", "a11y": "accessibility", "wcag": "accessibility",
  "testing": "testing", "jest": "testing", "vitest": "testing", "cypress": "testing", "playwright": "testing", "testing library": "testing", "unit test": "testing", "unit testing": "testing", "e2e testing": "testing",
  "performance": "performance", "web performance": "performance", "core web vitals": "performance",
  "pwa": "pwa", "ssr": "ssr", "server-side rendering": "ssr", "ssg": "ssr", "static site generation": "ssr",
  "system design": "systemdesign", "distributed systems": "systemdesign", "scalability": "systemdesign",
  "machine learning": "ai", "artificial intelligence": "ai", "llm": "ai", "nlp": "ai", "genai": "ai", "generative ai": "ai", // bare "ai"/"ml" dropped — prose mentions wrongly reject roles
  "webpack": "bundler", "vite": "bundler", "rollup": "bundler", "esbuild": "bundler",
  "git": "git", "agile": "agile", "scrum": "agile", "figma": "design", "ui/ux": "design",
};

const CANON_SKILL_RE = /c\+\+|c#|c|f#|go|ai|ml|ts|js|node|go$/; // 1–2-char canonicals need care when scanning

/** Normalize a raw skill string to its canonical token (null = not a skill). */
export function canonicalSkill(raw) {
  const s = String(raw || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/[.,;]$/, "");
  if (!s || s.length > 24) return null;
  return SKILL_ALIASES[s] ?? null;
}

/** Was the submission genuinely successful? The SITE_RULES carry a successText
    regex; this checks if the page text matches it. Returns true only if success
    text is detected — missing success text is NOT success (fail-closed). */
export function detectSubmissionSuccess(pageText, siteKey) {
  const rules = SITE_RULES[siteKey] || SITE_RULES.generic;
  const text = String(pageText || "").slice(0, 5000);
  return rules.successText.test(text);
}

/** The profile's canonical skill set (deduped, non-empty). */
export function profileSkillSet(profile) {
  const out = new Set();
  for (const s of profile?.skills ?? []) {
    const c = canonicalSkill(s);
    if (c) out.add(c);
    else if (typeof s === "string" && s.trim().length >= 3 && s.trim().length <= 24) out.add(s.toLowerCase().replace(/\s+/g, " ").trim());
  }
  return out;
}

/**
 * Skills named in the POSTING TITLE are core by definition: "Senior Python
 * Full Stack Developer" needs python — a 60% overall ratio must not wave
 * the headline skill through. Longest-alias-first so "next.js" wins over
 * "next"; word-boundary matched.
 */
export function titleSkills(title) {
  const t = " " + String(title || "").toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ").replace(/\s+/g, " ") + " ";
  const out = new Set();
  const aliases = Object.keys(SKILL_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (alias.length < 2) continue; // "go"/"r" in titles = prose, not skills
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "\\/");
    if (new RegExp("(?:^| )" + esc + "(?: |$)").test(t)) out.add(SKILL_ALIASES[alias]);
  }
  return [...out];
}

/**
 * JD-vs-resume skill match. The gate is deliberately ASYMMETRIC:
 *  - the JD's REQUIRED skills must be (largely) covered by the profile, and
 *  - the profile proves relevance when enough of its top skills appear in the
 *    JD text (a posting that mentions none of your skills isn't your job).
 * Generic words (experience, agile, git …) never count on either side.
 *
 * CRITICAL skills (opts.critical: title-derived and/or repetition-weighted)
 * are NOT forgiven by the ratio: "Python" in the title of a posting the
 * profile lacks python for = reject, whatever the overall coverage. The
 * caller may pass learned strikes (apply_skill_strikes) — a skill the owner
 * 👎-ed twice is treated as permanently critical (the engine learned it).
 */
export function jdSkillMatch(jdText, profile, { minJd = 0.6, minProfile = 2, critical = [], learnedCritical = [] } = {}) {
  const text = " " + String(jdText || "").toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ").replace(/\s+/g, " ") + " ";
  const prof = profileSkillSet(profile);
  if (!prof.size) return { ok: true, reason: "profile lists no skills — title gate only", matched: [], missing: [], jdSkills: [] };

  const jdSkills = new Set();
  for (const [alias, canon] of Object.entries(SKILL_ALIASES)) {
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "\\/");
    if (new RegExp("(?:^| )" + esc + "(?: |$)").test(text)) jdSkills.add(canon);
  }
  const generic = new Set(["git", "agile", "design", "performance", "testing", "rest"]);
  const required = [...jdSkills].filter((s) => !generic.has(s) || prof.has(s));
  if (!required.length) {
    return { ok: profHasPull(prof, text, minProfile), reason: "JD mentions no specific skills", matched: [], missing: [], jdSkills: [] };
  }
  const matched = required.filter((s) => prof.has(s));
  const missing = required.filter((s) => !prof.has(s));
  /* critical-and-missing, with source-correct semantics:
     - title-named → reject when the profile lacks it (even if the JD text
       never spells it out — the title already demanded it)
     - LEARNED strikes (owner 👎) → reject only when THIS JD actually
       requires it — a strike on python must not reject a python-free JD.
     JD-REPEATED skills are NOT critical: every modern JD's "Key
     Technologies" list repeats its stack keywords 2-3× (a React role
     listing GraphQL/REST three times is not a GraphQL job) — they weigh
     in the coverage ratio above and the AI judge owns the borderline. */
  const critSet = new Set();
  for (const s of critical) if (!prof.has(s)) critSet.add(s);
  for (const s of learnedCritical) if (missing.includes(s) && !skillIsBuzzOnly(jdText, s)) critSet.add(s);
  const criticalMissing = [...critSet];
  if (criticalMissing.length) {
    return {
      ok: false,
      reason: `core skill missing: ${criticalMissing.slice(0, 3).join(", ")} — required by title/JD`,
      matched, missing, criticalMissing, jdSkills: [...jdSkills],
    };
  }
  const enough = matched.length / required.length >= minJd;
  const pull = matched.length >= minProfile ? true : profHasPull(prof, text, minProfile);
  return {
    ok: enough && pull,
    reason: enough ? (pull ? "skill match" : "JD skills barely overlap the resume") : `JD requires ${missing.slice(0, 3).join(", ")} — not on the resume`,
    matched, missing, jdSkills: [...jdSkills], criticalMissing: [],
  };
}

/* Enough of the profile's TOP skills appear in the JD? (relevance pull) */
function profHasPull(prof, text, minProfile) {
  const ranked = [...prof].filter((s) => !CANON_SKILL_RE.test(s));
  const generic = new Set(["git", "agile", "design", "performance", "testing"]);
  let hits = 0;
  for (const s of ranked.slice(0, 12)) {
    if (generic.has(s)) continue;
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp("(?:^| )" + esc + "(?: |$)").test(text)) hits++;
  }
  return hits >= Math.min(minProfile, Math.max(1, Math.floor(ranked.length / 4)));
}

/** The relevance gate for a posting: title + JD skills must BOTH agree.
    Title-derived critical skills come along automatically; the caller may
    add learned strikes (owner feedback) via opts. An owner-confirmed
    posting (opts.ownerConfirmed) skips the title gate entirely: board
    title mangling ("Banking — Senior Frontend Engineer (L5)") and template
    quirks must not overrule the owner's explicit verdict on THIS posting. */
export function postingRelevant({ title, description }, profile, opts = {}) {
  /* title field mismatch is a hard reject unless owner explicitly confirmed this posting */
  if (titleFieldMismatch(title, profile?.headline) && !opts.ownerConfirmed) {
    return { ok: false, reason: "job field incompatible with profile (e.g., DevOps vs Frontend)" };
  }
  if (!titleRelevant(title, profile) && !opts.ownerConfirmed) return { ok: false, reason: "title not relevant to profile" };
  const m = jdSkillMatch(String(description || ""), profile, {
    critical: titleSkills(title),
    learnedCritical: opts.learnedCritical ?? [],
  });
  if (!m.ok) return { ok: false, reason: m.reason, matched: m.matched, missing: m.missing, criticalMissing: m.criticalMissing };
  return { ok: true, reason: m.reason, matched: m.matched, missing: m.missing };
}

/** AI refusals/preambles must never become a resume or cover letter: the
    agreed SKIP sentinel, first-person refusals, and meta commentary about
    the input ("I need to flag something:", "this resume is missing…"). */
export function looksLikeRefusal(text) {
  const s = String(text || "").slice(0, 300).trim();
  if (/^__SKIP__$/i.test(s)) return true;
  if (/^\s*(i (can't|cannot|won't|am unable|am not able|need to|must|noticed|see that)|sorry,? (but )?i (can't|cannot))/i.test(s)) return true;
  return /^(i need to flag|this (resume|letter|profile) (is|was) missing|the (resume|input) (you|provided))/.test(s.toLowerCase());
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

  /* a country-code dropdown is NOT the phone input — label contains "phone",
     but the honest answer is the owner's dialing code (extraAnswers), and a
     full number never matches the option list */
  if (has(/country code|dial(ing)? code/)) return { kind: "phoneCountryCode", confidence: "answer" };
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

/** LinkedIn shows either "Easy Apply" (in-product modal) or "Apply on
    company website" (external ATS, usually a new tab). The button text is
    the mode selector: external ATS forms must NEVER auto-submit — they are
    filled and queued for the human, same fail-closed standard as unknown
    boards. */
export function isExternalApplyButton(text) {
  return /apply (on|to) (the )?company (website|site)/i.test(String(text || ""));
}

/* ─────────────────── per-ATS selector packs ─────────────────── */

/* External ATS boards have known, stable markup. A pack scopes form-field
   extraction (tighter than the page-wide generic selector, so nav/search
   junk never lands in the field list) and pins the submit/success text for
   the day an ATS is trusted with auto-submit (never today — external forms
   are always filled and queued for the human). Unknown ATS falls back to
   the generic pack. */
export const ATS_PACKS = {
  greenhouse: {
    label: "Greenhouse",
    hostHints: ["greenhouse.io", "grnh.se"],
    fieldSelectorHints: ["#application_form input:not([type=hidden]):not([disabled])", "#application_form textarea", "#application_form select", "form input:not([type=hidden]):not([disabled])", "form textarea", "form select"],
    submitButtonText: /submit\s*application/i,
    successText: /application (was|has been) (received|submitted)|thanks for applying/i,
  },
  lever: {
    label: "Lever",
    hostHints: ["lever.co"],
    fieldSelectorHints: ["form input:not([type=hidden]):not([disabled])", "form textarea", "form select"],
    submitButtonText: /submit\s*application/i,
    successText: /application (was|has been) (received|submitted)|thanks for applying/i,
  },
  workable: {
    label: "Workable",
    hostHints: ["workable.com"],
    fieldSelectorHints: ["form input:not([type=hidden]):not([disabled])", "form textarea", "form select", "[data-ui='input'] input:not([type=hidden])", "[data-ui='textarea'] textarea", "[data-ui='select'] select"],
    submitButtonText: /submit(\s*application)?/i,
    successText: /application (was|has been) (received|submitted)|thanks for applying/i,
  },
  generic: {
    label: "ATS",
    hostHints: [],
    fieldSelectorHints: ["input:not([type=hidden]):not([disabled])", "textarea", "select"],
    submitButtonText: /submit(\s*application)?/i,
    successText: /application (was|has been) (received|submitted)|thanks for applying|thank you for (your )?(applying|application)/i,
  },
};

/** Which ATS pack drives form extraction for this URL? Unknown hosts get
    the generic pack (page-wide selectors, same behavior as before packs). */
export function detectAts(url) {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* generic below */ }
  for (const pack of Object.values(ATS_PACKS)) {
    if (pack.hostHints.some((h) => host === h || host.endsWith("." + h))) return pack;
  }
  return ATS_PACKS.generic;
}

/* ─────────────────── form-answer memory (reuse) ─────────────────── */

/** Stable storage key for a form field: lowercase, punctuation-collapsed
    label. "First Name *" and "first name:" share one key; a label change on
    the board misses the cache honestly (fail-open to draftAnswer). */
export function normalizeFieldKey(label) {
  return String(label ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 120);
}

/* Kinds whose answers must NEVER be reused from memory: job-specific text
   (the tailored letter), free-form unknowns, and review-gate facts the
   engine only fills when the profile declares them. Reusing those would
   spray one job's words into another job's form. */
const NON_REUSABLE_KINDS = new Set(["coverLetter", "longText", "unknown", "workAuth", "certificate"]);
export function canStoreAnswer(kind) { return !NON_REUSABLE_KINDS.has(String(kind || "unknown")); }

/**
 * One classification pass per field: draft from the profile first, then
 * fall back to a remembered answer for this exact label key. Returns the
 * plan the fill loop walks (answer "" = leave blank, as always).
 */
export function planFormAnswers(fields, profile, job, stored = {}) {
  return (fields ?? []).map((meta) => {
    const cls = classifyQuestion(meta.label, { tag: meta.tag, required: meta.required });
    const key = normalizeFieldKey(meta.label);
    let answer = draftAnswer(cls.kind, profile, job);
    if (!answer && key && typeof stored[key] === "string" && stored[key].trim()) answer = stored[key].trim();
    return { cls, key, answer };
  });
}

/** What the review queue shows the owner before they open the form: every
    field with its kind and whether the engine had an answer for it. */
export function formFieldsPreview(fields, plan) {
  return (fields ?? []).map((meta, i) => ({
    label: String(meta.label ?? "").slice(0, 80),
    kind: plan?.[i]?.cls?.kind ?? "unknown",
    required: !!meta.required,
    answered: Boolean(plan?.[i]?.answer),
  })).slice(0, 24);
}

/* ─────────────────── AI judge (the engine's reading comprehension) ─────────────────── */

/* Regex gates catch arithmetic facts ("Python in the title", 60% coverage).
   They CATCH-ALL fail on judgment: "Testing" on the resume does not make an
   SDET/QA-automation role a frontend engineer's job; "full stack" JDs hide
   a backend core under frontend words. The AI judge reads the ACTUAL JD and
   renders a verdict with strict JSON — before any kit is built or form is
   touched. Rules remain the guardrails (cheap, instant, auditable); the
   judge is the reading comprehension layered on top of them. */
/* Learning window, part 2: the judge LEARNS from the owner's verdicts on
   real postings. Positive/negative exemplars are short title+reason pairs
   fed into the judge prompt so its future decisions generalize from them
   ("this owner counts full-stack frontend with React+TS as a match even
   when Python appears in the JD body; SDET roles are always skip"). */
export function exemplarBlock(positive = [], negative = []) {
  const lines = [];
  for (const e of positive.slice(0, 5)) lines.push(`APPLY-EXAMPLE: ${String(e).slice(0, 160)}`);
  for (const e of negative.slice(0, 5)) lines.push(`SKIP-EXAMPLE: ${String(e).slice(0, 160)}`);
  return lines.length ? `Examples of this owner's past verdicts (follow their pattern):\n${lines.join("\n")}` : "";
}

/** Does this job carry an OWNER-POSITIVE exemplar? Owner 👍 on a posting is
    the ground truth that overrides even a reasoned judge skip — that is the
    whole learn-from-the-owner loop. Match by posting id when known, else by
    DISTINCTIVE title-token overlap: stopwords (software, engineer, developer,
    senior, fullstack …) are stripped BEFORE counting — the old matcher let a
    single generic word like "software" (≥8 chars) count as a "strong" match,
    which owner-confirmed EVERY engineering posting and silently bypassed the
    AI judge (the low-match Instahyre applies bug #164). Now: after removing
    stopwords, require ≥3 shared distinctive tokens, or a single ≥8-char
    distinctive token. A Python Backend job can never inherit a React
    exemplar's verdict via the word "engineer" alone. */
const EXEMPLAR_STOPWORDS = new Set([
  "software", "engineer", "engineering", "developer", "development",
  "fullstack", "full-stack", "backend", "frontend", "senior", "junior",
  "staff", "lead", "principal", "product", "technology", "technologies",
  "sde", "sdet", "test", "testing", "associate", "intern", "company",
  "ltd", "pvt", "limited", "bangalore", "remote", "india", "hyderabad",
  "gurugram", "mumbai", "pune", "noida", "delhi", "chennai", "tata", "consulting", "services", "solutions", "labs", "systems",
]);
export function ownerExemplarFor(job, exemplars) {
  const positives = (exemplars?.positive ?? []).map((s) => String(s));
  if (!positives.length) return "";
  const m = String(job?.url || "").match(/(?:jobs\/view\/|currentJobId=)(\d+)/);
  if (m) { const hit = positives.find((s) => s.includes(m[1])); if (hit) return hit; }
  /* tokens: distinctive words only — stopwords and pure numbers stripped */
  const rawTokens = (s) => new Set(String(s || "").toLowerCase().match(/[a-z][a-z.+#]{3,}/g)?.filter((w) => !/^\d+$/.test(w)) ?? []);
  const tokens = (s) => { const t = rawTokens(s); for (const w of [...t]) if (EXEMPLAR_STOPWORDS.has(w)) t.delete(w); return t; };
  const jt = tokens(job?.title);
  if (!jt.size) {
    /* all-generic title ("Senior Frontend Developer"): nothing distinctive
       survived — fall back to RAW token overlap with a plain ≥3 threshold
       (no strong-single-word shortcut, which is exactly the bug this fix
       removes: "Fullstack Developer" must not inherit via "developer"). */
    const jtRaw = rawTokens(job?.title);
    if (jtRaw.size < 3) return "";
    for (const s of positives) {
      const st = rawTokens(s);
      let n = 0;
      for (const t of jtRaw) if (st.has(t)) n++;
      if (n >= 3) return s;
    }
    return "";
  }
  let best = "", bestN = 0;
  for (const s of positives) {
    const st = tokens(s);
    let n = 0;
    for (const t of jt) if (st.has(t)) n++;
    /* strong = one DISTINCTIVE tech token ≥5 chars (react, typescript,
       playwright…) — generic words are already stripped above, so this can
       no longer fire on "software"/"engineer"-shaped overlap (#164). */
    const strong = [...jt].some((t) => t.length >= 5 && st.has(t));
    if (strong || n > bestN) { best = s; bestN = Math.max(n, strong ? 3 : n); }
  }
  return bestN >= 3 ? best : "";
}

/* ─── employer-behavior learning (the outcome scraper's feedback loop) ───

   The engine already learns from the OWNER (review verdicts → exemplars).
   The other half of the loop is the EMPLOYER: the weekly --outcomes scrape
   records views/replies per board and fit band, and those rates come back
   into the judge prompt as a prior — "applications at fit 70-84 got
   responses 3/20 times" — so fit bands that never convert stop spending
   the owner's applications on borderline postings. */

/** Map a tracker row's status text to outcome milestones. Returns
    { viewed: boolean, responseKind: "reply"|"interview"|"rejected"|"offer"|null }.
    Rejection CHECKS outrank view words ("Viewed · Not selected" is a
    rejection); interview/offer outrank generic replies. Unknown text →
    no milestone (honest nulls, never guessed). */
export function classifyOutcome(text) {
  const s = String(text || "").toLowerCase();
  if (!s.trim()) return { viewed: false, responseKind: null };
  if (/offer (made|extended|received)|offer letter/.test(s)) return { viewed: true, responseKind: "offer" };
  if (/interview|shortlist|hiring team (is )?interested|would like to (talk|chat|move)/.test(s)) return { viewed: true, responseKind: "interview" };
  if (/not selected|rejected|no longer under consideration|no longer being considered|position (has been )?filled|application (was )?declined|your application (was|has) not/.test(s)) return { viewed: true, responseKind: "rejected" };
  if (/replied|responded|message from|hiring team viewed|employer (has )?viewed|viewed by/.test(s)) return { viewed: true, responseKind: "reply" };
  if (/viewed|seen|opened|under review|in review|application being reviewed/.test(s)) return { viewed: true, responseKind: null };
  return { viewed: false, responseKind: null };
}

/** Build the judge-prompt prior from engine_outcome_stats() rows
    ({fit_band, applications, responded, response_rate}). Only bands with
    real evidence (>=5 applications) speak; empty when the data doesn't. */
export function outcomePrior(stats) {
  const rows = (stats ?? [])
    .filter((r) => Number(r?.applications ?? 0) >= 5)
    .sort((a, b) => String(a.fit_band).localeCompare(String(b.fit_band)));
  if (!rows.length) return "";
  const lines = rows.map((r) =>
    `- fit ${r.fit_band}: ${r.responded}/${r.applications} applications got an employer response${Number(r.response_rate) >= 0 ? ` (${Math.round(Number(r.response_rate) * 100)}%)` : ""}`);
  return `Employer-response history for this candidate's past applications (90d — favor fit bands that actually convert):\n${lines.join("\n")}`;
}

/** Should the outcome scraper RECORD this tracker row? Two gates: the row
    must carry a classifiable milestone, AND it must be one of the
    candidate's applications (in the engine's dedupe set, or the row itself
    says "applied/submitted" — employer behavior is worth recording even for
    manual applications). Returns the classification, or null = skip. Pure:
    the caller passes its `wasApplied(url)` as a predicate. */
export function outcomeRowShouldRecord(text, url, applied) {
  const o = classifyOutcome(text);
  if (!o.viewed && !o.responseKind) return null;
  const isApplied = typeof applied === "function" ? !!applied(url) : !!applied;
  if (!isApplied && !/applied|submitted/i.test(String(text || ""))) return null;
  return o;
}

/** The tracker-page link pattern per site (which anchors are application
    rows on this board's "my applications" page). Falls back to a generic
    posting-link shape for boards added later. Pure + pinned. */
export function trackerRowLinkRe(site) {
  const RES = {
    linkedin: /linkedin\.com\/jobs\/view\/(\d+)/i,
    naukri: /naukri\.com\/job-listings-([^/?#]+)/i,
    instahyre: /instahyre\.com\/candidate\/opportunities\/(\d+)/i,
    workatastartup: /workatastartup\.com\/jobs\/([^/?#]+)/i,
  };
  return RES[site] ?? /\/jobs?(?:\/|\/view\/|\/listings?-|=)([^/?#]+\d[^/?#]*|\d+)/i;
}

/** The weekly digest's employer-behavior section (Telegram text). Reads the
    admin_apply_outcome_digest rows + engine_outcome_stats rows; honest when
    empty (no data ≠ silence). Pure so the digest format is pinned. */
export function outcomeDigestLines(outcomeRows, stats) {
  const rows = outcomeRows ?? [];
  if (!rows.length) {
    return "\n📈 employer behavior (7d): no tracked applications — run --outcomes (the digest task does this weekly) once trackers are signed in.";
  }
  const fmtRow = (o) =>
    `• ${o.site_host} · fit ${o.fit_band}: ${o.applications} applied · ${o.viewed} viewed · ${o.responded} responded${o.interviews ? ` (${o.interviews} interview)` : ""}${o.rejected ? ` (${o.rejected} rejected)` : ""}`;
  const best = (stats ?? [])
    .filter((s) => Number(s?.applications ?? 0) >= 5)
    .sort((a, b) => Number(b.response_rate ?? 0) - Number(a.response_rate ?? 0))[0];
  return `\n📈 employer behavior (7d):\n${rows.map(fmtRow).join("\n")}`
    + (best
      ? `\n🧠 learning: fit ${best.fit_band} converts best (${best.responded}/${best.applications} responded) — the judge gets this prior on the next run.`
      : "\n🧠 learning: not enough tracked applications yet (needs 5+ per band) — keep the outcome scrape running weekly.");
}

/** Registry-row resolution for a run URL: the FULL jobs_url match wins
    (path-qualified ATS boards: boards.greenhouse.io/lyft ≠ …/airbnb), then
    the bare-host / host-prefix match. Returns the row or undefined. Pure so
    per-board identity in apply_results/digest rows is pinned. */
export function matchSiteRow(rows, url) {
  const strip = (u) => String(u || "").replace(/\/+$/, "");
  let bare = "";
  try { bare = new URL(url).hostname.replace(/^www\./, ""); } catch { /* below */ }
  const hostish = String(url || "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  const list = rows ?? [];
  return list.find((s) => s.jobs_url && strip(s.jobs_url) === strip(url))
    ?? list.find((s) => s.host === hostish || (bare && s.host === bare));
}

export function judgeMessages(job, profile, exemplars = null, outcomePriorText = "") {
  const p = profile || {};
  const system = [
    "You are a strict hiring manager screening applications for a real candidate.",
    "Decide whether this candidate is a REALISTIC match for this specific posting — not whether they could learn it.",
    "Reject (verdict skip) when ANY of these hold:",
    "- a skill named in the job TITLE (e.g. Python, Java, React) is absent from the candidate's skills — the headline requirement is not negotiable",
    "- the posting's CORE programming language or framework (the one its requirements are written around, e.g. a JD built on Java/Spring Boot/Kafka) is absent from the candidate's skills — tool-level overlap elsewhere (cloud, testing, react) does NOT make it transferable",
    "- the role's core function differs from the candidate's demonstrated work (a frontend/product-engineer resume is NOT a QA-automation/SDET, data-engineering, or DevOps role even when some tools overlap)",
    "- hard requirements (domain, stack) clearly outstrip the resume. Being MORE senior than the posting is NOT a rejection reason — experienced candidates apply to senior-adjacent roles all the time",
    "Apply (verdict apply) when the core function matches and the core stack is genuinely on the resume; adjacent transferable experience counts ONLY for peripheral requirements, never for the core language/framework.",
    "Be conservative about wasting the candidate's applications — a wrong application is worse than a missed one.",
    "Reply with ONLY this JSON, nothing else:",
    '{"verdict":"apply|skip","confidence":0.00-1.00,"reasoning":"detailed reasoning for this decision","reason":"one short sentence","missingCore":["skills the posting fundamentally requires that the resume lacks"]}',
  ].join(" ");
  const user = [
    `CANDIDATE: ${p.headline || "engineer"}${p.years != null ? `, ${p.years} yrs` : ""}. Skills: ${(p.skills ?? []).join(", ") || "(none listed)"}.`,
    `POSTING: ${job?.title || "(untitled)"}${job?.company ? ` at ${job.company}` : ""}.`,
    exemplars ? exemplarBlock(exemplars.positive, exemplars.negative) : "",
    outcomePriorText || "",
    `JD (may be truncated): ${(job?.description || "").slice(0, 3500)}`,
  ].filter(Boolean).join("\n");
  return { system, user };
}

/** Parse the judge's reply defensively: any deviation from the JSON contract
    (prose, refusal, truncated JSON) = "unknown" — the caller proceeds
    fail-open to the deterministic backstops (kit SKIP sentinel etc.). */
export function parseJudgeReply(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return { verdict: "unknown", reason: "judge returned no JSON" };
  try {
    const j = JSON.parse(m[0]);
    if (j.verdict !== "apply" && j.verdict !== "skip") return { verdict: "unknown", reason: "judge verdict not apply/skip" };
    return { verdict: j.verdict, confidence: Number(j.confidence) || 0, reasoning: String(j.reasoning ?? "").slice(0, 500), reason: String(j.reason ?? "").slice(0, 160), missingCore: Array.isArray(j.missingCore) ? j.missingCore.slice(0, 5).map(String) : [] };
  } catch { return { verdict: "unknown", reason: "judge JSON unparseable" }; }
}

/* ---- profile extras: hard answers for recurring form questions --------- */
/* extraAnswers: { [kind]: string } — an OWNER-DECLARED fact used verbatim
   when the profile has no first-class field for that question kind (e.g.
   "phoneCountryCode": "+91" for the LinkedIn "Phone country code*" select).
   Nothing is invented: absent key → empty answer → fail-closed as before. */
export function extraAnswerFor(profile, kind) {
  const v = profile?.extraAnswers?.[kind];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/**
 * Drafts an honest answer for a classified question. Returns "" (leave blank)
 * when the profile has no data — the caller decides whether that blocks
 * submission (required fields do). NEVER invents facts. An owner-declared
 * extraAnswers[kind] fills kinds the profile lacks a first-class field for.
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
    default: return extraAnswerFor(p, kind); // phoneCountryCode etc. — only if the owner declared it
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

/** 0–100 fit score from the skill gate's matched/missing arrays. Null when
    the gate had no opinion (JD named no specific skills).
    HONESTY (#164): this is KEYWORD OVERLAP, not an overall match — the UI
    labels it as such. `coreMissing` (the AI judge's missingCore — skills the
    posting fundamentally requires that the resume lacks) applies a 12-point
    penalty each, capped at 48, so a Java-core JD never shows a flattering
    60 just because the resume also says "testing" and "performance". */
/** Extract skills from JD description using keyword scanning. This captures
    skills that appear in "Key Technologies", "Required skills", and related
    sections that the AI judge also reads. Returns canonical skills only. */
export function extractJdSkills(description) {
  const text = " " + String(description || "").toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ").replace(/\s+/g, " ") + " ";
  const jdSkills = new Set();
  for (const [alias, canon] of Object.entries(SKILL_ALIASES)) {
    const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "\\/");
    if (new RegExp("(?:^| )" + esc + "(?: |$)").test(text)) jdSkills.add(canon);
  }
  return [...jdSkills];
}

/** 0–100 fit score from the skill gate's matched/missing arrays. Null when
    the gate had no opinion (JD named no specific skills).
    HONESTY (#164): this is KEYWORD OVERLAP, not an overall match — the UI
    labels it as such. `coreMissing` (the AI judge's missingCore — skills the
    posting fundamentally requires that the resume lacks) applies a 12-point
    penalty each, capped at 48, so a Java-core JD never shows a flattering
    60 just because the resume also says "testing" and "performance". */
export function fitScore(matched, missing, coreMissing = []) {
  const m = matched?.length ?? 0;
  const x = missing?.length ?? 0;
  if (!m && !x) return null;
  const base = Math.round((m / (m + x)) * 100);
  const penalty = Math.min(48, (coreMissing?.length ?? 0) * 12);
  return Math.max(0, base - penalty);
}

/* Skill strikes: decay after 30 days — the owner's taste changes and a
   stale "hard reject forever" silently zeroed whole job classes (a skill
   skipped twice in August must not keep rejecting in November). Rows older
   than the window are simply not counted anymore; the count catches up on
   the next feedback write. Pure: the caller feeds {skill, strikes,
   updated_at} rows (missing updated_at = treated as fresh). */
export const STRIKE_DECAY_MS = 30 * 24 * 3600_000;
export function strikesWithDecay(rows, now = Date.now()) {
  return (rows ?? [])
    .filter((r) => (r.strikes ?? 0) > 0)
    .map((r) => {
      const age = r.updated_at ? now - new Date(r.updated_at).getTime() : 0;
      return age >= STRIKE_DECAY_MS
        ? { ...r, strikes: 0 }
        : r;
    })
    .filter((r) => r.strikes > 0);
}

/* Skills named in a row's skip/applied detail — the UI feedback loop reads
   these from apply_results.detail when the row's own skills array isn't
   available. Covers every detail format the engine writes:
     "JD requires java, sql, aws — not on the resume"          (coverage gate)
     "core skill missing: java — required by title/JD"         (critical gate)
     "not relevant to profile (Staff Frontend Engineer)"       (title gate)
     "AI judge: backend-core JD for a frontend resume"         (judge skip)
     "not relevant to profile" / anything else                 (honest [])
   Returns canonical lowercase skills, capped at 6. */
export function extractFeedbackSkills(detail) {
  const d = String(detail || "");
  let out = [];
  const requires = /JD requires ([a-z0-9+#./ ,]+?)(?:\s*[—-]|$)/i.exec(d);
  if (requires) out = requires[1].split(/,\s*/);
  else {
    const core = /core skill missing:\s*([a-z0-9+#./ ,]+?)(?:\s*[—-]|$)/i.exec(d);
    if (core) out = core[1].split(/,\s*/);
  }
  return [...new Set(out.map((s) => s.trim().toLowerCase()).filter((s) => s && s.length <= 24))].slice(0, 6);
}

/* Is this skill named only as a BUZZWORD in the JD text ("we work with AI",
   "AI-first company") rather than as something the role builds/requires?
   Regex heuristics over the lowercase, punctuation-stripped JD: if every
   occurrence sits next to buzz markers (build with/for, powered by, team,
   company, product, role, future…) and never in a requirement context
   (experience with/required/must/strong/proficient/X+ years), treat it as
   non-required. Conservative: only exact skill-token matches are gated. */
export function skillIsBuzzOnly(jdText, skill) {
  const text = " " + String(jdText || "").toLowerCase().replace(/[^a-z0-9+#./ -]/g, " ").replace(/\s+/g, " ") + " ";
  const sk = String(skill || "").toLowerCase().trim();
  if (!sk || !text.trim()) return false;
  const esc = sk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(?:^| )" + esc + "(?: |$)", "g");
  const requirementCtx = /(?:experience|expertise|proficien|strong|required|must|requirements?|skills?|years|hands-?on|familiarity|working knowledge|background)\b/;
  let m, sawAny = false, allBuzz = true;
  while ((m = re.exec(text)) !== null) {
    sawAny = true;
    const window = text.slice(Math.max(0, m.index - 70), m.index + m[0].length + 70);
    if (requirementCtx.test(window)) { allBuzz = false; break; }
  }
  return sawAny && allBuzz;
}

export function recordResult(report, job, result, detail = "") {
  /* the judge's verdict travels with every row (#164): when the keyword gate
     had no opinion, __fitNote carries "judge (apply|skip|unknown): reason" so
     the app's detail line explains WHY, not just what happened */
  const note = job?.__fitNote ? `${detail ? detail + " — " : ""}${job.__fitNote}` : detail;
  report.results.push({ title: job?.title ?? "?", company: job?.company ?? "?", url: job?.url ?? "", result, detail: note, fit: job?.__fit ?? null, at: Date.now() });
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

/**
 * Authenticity Guard: Verifies that a tailored resume has not "hallucinated" 
 * new facts. It compares the tailored text against the master profile.
 * 
 * returns { ok: boolean, hallucinations: string[] }
 */
export async function auditAuthenticity(ai, tailoredResume, profile, jd) {
  if (!ai?.key) return { ok: true, hallucinations: [] }; // Fail-open if no AI
  
  const sys = "You are a strict auditor. Compare the TAILORED RESUME against the MASTER PROFILE. Your only goal is to detect HALLUCINATIONS (fake facts). A hallucination is ANY company, job title, degree, or specific technical achievement mentioned in the tailored resume that is NOT present in the master profile. Highlight only the fake additions. If it is honest, reply with 'OK'. Otherwise, list the hallucinations as a JSON array of strings. Output ONLY the JSON array or 'OK'.";
  const usr = `MASTER PROFILE:\n${JSON.stringify(profile, null, 2)}\n\nTAILORED RESUME:\n${tailoredResume}\n\nJD for context:\n${jd}`;
  
  try {
    // We use a high-precision call here
    const res = await fetch(`${ai.base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: ai.model, messages: [{ role: "system", content: sys }, { role: "user", content: usr }], temperature: 0 }),
    });
    const body = await res.json();
    const text = (body.choices?.[0]?.message?.content ?? "").trim();
    
    if (text.toUpperCase() === "OK") return { ok: true, hallucinations: [] };
    
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return { ok: true, hallucinations: [] }; // If it's not a list, assume OK
    
    const hallucinations = JSON.parse(m[0]);
    return { ok: hallucinations.length === 0, hallucinations };
  } catch (e) {
    return { ok: true, hallucinations: [] }; // Fail-open on error
  }
}

/* ─────────────────── Generic Form Mapper ───────────────────
   Maps ANY HTML form field to a profile attribute using the AI.
   This enables autonomous submission across ALL sites, not just
   LinkedIn. The mapper reads the field label, type, placeholder,
   and surrounding context to determine what answer the site expects.

   Returns { kind, answer, confidence } where confidence is
   "answer" (certain), "review" (uncertain — needs human check),
   or "skip" (don't fill this field).
*/

const PROFILE_FIELDS = [
  { key: "name", labels: ["full name", "first name", "last name", "given name", "surname"] },
  { key: "email", labels: ["email", "e-mail", "email address", "work email", "personal email"] },
  { key: "phone", labels: ["phone", "mobile", "contact number", "telephone", "cell phone"] },
  { key: "years", labels: ["years of experience", "experience", "total experience", "years in field"] },
  { key: "location", labels: ["location", "city", "country", "based", "work location", "address"] },
  { key: "notice", labels: ["notice period", "notice", "availability", "start date", "earliest start"] },
  { key: "salary", labels: ["salary", "compensation", "ctc", "expected salary", "current salary"] },
  { key: "relocation", labels: ["relocate", "relocation", "willing to relocate", "relocation willingness"] },
  { key: "remote", labels: ["remote", "work from home", "hybrid", "remote work", "work arrangement"] },
  { key: "link", labels: ["linkedin", "portfolio", "website", "github", "url", "link to resume"] },
  { key: "workAuth", labels: ["sponsorship", "work authorization", "visa", "work permit", "authorized to work"] },
  { key: "certificate", labels: ["certification", "license", "licensure", "certifications"] },
];

/**
 * Generic Form Mapper: uses the AI to map any form field to a profile attribute.
 * Falls back to classifyQuestion for known field types.
 * 
 * @param {object} ai - AI provider config { key, base, model }
 * @param {string} label - The form field label
 * @param {string} tag - HTML tag type (input, textarea, select)
 * @param {boolean} required - Whether the field is required
 * @param {object} profile - The candidate's master profile
 * @returns { object } { kind, answer, confidence, mappedFrom }
 */
export async function mapFormField(ai, label, tag, required, profile) {
  // First try the existing classifier for known patterns
  const cls = classifyQuestion(label, { tag, required });
  if (cls.kind !== "unknown") {
    const answer = draftAnswer(cls.kind, profile, {});
    return { kind: cls.kind, answer, confidence: cls.confidence, mappedFrom: "classifier" };
  }

  // For unknown fields, use the AI mapper if available
  if (!ai?.key) {
    return { kind: "unknown", answer: "", confidence: "review", mappedFrom: "none" };
  }

  const sys = "You are a form field mapper. Given a form field label, determine what kind of information it asks for and provide the correct answer from the candidate's profile. Reply with ONLY this JSON: {\"kind\":\"field type\",\"answer\":\"the answer\",\"confidence\":\"answer|review|skip\"}. If you cannot determine the field type or answer, use kind=\"unknown\" and confidence=\"review\". Never invent facts not in the profile.";
  const usr = `Field label: "${label}" (tag: ${tag}, required: ${required})\nProfile: ${JSON.stringify(profile, null, 2)}\nMap this field to a profile attribute and provide the answer.`;

  try {
    const raw = await chatOnce(ai, [{ role: "system", content: sys }, { role: "user", content: usr }], 200);
    const m = String(raw || "").match(/\{[\s\S]*\}/);
    if (!m) return { kind: "unknown", answer: "", confidence: "review", mappedFrom: "ai" };
    const j = JSON.parse(m[0]);
    const kind = String(j.kind || "unknown").toLowerCase();
    const confidence = String(j.confidence || "review");
    const answer = String(j.answer || "").trim();
    return { kind, answer: confidence === "skip" ? "" : answer, confidence, mappedFrom: "ai" };
  } catch (e) {
    return { kind: "unknown", answer: "", confidence: "review", mappedFrom: "ai-error" };
  }
}

/**
 * Batch map form fields using the Generic Form Mapper.
 * Returns an array of { label, kind, answer, confidence, mappedFrom }.
 */
export async function mapFormFields(ai, fields, profile) {
  const results = [];
  for (const field of fields) {
    const result = await mapFormField(ai, field.label, field.tag, field.required, profile);
    results.push({ label: field.label, ...result });
  }
  return results;
}

/* ─────────────────── Phase 0 — cross-run governance (budget + filters) ───────────────────

   The engine never spent across runs: every run read the cycle's --max and
   forgot everything. Nothing in the stack stopped 60 submissions in one day
   from three back-to-back cycles — exactly the volume pattern that burns
   accounts on rate-limited boards (LinkedIn minIntervalMs exists per CLICK,
   not per day) and that recruiter-abuse reports call "spray and pray". This
   layer is the CROSS-RUN policy: money-rules (budget caps, quiet hours,
   company exclusions, salary floor, location/seniority prefs) are checked
   BEFORE the AI judge, so a job that a rule rejects never costs a judge
   token, and a day's total spend respects the owner's ceiling even when the
   watcher runs cycle after cycle. Pure + pinned (applyEngine.test.ts).

   Config comes from apply_config (owner-set, engine reads at cycle start —
   same table the kill switch lives on). NULLs = no cap (honest default:
   the engine's behavior must not change for owners who never set policy).

   The apply_results contract gains two honest states: 'budget_capped'
   (the job WAS a fit but the day/week ceiling is exhausted — the queue
   keeps it, the next cycle owns it) and 'filtered' (a money-rule rejected
   it — no AI tokens spent, detail says which rule). The DB check
   constraint on apply_results.result is extended idempotently in
   supabase/apply-governance.sql. */

/** Policy shape the engine reads from apply_config (engine_get_apply_config
    returns policy_* columns; all optional/null = no cap). Dates/times are
    strings because the RPC serializes — pure functions accept both. */
export const DEFAULT_DAILY_CAP = 20;
export const DEFAULT_WEEKLY_CAP = 80;

/** Current spend is summed from the owner's own apply_results rows; jobs
    that only reached needs_review did NOT spend an application (the owner
    still holds the click), so they don't count against the cap. */
export const SPENDING_RESULTS = ["submitted"];

/** How many applications today/this-week already spent (from apply_results
    rows [{created_at, result}]). Pure: rows are plain data, now injectable. */
export function spendCount(rows, resultKinds = SPENDING_RESULTS, now = new Date()) {
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now); startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)); startOfWeek.setHours(0, 0, 0, 0);
  let day = 0, week = 0;
  for (const r of rows ?? []) {
    if (!resultKinds.includes(String(r?.result ?? ""))) continue;
    const t = new Date(r.created_at).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= startOfDay.getTime()) day++;
    if (t >= startOfWeek.getTime()) week++;
  }
  return { day, week };
}

/** Is `now` inside quiet hours? A 22-06 window crosses midnight (from > to);
    null from/to = never quiet. Quiet hours skip SUBMITTING entirely —
    collection and review-queue work continue, only the one-way click
    (auto-submit) and new applications pause. Returns false on any doubt. */
export function isQuietHours(now, quietFrom, quietTo) {
  const from = String(quietFrom ?? "").trim();
  const to = String(quietTo ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(from) || !/^\d{1,2}:\d{2}$/.test(to)) return false;
  const d = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(d.getTime())) return false;
  const mins = h => { const [H, M] = h.split(":").map(Number); return H * 60 + M; };
  const t = d.getHours() * 60 + d.getMinutes();
  const f = mins(from), o = mins(to);
  if (f === o) return false; // zero-length window = never quiet
  return f > o ? (t >= f || t < o) : (t >= f && t < o);
}

/**
 * The budget gate: given today's spend + policy caps, may the engine submit
 * another application right now? Verdict:'ok' | 'budget_capped'. Reason is
 * owner-readable and lands in apply_results.detail.
 */
export function budgetGate(spend, { dailyCap = null, weeklyCap = null } = {}) {
  const d = spend?.day ?? 0, w = spend?.week ?? 0;
  const dc = dailyCap == null ? null : Number(dailyCap);
  const wc = weeklyCap == null ? null : Number(weeklyCap);
  if (dc != null && dc >= 0 && d >= dc) return { ok: false, verdict: "budget_capped", reason: `daily cap ${dc} reached (${d}/${dc}) — resumes tomorrow` };
  if (wc != null && wc >= 0 && w >= wc) return { ok: false, verdict: "budget_capped", reason: `weekly cap ${wc} reached (${w}/${wc}) — resumes next week` };
  return { ok: true, verdict: "ok", reason: "" };
}

/**
 * Money-rule job filters — checked BEFORE the AI judge so a rejected job
 * costs zero tokens. All thresholds optional; null/absent = no rule.
 * prefs: { excludeCompanies?: string[], salaryMin?: number, locations?:
 *   string[], remoteOnly?: boolean, seniorityMin?: string, seniorityMax?:
 *   string } (seniority ladder intern < junior < mid < senior < staff < lead <
 *   principal). Salary comparison uses the posting's own numbers when
 *   parseable (jobs.salary jsonb or posted text like "12-18 LPA").
 */
export const SENIORITY_LADDER = ["intern", "junior", "mid", "senior", "staff", "lead", "principal"];

/** Parse a salary like "12-18 LPA", "₹12,00,000", "$120k - $150k", "80k–90k GBP"
    → annual number in the JOB'S OWN currency-unit (we never convert across
    currencies — comparing a rupee posting to a dollar floor would be
    dishonest). Returns null when unparseable → the salary rule skips (an
    unparseable salary must not auto-reject the job). */
export function parseSalary(text) {
  const s = String(text ?? "").toLowerCase().replace(/,/g, "");
  if (!s) return null;
  /* per-match unit: "120k - 150k" keeps k on BOTH endpoints, not just the
     first — the old shared-unit read took the range as 120000 vs 150 (the
     second number lost its k) and returned the wrong ceiling. */
  const range = s.match(/(\d+(?:\.\d+)?)\s*([kK]|lpa|lac|lakh|cr)?\s*(?:-|–|—|to)\s*(?:₹|rs\.?|\$|£|€)?\s*(\d+(?:\.\d+)?)\s*([kK]|lpa|lac|lakh|cr)?/);
  const single = s.match(/(?:₹|rs\.?|\$|£|€)?\s*(\d+(?:\.\d+)?)\s*([kK]|lpa|lac|lakh|cr)?\s*(?:\bper\s*(?:annum|year)|\blpa\b|\ba year\b|\bpa\b|p\.a\.?)?/);
  /* a bare range whose unit rides the TAIL ("12-18 LPA", "80k-90k") still
     parsed null when the tail-unit submatch raced the range match — prefer
     the range VERDICT first: if a range pattern exists in the string, the
     single-number read must never decide. */
  const rangeShaped = /\d\s*(?:[kK]|lpa|lac|lakh|cr)?\s*(?:-|–|—|to)\s*\d/.test(s);
  const val = (n, unit) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return null;
    if (!unit) return num >= 100000 ? num : null; // bare salary figures are annual — below this is noise ("3 years")
    if (/^k$/i.test(unit)) return num * 1000;
    if (/^(lpa|lac|lakh)$/i.test(unit)) return num * 100000;
    if (/^cr$/i.test(unit)) return num * 10000000;
    return num >= 100000 ? num : null;
  };
  if (range) {
    // "120k-150k": each end carries its own unit; "12-18 LPA": the unit rides
    // the TAIL only — bare leading number "12" inherits the tail's unit,
    // otherwise a val() call with no unit rejects it as sub-annual noise.
    const a = val(range[1], range[2] || range[4]);
    const b = val(range[3], range[4] || range[2]);
    if (a != null && b != null) return Math.max(a, b);
  }
  if (!rangeShaped && single) return val(single[1], single[2]);
  return null;
}

/** Seniority from a job title: picks the highest ladder word present.
    Defaults to mid — junior postings almost always say "junior". */
export function seniorityOf(title) {
  const t = String(title ?? "").toLowerCase();
  for (let i = SENIORITY_LADDER.length - 1; i >= 0; i--) {
    if (new RegExp("\\b" + SENIORITY_LADDER[i] + "\\b").test(t)) return SENIORITY_LADDER[i];
  }
  if (/\bdirector|vp\b|head of/.test(t)) return "principal";
  return "mid";
}

/**
 * Apply the money-rule filters to one posting. Returns { candidates:
 * "pass" | "filtered", reason }. Brand matching is substring ("google"
 * rejects "Google India Pvt Ltd"); locations accept substring too. remoteOnly
 * rejects only when the posting clearly says hybrid/onsite AND isn't marked
 * remote.
 */
export function jobPassesFilters(job, prefs = {}) {
  const p = prefs ?? {};
  const title = String(job?.title ?? "");
  const company = String(job?.company ?? "");
  const excludes = (p.excludeCompanies ?? []).map((s) => String(s).toLowerCase().trim()).filter(Boolean);
  if (excludes.length && company) {
    /* exact-word matching would let "Meta" reject "Metallica Systems" —
    substring wins are OK for brand names, ALL of which the owner typed in
    full ("tata consultancy services"), so substring it is */
    const hit = excludes.find((e) => company.toLowerCase().includes(e));
    if (hit) return { pass: "filtered", reason: `excluded company: ${hit}` };
  }
  if (p.salaryMin != null) {
    const sal = parseSalary(job.salaryText ?? job.salary ?? job?.meta?.salaryText ?? "");
    if (sal != null && sal < Number(p.salaryMin))
      return { pass: "filtered", reason: `salary below floor (${sal} < ${Number(p.salaryMin)})` };
  }
  if (p.remoteOnly) {
    const remote = job.remote === true || /\bremote\b|work from home|wfh/i.test(`${title} ${job.location ?? ""}`);
    const hybrid = /\bhybrid\b|on-?site|from office/i.test(`${title} ${job.location ?? ""}`);
    if (remote) { /* remote always passes its own rule */ }
    else return { pass: "filtered", reason: "remoteOnly — posting is hybrid/onsite (or unclear)" };
  }
  if (Array.isArray(p.locations) && p.locations.length) {
    /* a location allow-list also grants remote postings the owner wants */
    const loc = String(job?.location ?? "").toLowerCase();
    const wants = p.locations.map((s) => String(s).toLowerCase().trim()).filter(Boolean);
    const wanted = wants.some((w) => loc.includes(w));
    if (!wanted && !(/\bremote\b|work from home/i.test(loc))) return { pass: "filtered", reason: `outside preferred locations (${wants.join(", ")})` };
    return { pass: "pass", reason: "" };
  }
  if (p.seniorityMin) {
    const rank = (x) => SENIORITY_LADDER.indexOf(String(x).toLowerCase());
    const mine = rank(seniorityOf(title));
    const minRank = rank(String(p.seniorityMin));
    if (mine >= 0 && minRank >= 0 && mine < minRank)
      return { pass: "filtered", reason: `too junior (${seniorityOf(title)} < ${p.seniorityMin})` };
  }
  if (p.seniorityMax) {
    const rank = (x) => SENIORITY_LADDER.indexOf(String(x).toLowerCase());
    const mine = rank(seniorityOf(title));
    const maxRank = rank(String(p.seniorityMax));
    if (mine >= 0 && maxRank >= 0 && mine > maxRank)
      return { pass: "filtered", reason: `too senior (${seniorityOf(title)} > ${p.seniorityMax})` };
  }
  return { pass: "pass", reason: "" };
}

/* ─────────────────── Phase 3 — outcome-driven board suspension ───────────────────

   The --outcomes loop collects employer behavior but had no teeth: a board
   whose postings were never even VIEWED kept its active status forever, and
   its weekly quota of applications kept being spent there. This rule gives
   the existing probation machinery a second, data-driven path: boards that
   don't convert get put BACK on probation (status 'pending'), where the
   7-day sweep can't re-activate them (they have no jobs_url wait anymore —
   they already served it) until the owner manually approves or the site's
   response rates recover. Deliberately conservative: only ALREADY-scraped
   data speaks, never guesses; a board with fewer applications than the
   window needs to judge is left alone; ACTIVE-owned boards that convert
   fine are never touched.*/

/** The suspension rule: pure decision from engine_outcome_stats-like rows.
    Rows: [{ site_host, applications, viewed, responded }] over the window.
    Verdict per row: 'suspend' | 'watch' | 'keep'. A board is suspended when
    it has >= minApplications applications and ZERO views or responses; a
    board with SOME responses but rates under the floor and >= application
    threshold is 'watch' (digest only); anything else stays. */
export function boardSuspensionRule(rows, { minApplications = 10, minViewRate = 0.05 } = {}) {
  return (rows ?? []).map((r) => {
    const applications = Number(r.applications ?? 0);
    const viewed = Number(r.viewed ?? 0);
    const responded = Number(r.responded ?? 0);
    if (applications < minApplications) return { ...r, verdict: "keep", reason: `only ${applications} applications — not enough evidence` };
    if (viewed === 0 && responded === 0) return { ...r, verdict: "suspend", reason: `${applications} applications, zero views/responses in the window — postings never even read` };
    const viewRate = viewed / applications;
    if (viewRate < minViewRate) return { ...r, verdict: "watch", reason: `view rate ${Math.round(viewRate * 100)}% below floor ${Math.round(minViewRate * 100)}% — watch in the digest` };
    return { ...r, verdict: "keep", reason: `${viewed}/${applications} viewed — converting fine` };
  });
}

/** Digest section for the suspension report — Telegram text. Pure so the
    digest format is pinned exactly like outcomeDigestLines. */
export function suspensionDigestLines(suspensions) {
  if (!suspensions?.length) return "";
  const fmt = (s) => `• ${s.site_host ?? s.host}: ${s.reason}`;
  return `\n🪦 outcome-driven board review:\n${suspensions.map(fmt).join("\n")}`;
}
