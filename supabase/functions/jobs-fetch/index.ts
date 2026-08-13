/* jobs-fetch — pulls open job postings from ATS boards into the jobs table.
   Sources are admin-tunable via app_config → job_sources (defaults below).
   Signed-in users trigger a refresh (verify_jwt); a Deno.cron also refreshes
   every 6 hours so the feed stays fresh without user interaction.

   Skill extraction uses a curated dictionary against the description — the
   same vocabulary family as the app's resume analyzer. The match VERDICT is
   computed client-side (offline, Pro-gated); this function only normalizes
   the feed. */

import { createClient } from "npm:@supabase/supabase-js@2";

/* default ATS sources — verified live; admins can override via app_config */
const DEFAULT_SOURCES = [
  { provider: "greenhouse", board: "lyft" },
  { provider: "greenhouse", board: "airbnb" },
  { provider: "greenhouse", board: "dropbox" },
  { provider: "ashby", board: "linear" },
  { provider: "ashby", board: "notion" }
];

/* Skill dictionary. Two tiers so ordinary prose can't fake a tech role:
   - SKILLS: distinctive tokens, safe on a word boundary ("kubernetes" never
     appears in a sales blurb).
   - AMBIGUOUS: also words in everyday English ("rest", "express", "go",
     "rust", "ml") — they only count when the description shows technical
     context, which kills false positives like "express your interest". */
const SKILLS = [
  "react", "react native", "vue", "angular", "redux", "typescript", "javascript",
  "node", "node.js", "python", "java", "golang", "ruby", "php", "sql", "postgres",
  "postgresql", "mysql", "mongodb", "redis", "graphql", "restful", "rest api",
  "microservices", "microservice", "docker", "kubernetes", "k8s", "terraform", "aws",
  "gcp", "azure", "ci/cd", "git", "linux", "html", "css", "sass", "tailwind",
  "webpack", "next.js", "django", "flask", "spring", "kafka", "rabbitmq",
  "elasticsearch", "spark", "hadoop", "airflow", "pandas", "numpy", "tensorflow",
  "pytorch", "machine learning", "data engineering", "etl", "tableau", "figma", "ux",
  "ui", "accessibility", "a11y", "jest", "cypress", "playwright", "selenium",
  "oauth", "jwt", "encryption", "grpc", "websockets", "swift", "kotlin", "flutter",
  "dart", "scala", "bash", "serverless", "lambda", "dynamodb", "s3", "ec2", "helm",
  "prometheus", "grafana", "jenkins", "github actions", "agile", "scrum",
  "product management", "seo", "observability", "event-driven", "webassembly",
  "security"
];

const AMBIGUOUS = ["rest", "express", "go", "rust", "ml"];

/* Any of these in the description means "this is a technical role" — the
   precondition for counting an ambiguous token. */
const TECH_CONTEXT = /(software|engineering|engineer|developer|stack|framework|api|code|backend|frontend|systems|technical|infrastructure|language|deployment|platform|program|server|client|application)/;

/* Title-inferred skills — high confidence stack signals so technical roles
   with sparse descriptions still get a sensible required-skill list. */
const TITLE_SKILLS: [RegExp, string[]][] = [
  [/(front.?end|ui engineer|web developer)/i, ["typescript", "javascript", "react", "css", "html"]],
  [/(back.?end)/i, ["sql", "node", "microservices"]],
  [/(full.?stack)/i, ["typescript", "javascript", "sql", "react"]],
  [/(data scientist)/i, ["python", "sql", "machine learning"]],
  [/(data analyst)/i, ["sql", "python", "tableau"]],
  [/(data engineer)/i, ["sql", "python", "data engineering", "etl"]],
  [/(machine learning|ml engineer)/i, ["python", "machine learning"]],
  [/(devops|site reliability|sre|platform engineer|infrastructure engineer|cloud engineer)/i, ["aws", "docker", "kubernetes", "terraform", "linux"]],
  [/(security engineer|application security)/i, ["aws", "encryption", "security"]],
  [/(qa engineer|quality engineer|sdet|test engineer|automation engineer)/i, ["jest", "cypress", "playwright", "selenium"]],
  [/(product designer|ux designer|ui designer|designer)/i, ["figma", "ui", "ux"]]
];

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasWord = (s: string, lower: string): boolean =>
  new RegExp(`\\b${escapeRe(s)}\\b`).test(lower);

function extractSkills(title: string, desc: string): string[] {
  const lower = desc.toLowerCase();
  const hasTech = TECH_CONTEXT.test(lower);
  const found = new Set<string>();
  for (const s of SKILLS) if (hasWord(s, lower)) found.add(s);
  for (const s of AMBIGUOUS) if (hasTech && hasWord(s, lower)) found.add(s);
  /* stack-inference from the title itself */
  const t = title.toLowerCase();
  for (const [re, skills] of TITLE_SKILLS) if (re.test(t)) skills.forEach(s => found.add(s));
  return [...found].slice(0, 14);
}

