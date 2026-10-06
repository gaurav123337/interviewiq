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

export function judgeMessages(job, profile, exemplars = null) {
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
