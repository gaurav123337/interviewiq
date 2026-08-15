/* Server-side recommendations digest composer — a faithful port of the
   client's match engine (src/services/jobs.ts: matchJob / rankCompanies /
   skillImpact / recommendationsDigest) so the weekly cron emails users the
   SAME numbers the app's Best-fit card shows. Pure + Deno-free so the client
   test-suite can exercise the exact code the cron runs (parity test). */

export type Verdict = "strong" | "good" | "moderate" | "stretch" | "no";

export type Profile = {
  headline?: string;
  years: number;
  location?: string;
  remote?: boolean;
  workAuth?: string;
  targetTitles?: string[];
  skills: string[];
  summary?: string;
};

export type Job = {
  title: string;
  company: string;
  location?: string;
  remote?: boolean;
  level?: string | null;
  skills: string[];
};

export type Match = {
  score: number;
  verdict: Verdict;
  matched: string[];
  missing: string[];
  blockers: string[];
};

export type Rank = {
  company: string;
  score: number;
  verdict: Verdict;
  openings: number;
  best: Job;
  matched: string[];
  missing: string[];
};

/* ------------------------------------------------------------------ */
/* Verdict labels                                                      */
/* ------------------------------------------------------------------ */

export const VERDICT_META: Record<Verdict, { label: string }> = {
  strong: { label: "Strong match" },
  good: { label: "Good fit" },
  moderate: { label: "Moderate" },
  stretch: { label: "Stretch" },
  no: { label: "Not recommended" }
};

/* ------------------------------------------------------------------ */
/* Domain classification — the gate that keeps Sales roles from ever    */
/* looking like "Good fit" for an engineer. Mirrors the client table.   */
/* ------------------------------------------------------------------ */

const DOMAIN_RULES: [string, string, RegExp][] = [
  ["data", "Data", /data scientist|data analyst|data engineer|analytics|machine learning|business intelligence|bi engineer/],
  ["design", "Design", /product designer|ux designer|ui designer|designer|creative/],
  ["product", "Product & Program", /product manager|product owner|program manager|technical program manager/],
  ["marketing", "Marketing", /marketing|growth|brand|content|seo|campaign|media|social|communications|comms/],
  ["finance", "Finance", /finance|accounting|controller|compensation|payroll|audit|tax|fp&a|financial/],
  ["legal", "Legal", /legal|counsel|paralegal|compliance|privacy|litigation/],
  ["hr", "People & HR", /recruit|people|talent|human resources|employee|hr/],
  ["sales", "Sales & BD", /sales|business development|account executive|account manager|partnerships|revenue|go.to.market/],
  ["ops", "Operations", /operations|vendor|support|logistics|procurement|facilities/],
  ["software", "Engineering", /software|engineer|developer|programmer|front.?end|back.?end|full.?stack|devops|sre|site reliability|platform|infrastructure|security|mobile|ios|android|qa|quality|automation|sdet|test|web/]
];

function inferDomain(text: string): string {
  const t = (text ?? "").toLowerCase();
  for (const [id, , re] of DOMAIN_RULES) if (re.test(t)) return id;
  return "other";
}

/* ------------------------------------------------------------------ */
/* Skill normalization — mirrors the client tokenizer                   */
/* ------------------------------------------------------------------ */

const tokens = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9+#]/g, " ").trim().split(/\s+/).filter(Boolean);