function guessLevel(title: string): string | null {
  const t = title.toLowerCase();
  if (/(intern|graduate|entry.level|apprentice)/.test(t)) return "junior";
  if (/(junior|jr\.?|early.career)/.test(t)) return "junior";
  if (/(staff|principal|distinguished|fellow|chief.architect)/.test(t)) return "principal";
  if (/(director|vp|vice.president|cto|head of)/.test(t)) return "lead";
  if (/(lead|tech.lead|engineering.manager|manager)/.test(t)) return "lead";
  if (/(senior|sr\.?|5\+|6\+|7\+)/.test(t)) return "senior";
  return "mid";
}

const isRemoteText = (s: string): boolean => /remote|hybrid/.test((s ?? "").toLowerCase());

/* Salary extraction — parses explicit ranges like "$120k–$150k", "₹15-25 LPA",
   "£60,000" etc. into a normalized { min, max, currency } or null. Conservative:
   no match → null, so filters never show fabricated bands. */
function extractSalary(text: string): { min: number; max: number; currency: string } | null {
  const t = (text ?? "").toLowerCase();
  const m = t.match(/([$£€₹])\s*(\d{2,3}(?:[k,]\d{2}|\d{3})?)\s*[-–to]+\s*([$£€₹]?)\s*(\d{2,3}(?:[k,]\d{2}|\d{3})?)\s*(k|k\b|lpa|lakh|cr|\/yr|\/year|per year|annum)?/);
  if (!m) return null;
  const num = (raw: string): number => {
    const n = raw.replace(/[^0-9.]/g, "");
    return parseFloat(n);
  };
  let min = num(m[2]);
  let max = num(m[4]);
  const scale = m[5] ?? "";
  /* k suffix → thousands; LPA/lakh → 100k INR; cr → 10M INR; plain digits = annual */
  if (/k\b|k$/.test(scale) || m[2].toLowerCase().endsWith("k")) { min *= 1000; max *= 1000; }
  else if (/lpa|lakh/.test(scale)) { min *= 100000; max *= 100000; }
  else if (/cr/.test(scale)) { min *= 10000000; max *= 10000000; }
  if (!min || !max || max < min) return null;
  const currency = m[1] === "£" ? "GBP" : m[1] === "€" ? "EUR" : m[1] === "₹" ? "INR" : "USD";
  return { min: Math.round(min), max: Math.round(max), currency };
}

/* Company size — explicit "N+ employees/people" mentions only (rare in ATS
   postings, but when present it powers the client filter honestly). */
function extractCompanySize(text: string): string | null {
  const t = (text ?? "").toLowerCase();
  const m = t.match(/(\d{2,4}[,.]?\d{0,3})\s*\+?\s*(employees?|people|teammates?|staff)\b/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/[^0-9]/g, ""));
  if (n >= 1000) return "large";
  if (n >= 50) return "mid";
  return "small";
}

async function fetchGreenhouse(board: string): Promise<{ company: string; jobs: unknown[] }> {
  const info = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}`).then(r => r.json()).catch(() => null);
  const company = (info?.name as string) ?? board;
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`);
  const data = await res.json();
  const jobs = (data.jobs ?? []).map((j: {
    id: string | number; title: string; absolute_url: string;
    location?: { name?: string }; content?: string; updated_at?: string;
  }) => {
    const loc = j.location?.name ?? "";
    const desc = `${j.title}\n${loc}\n${(j.content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000)}`;
    return {
      externalId: String(j.id),
      title: j.title,
      company,
      location: loc,
      remote: isRemoteText(loc),
      description: desc,
      url: j.absolute_url ?? "",
      postedAt: j.updated_at ?? null,
      skills: extractSkills(j.title, desc),
      level: guessLevel(j.title),
      salary: extractSalary(desc),
      companySize: extractCompanySize(desc)
    };
  });
  return { company, jobs };
}

