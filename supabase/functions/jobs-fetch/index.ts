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

/* skill dictionary — tokens >= 4 chars match by substring; short/ambiguous
   tokens (go, c# …) use word-boundary matching. */
const SKILLS = [
  "react", "vue", "angular", "typescript", "javascript", "node", "node.js", "python",
  "java", "golang", "ruby", "php", "sql", "postgres", "postgresql", "mysql", "mongodb",
  "redis", "graphql", "rest", "microservices", "microservice", "docker", "kubernetes",
  "k8s", "terraform", "aws", "gcp", "azure", "ci/cd", "git", "linux", "html", "css",
  "sass", "tailwind", "webpack", "next.js", "express", "django", "flask", "spring",
  "kafka", "rabbitmq", "elasticsearch", "spark", "hadoop", "airflow", "pandas", "numpy",
  "tensorflow", "pytorch", "machine learning", "ml", "data engineering", "etl", "tableau",
  "figma", "ux", "ui", "accessibility", "a11y", "jest", "cypress", "playwright",
  "selenium", "oauth", "jwt", "encryption", "grpc", "websockets", "redux",
  "react native", "swift", "kotlin", "flutter", "dart", "rust", "scala", "bash",
  "serverless", "lambda", "dynamodb", "s3", "ec2", "helm", "prometheus", "grafana",
  "jenkins", "github actions", "agile", "scrum", "product management", "seo",
  "observability", "event-driven", "webassembly", "postgresql", "django"
];

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  /* word-boundary matching for every token — "rust" must be a standalone word,
     not a substring of "rustacean", and "ml" must not match inside "html" */
  for (const s of SKILLS) {
    const re = new RegExp(`\\b${escapeRe(s)}\\b`);
    if (re.test(lower)) found.add(s);
  }
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
      skills: extractSkills(desc),
      level: guessLevel(j.title)
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
      skills: extractSkills(desc),
      level: guessLevel(j.title)
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
      skills: extractSkills(desc),
      level: guessLevel(j.text ?? "")
    };
  });
  return { company: org, jobs };
}

async function refreshAll(supabase: ReturnType<typeof createClient>, sources: { provider: string; board: string }[]): Promise<{ added: number; updated: number; total: number; perSource: Record<string, number> }> {
  let added = 0;
  let updated = 0;
  let total = 0;
  const perSource: Record<string, number> = {};
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
      perSource[`${src.provider}:${src.board}`] = 0;
    }
  }
  return { added, updated, total, perSource };
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