const matchSkill = (a: string, b: string): boolean => {
  const at = tokens(a);
  const bt = tokens(b);
  if (at.some(t => bt.includes(t))) return true;
  const singular = (arr: string[]) => arr.map(t => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
  return singular(at).some(t => singular(bt).includes(t));
};

/* ------------------------------------------------------------------ */
/* Seniority fit                                                       */
/* ------------------------------------------------------------------ */

const LEVEL_ORDER: Record<string, number> = { junior: 0, mid: 1, senior: 2, lead: 3, principal: 4 };

const profileLevel = (years: number): keyof typeof LEVEL_ORDER =>
  years >= 8 ? "principal" : years >= 5 ? "senior" : years >= 2 ? "mid" : "junior";

const LEVEL_WORDS = new Set(["senior", "junior", "staff", "lead", "principal", "director", "manager", "head", "intern", "mid", "entry", "sr"]);

function levelFit(profile: Profile, level: string | null): [number, string | null] {
  if (!level || !(level in LEVEL_ORDER)) return [8, null];
  const diff = LEVEL_ORDER[level] - LEVEL_ORDER[profileLevel(profile.years)];
  if (diff >= 1) return [15, null];
  if (diff === 0) return [12, null];
  if (diff === -1) return [5, null];
  return [2, `Below your seniority (role targets ${level}, you're at ${profileLevel(profile.years)})`];
}

/* ------------------------------------------------------------------ */
/* matchJob — exact port of the client scorer                          */
/* ------------------------------------------------------------------ */

export function matchJob(profile: Profile | null, job: Job): Match {
  if (!profile) {
    return { score: 0, verdict: "no", matched: [], missing: job.skills, blockers: ["Complete your career profile to see a match verdict."] };
  }

  const own = profile.skills.map(s => s.trim()).filter(Boolean);
  const matched = job.skills.filter(s => own.some(p => matchSkill(p, s)));
  const missing = job.skills.filter(s => !own.some(p => matchSkill(p, s)));

  const blockers: string[] = [];
  let score = 0;
  let limited = false;

  const profileDomain = inferDomain([profile.headline ?? "", ...(profile.targetTitles ?? [])].join(" "));
  const jobDomain = inferDomain(job.title);
  const known = profileDomain !== "other" && jobDomain !== "other";
  const sameDomain = known && profileDomain === jobDomain;
  if (known && !sameDomain) {
    blockers.push(`Outside your field — this is a ${DOMAIN_RULES.find(([id]) => id === jobDomain)?.[1] ?? "other"} role`);
  }

  if (job.skills.length > 0) {
    score += (matched.length / job.skills.length) * 55;
  } else if (sameDomain) {
    score += 40;
  } else if (known) {
    limited = true;
  } else {
    score += 18;
    limited = true;
    blockers.push("Limited info — no skills extracted for this role");
  }

  const title = job.title.toLowerCase();
  const targetWords = new Set((profile.targetTitles ?? [])
    .flatMap(t => t.split(/\s+/))
    .map(w => w.toLowerCase())
    .filter(w => w.length > 3 && !LEVEL_WORDS.has(w)));
  score += [...targetWords].some(w => title.includes(w)) ? 12 : 0;

  const [lvlPts, lvlBlocker] = levelFit(profile, job.level ?? null);
  score += lvlPts;
  if (lvlBlocker) blockers.push(lvlBlocker);

  if (profile.remote) {
    if (job.remote) score += 10;
    else blockers.push("On-site role — you prefer remote");
  } else if ((profile.location ?? "").trim()) {
    const loc = profile.location!.trim().toLowerCase();
    const jobLoc = (job.location ?? "").toLowerCase();
    if (jobLoc && !job.remote && !jobLoc.includes(loc)) {
      blockers.push(`Role is in ${job.location} — not ${profile.location}`);
    }
  }

  if (known && !sameDomain) score = Math.min(score, 20);
  if (limited) score = Math.min(score, 40);

  score -= blockers.length * 6;
  /* a role well below your seniority can never dominate the rankings —
     mirror of the client engine (services/jobs.ts) */
  if (lvlBlocker) score = Math.min(score, 55);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const verdict: Verdict = score >= 75 ? "strong" : score >= 58 ? "good" : score >= 38 ? "moderate" : score >= 18 ? "stretch" : "no";
  return { score, verdict, matched, missing, blockers };
}

/* ------------------------------------------------------------------ */
/* rankCompanies — best role wins per company, descending               */
/* ------------------------------------------------------------------ */

export function rankCompanies(profile: Profile | null, jobs: Job[]): Rank[] {
  const grouped = new Map<string, Job[]>();
  for (const j of jobs) {
    const list = grouped.get(j.company);
    if (list) list.push(j);
    else grouped.set(j.company, [j]);
  }
  const ranks: Rank[] = [];
  for (const [company, list] of grouped) {
    let best: Job = list[0];
    let bestMatch: Match | null = null;
    let bestScore = -1;
    for (const j of list) {
      const m = matchJob(profile, j);
      if (m.score > bestScore) { bestScore = m.score; best = j; bestMatch = m; }
    }
    ranks.push({
      company,
      score: bestScore,
      verdict: bestMatch?.verdict ?? "no",
      openings: list.length,
      best,
      matched: bestMatch?.matched ?? [],
      missing: bestMatch?.missing ?? []
    });
  }
  ranks.sort((a, b) => b.score - a.score || b.openings - a.openings || a.company.localeCompare(b.company));
  return ranks;
}

/* ------------------------------------------------------------------ */
/* skillImpact — the "learn X → Y%" gain                                */
/* ------------------------------------------------------------------ */

export function skillImpact(profile: Profile | null, rank: Rank): { skill: string; from: number; to: number } | null {
  if (!profile) return null;
  const skill = rank.missing[0];
  if (!skill) return null;
  const boosted = matchJob({ ...profile, skills: [...new Set([...profile.skills, skill])] }, rank.best);
  if (boosted.score <= rank.score) return null;
  return { skill, from: rank.score, to: boosted.score };
}

/* ------------------------------------------------------------------ */
/* recommendationsDigest — the weekly email body                        */
/* ------------------------------------------------------------------ */

export function recommendationsDigest(profile: Profile | null, ranks: Rank[], top = 3): string {
  const picks = ranks.slice(0, top);
  if (!picks.length) {
    return "InterviewIQ — no companies to recommend yet. Upload a resume or save your career profile to rank companies.";
  }
  const impact = skillImpact(profile, picks[0]);
  const lines = [
    "InterviewIQ — weekly company recommendations",
    "",
    ...(profile ? [`Based on your profile: ${profile.headline || "—"} (${profile.years} yrs).`, ""] : []),
    ...picks.map((r, i) =>
      `${i + 1}. ${r.company} — ${r.score}% match (${VERDICT_META[r.verdict].label}) · ${r.openings} open role${r.openings === 1 ? "" : "s"} · best fit: ${r.best.title}`
    )
  ];
  if (impact) {
    lines.push("", `Biggest learnable gain: learn ${impact.skill} and ${picks[0].company} jumps from ${impact.from}% → ${impact.to}%.`);
  }
  if (picks[0].missing.length) {
    lines.push(`Closest gap for ${picks[0].company}: ${picks[0].missing.slice(0, 4).join(", ")}.`);
  }
  return lines.join("\n");
}

/** Compose the weekly recommendations digest for one user. Returns null when
    there's nothing worth emailing (no resume/profile or no jobs in the feed). */
export function composeRecommendationsDigest(profile: Profile | null, jobs: Job[]): string | null {
  if (!profile || !profile.skills?.length || !jobs.length) return null;
  return recommendationsDigest(profile, rankCompanies(profile, jobs), 3);
}

/* ------------------------------------------------------------------ */
/* India & startup focus                                               */
/* ------------------------------------------------------------------ */

/** Indian metro/region signals — matching on location text. */
const INDIA_LOCATION_RE = /india|bengaluru|bangalore|mumbai|delhi|hyderabad|pune|chennai|gurgaon|gurugram|noida|kolkata|ahmedabad|indore|kochi|chandigarh|jaipur/i;

/** Well-known Indian companies/startups, as a location-less fallback. */
const INDIA_COMPANIES = [
  "fampay", "cred", "groww", "razorpay", "swiggy", "zomato", "flipkart", "freshworks",
  "chargebee", "postman", "zepto", "meesho", "ola", "paytm", "upstox", "zerodha",
  "dream11", "myntra", "bigbasket", "nobroker", "apna", "sharechat", "unacademy",
  "byju", "ayu", "phonepe", "druva", "zoho", "infosys", "tcs", "wipro", "hcl",
  "technologies", "mindtree", "l&t", "tata", "mahindra", "reliance", "jio"
];

/** True when a posting targets the Indian market (or is remote, which is
    reachable from India). Used by the India digest + filter chip. */
export function isIndiaJob(job: Job): boolean {
  const loc = (job.location ?? "").toLowerCase();
  if (INDIA_LOCATION_RE.test(loc)) return true;
  const company = (job.company ?? "").toLowerCase().replace(/[^a-z0-9& ]/g, "");
  if (INDIA_COMPANIES.some(c => company.includes(c))) return true;
  return !!job.remote;
}

/** Compose the weekly 🇮🇳 India & startup digest. Same engine, filtered to
    the Indian market (locations, known Indian startups, and remote roles). */
export function composeIndiaDigest(profile: Profile | null, jobs: Job[]): string | null {
  if (!profile || !profile.skills?.length || !jobs.length) return null;
  const indiaJobs = jobs.filter(isIndiaJob);
  if (!indiaJobs.length) return null;
  const picks = rankCompanies(profile, indiaJobs).slice(0, 3);
  if (!picks.length) return null;
  const lines = [
    "InterviewIQ — weekly 🇮🇳 India & startup recommendations",
    "",
    ...(profile ? [`Based on your profile: ${profile.headline || "—"} (${profile.years} yrs).`, ""] : []),
    ...picks.map((r, i) =>
      `${i + 1}. ${r.company} — ${r.score}% match (${VERDICT_META[r.verdict].label}) · ${r.openings} open role${r.openings === 1 ? "" : "s"} · best fit: ${r.best.title}`
    )
  ];
  const impact = skillImpact(profile, picks[0]);
  if (impact) {
    lines.push("", `Biggest learnable gain: learn ${impact.skill} and ${picks[0].company} jumps from ${impact.from}% → ${impact.to}%.`);
  }
  return lines.join("\n");
}