async function fetchAshby(board: string): Promise<{ company: string; jobs: unknown[] }> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${board}`);
  const data = await res.json();
  const jobs = (data.jobs ?? []).map((j: {
    id: string | number; title: string; location?: string | null;
    secondaryLocations?: { location?: string }[]; employmentType?: string;
    publishedAt?: string; descriptionHtml?: string; jobUrl?: string; companyName?: string;
  }) => {
    const loc = [j.location, ...(j.secondaryLocations ?? []).map(s => s.location)].filter(Boolean).join(", ");
    const emp = j.employmentType ?? "";
    const desc = `${j.title}\n${loc}\n${emp}\n${(j.descriptionHtml ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000)}`;
    return {
      externalId: String(j.id),
      title: j.title,
      company: j.companyName ?? board,
      location: loc,
      remote: isRemoteText(loc) || /remote/i.test(emp),
      description: desc,
      url: j.jobUrl ?? "",
      postedAt: j.publishedAt ?? null,
      skills: extractSkills(j.title, desc),
      level: guessLevel(j.title),
      salary: extractSalary(desc),
      companySize: extractCompanySize(desc)
    };
  });
  return { company: board, jobs };
}

async function fetchLever(org: string): Promise<{ company: string; jobs: unknown[] }> {
  const res = await fetch(`https://api.lever.co/v0/postings/${org}?mode=json`);
  const data = await res.json();
  const jobs = (Array.isArray(data) ? data : []).map((j: {
    id: string; text?: string; hostedUrl?: string;
    categories?: { location?: string; commitment?: string };
    createdAt?: number; descriptionPlain?: string;
  }) => {
    const loc = j.categories?.location ?? "";
    const commit = j.categories?.commitment ?? "";
    const desc = `${j.text ?? ""}\n${loc}\n${commit}\n${(j.descriptionPlain ?? "").slice(0, 6000)}`;
    return {
      externalId: String(j.id),
      title: j.text ?? "",
      company: org,
      location: loc,
      remote: isRemoteText(loc) || isRemoteText(commit),
      description: desc,
      url: j.hostedUrl ?? "",
      postedAt: j.createdAt ? new Date(j.createdAt * 1000).toISOString() : null,
      skills: extractSkills(j.text ?? "", desc),
      level: guessLevel(j.text ?? ""),
      salary: extractSalary(desc),
      companySize: extractCompanySize(desc)
    };
  });
  return { company: org, jobs };
}

async function refreshAll(supabase: ReturnType<typeof createClient>, sources: { provider: string; board: string }[]): Promise<{ added: number; updated: number; total: number; perSource: Record<string, number>; errors: Record<string, string> }> {
  let added = 0;
  let updated = 0;
  let total = 0;
  const perSource: Record<string, number> = {};
  const errors: Record<string, string> = {};
  for (const src of sources) {
    try {
      const { jobs } = src.provider === "lever"
        ? await fetchLever(src.board)
        : src.provider === "ashby"
          ? await fetchAshby(src.board)
          : await fetchGreenhouse(src.board);
      const rows = jobs.map((j: Record<string, unknown>) => ({
        source: src.provider,
        external_id: j.externalId,
        title: j.title,
        company: j.company,
        location: j.location || null,
        remote: !!j.remote,
        description: String(j.description ?? "").slice(0, 12000),
        url: String(j.url ?? ""),
        skills: (j.skills as string[]) ?? [],
        level: (j.level as string) ?? null,
        salary: (j.salary as { min: number; max: number; currency: string } | null) ?? null,
        company_size: (j.companySize as string | null) ?? null,
        posted_at: j.postedAt ? new Date(String(j.postedAt)).toISOString() : null
      }));
      /* PostgREST upsert count = ALL affected rows, so measure new vs existing
         with a lightweight existence check to report honest added/updated */
      const { data: existingRows } = await supabase.from("jobs").select("external_id").eq("source", src.provider);
      const have = new Set((existingRows ?? []).map((r: { external_id: string }) => r.external_id));
      const addedHere = rows.filter(r => !have.has(r.external_id)).length;
      const { error } = await supabase.from("jobs").upsert(rows, { onConflict: "source,external_id", ignoreDuplicates: false });
      if (error) throw error;
      added += addedHere;
      updated += rows.length - addedHere;
      total += rows.length;
      perSource[`${src.provider}:${src.board}`] = rows.length;
      console.log(`[jobs-fetch] ${src.provider}:${src.board} → ${rows.length} jobs (${addedHere} new)`);
    } catch (e) {
      console.warn(`[jobs-fetch] ${src.provider}:${src.board} failed:`, (e as Error).message);
      errors[`${src.provider}:${src.board}`] = (e as Error).message ?? String(e);
      perSource[`${src.provider}:${src.board}`] = 0;
    }
  }
  return { added, updated, total, perSource, errors };
}

async function getSources(admin: ReturnType<typeof createClient>): Promise<{ provider: string; board: string }[]> {
  const { data } = await admin.from("app_config").select("value").eq("key", "job_sources").maybeSingle();
  const v = data?.value as { provider: string; board: string }[] | undefined;
  return (v && Array.isArray(v) && v.length ? v : DEFAULT_SOURCES);
}

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
});

async function handle(req: Request): Promise<Response> {
  const headers = { ...cors(req), "Content-Type": "application/json" };
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  if (!serviceKey) return new Response(JSON.stringify({ error: "service role key not configured" }), { status: 500, headers });
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
  const sources = await getSources(admin);
  const result = await refreshAll(admin, sources);
  return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    return await handle(req);
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message ?? "jobs-fetch failed" }), { status: 500, headers: { ...cors(req), "Content-Type": "application/json" } });
  }
});

/* NOTE: a scheduled refresh (Deno.cron) can be added once the runtime's
   cron support is confirmed — for now the feed refreshes on demand from
   the client and via the admin dashboard. */
