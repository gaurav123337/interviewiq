/* Admin-configurable question scraper. Sources + schedule live in Supabase
   (scraper_sources / scraper_config) and are edited from the Admin dashboard;
   the GitHub Actions cron runs the same pipeline server-side. The dashboard's
   "Run now" executes the identical fetch → extract → draft-insert pipeline
   from the browser, so admins see results without waiting for the cron. */

import { getSupabaseClient } from "./cloud";
import { extractItems } from "../../scripts/scrape-lib.js";

/** Minimal client surface for the run-report helpers — the real
    SupabaseClient satisfies it; tests pass fakes cast `as never`. */
export interface SupabaseClientLike {
  from(table: string): unknown;
}

export interface ScraperSourceRow {
  id: string;
  url: string;
  type: "json" | "html" | "markdown" | "company-list" | "hackernews";
  fieldId: string;
  level: string;
  maxItems: number;
  enabled: boolean;
  note: string;
  config?: Record<string, unknown>;
  /** Per-source schedule override — null means use global schedule */
  scheduleOverride?: { days: number[]; hour: number; minute: number } | null;
}

export interface RunResult {
  sourceId: string;
  url: string;
  extracted: number;
  inserted: number;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Run reports (Phase 4 Item B) — one scraper_runs row per run          */
/* ------------------------------------------------------------------ */

export type ScraperRunTrigger = "cron" | "manual";

export interface ScraperRunRow {
  id: number;
  ranAt: string;
  trigger: ScraperRunTrigger;
  status: "ok" | "partial" | "failed";
  perSource: Record<string, { url?: string; extracted?: number; inserted?: number; error?: string }>;
  inserted: number;
  errors: number;
}

export interface ScraperRunFilter {
  status?: ScraperRunRow["status"];
  trigger?: ScraperRunTrigger;
  /** ran_at >= from (ISO string) */
  from?: string;
  /** ran_at <= to (ISO string) */
  to?: string;
  /** ILIKE search over the per-source URLs */
  q?: string;
}

function runStatus(results: RunResult[]): ScraperRunRow["status"] {
  if (results.some(r => r.error)) return results.every(r => r.error) ? "failed" : "partial";
  return "ok";
}

/** Pure: maps a ScraperRunFilter onto Supabase query clauses — (call, args)
    pairs recorded against a chain so tests can assert clause mapping without
    a live client. Returns null when the filter would change nothing. */
export function runFilterClauses(f: ScraperRunFilter): { key: string; args: unknown[] }[] {
  const out: { key: string; args: unknown[] }[] = [];
  if (f.status) out.push({ key: "eq", args: ["status", f.status] });
  if (f.trigger) out.push({ key: "eq", args: ["trigger", f.trigger] });
  if (f.from) out.push({ key: "gte", args: ["ran_at", f.from] });
  if (f.to) out.push({ key: "lte", args: ["ran_at", f.to] });
  if (f.q) out.push({ key: "ilike", args: ["per_source::text", `%${f.q}%`] });
  return out;
}

/** Persists one run report. Tolerant of a pre-migration database (missing
    table → resolves false, never throws): run-reporting must never make the
    scrape itself look failed. */
export async function recordScraperRun(client: SupabaseClientLike, results: RunResult[], trigger: ScraperRunTrigger): Promise<boolean> {
  const perSource: ScraperRunRow["perSource"] = {};
  for (const r of results) {
    perSource[r.sourceId] = r.error
      ? { url: r.url, error: r.error }
      : { url: r.url, extracted: r.extracted, inserted: r.inserted };
  }
  try {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const res = (await (client.from("scraper_runs") as any).insert({
      trigger,
      status: runStatus(results),
      per_source: perSource,
      inserted: results.reduce((n, r) => n + r.inserted, 0),
      errors: results.filter(r => r.error).length
    })) as { error: { message: string } | null };
    return !res.error;
  } catch {
    return false;
  }
}

/** Reads run reports newest-first. All filters are optional; `limit` pages
    through the accordion ("Load more"). Tolerant of a missing table → []. */
export async function listScraperRuns(filter: ScraperRunFilter = {}, limit = 10, client?: SupabaseClientLike): Promise<ScraperRunRow[]> {
  const c = (client ?? await getSupabaseClient()) as SupabaseClientLike | null;
  if (!c) return [];
  try {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    let q: any = (c.from("scraper_runs") as any)
      .select("id, ran_at, trigger, status, per_source, inserted, errors")
      .order("ran_at", { ascending: false })
      .limit(limit);
    for (const clause of runFilterClauses(filter)) q = q[clause.key](...clause.args);
    const { data, error } = await q as { data: Record<string, unknown>[] | null; error: { message: string } | null };
    if (error) return []; /* pre-migration DB (missing table/column) → empty, not a crash */
    return (data ?? []).map((r) => ({
      id: Number(r.id),
      ranAt: String(r.ran_at),
      trigger: (String(r.trigger) === "cron" ? "cron" : "manual") as ScraperRunTrigger,
      status: (String(r.status) === "partial" || String(r.status) === "failed" ? String(r.status) : "ok") as ScraperRunRow["status"],
      perSource: (r.per_source && typeof r.per_source === "object" ? r.per_source : {}) as ScraperRunRow["perSource"],
      inserted: Number(r.inserted ?? 0),
      errors: Number(r.errors ?? 0)
    }));
  } catch {
    return []; /* same graceful-degradation contract as every other new read */
  }
}

/* ------------------------------------------------------------------ */
/* Sources                                                            */
/* ------------------------------------------------------------------ */

export async function listScraperSources(): Promise<ScraperSourceRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  let rows: Record<string, unknown>[] | null = null;
  let hasScheduleCol = true;
  const primary = await client.from("scraper_sources")
    .select("id, url, type, field_id, level, max_items, enabled, note, config, schedule_override")
    .order("id");
  if (primary.error) {
    hasScheduleCol = false;
    const fallback = await client.from("scraper_sources")
      .select("id, url, type, field_id, level, max_items, enabled, note, config")
      .order("id");
    if (fallback.error) return [];
    rows = fallback.data as Record<string, unknown>[];
  } else {
    rows = primary.data as Record<string, unknown>[];
  }
  return (rows ?? []).map(r => ({
    id: String(r.id), url: String(r.url),
    type: (String(r.type) as ScraperSourceRow["type"]) || "markdown",
    fieldId: String(r.field_id), level: String(r.level),
    maxItems: Number(r.max_items ?? 20), enabled: !!r.enabled, note: String(r.note ?? ""),
    config: (r.config && typeof r.config === "object" ? r.config as Record<string, unknown> : {}),
    scheduleOverride: hasScheduleCol && r.schedule_override && typeof r.schedule_override === "object" ? r.schedule_override as ScraperSourceRow["scheduleOverride"] : null
  }));
}

function slugify(url: string, idHint: string): string {
  const base = idHint.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (base) return base;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    return `src-${host}-${Date.now().toString(36)}`;
  } catch {
    return `src-${Date.now().toString(36)}`;
  }
}

export async function saveScraperSource(input: {
  id?: string; url: string; type: ScraperSourceRow["type"]; fieldId: string;
  level: string; maxItems: number; enabled?: boolean; note?: string;
}): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const id = input.id ?? slugify(input.url, input.fieldId + "-" + input.level);
  const { error } = await client.from("scraper_sources").upsert({
    id, url: input.url, type: input.type, field_id: input.fieldId,
    level: input.level, max_items: input.maxItems, enabled: input.enabled ?? true,
    note: input.note ?? "", updated_at: new Date().toISOString()
  }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function setScraperSourceEnabled(id: string, enabled: boolean): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("scraper_sources")
    .update({ enabled, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteScraperSource(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("scraper_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveScraperSourceSchedule(id: string, override: ScraperSourceRow["scheduleOverride"]): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("scraper_sources")
    .update({ schedule_override: override, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Schedule                                                           */
/* ------------------------------------------------------------------ */

/** ISO weekday numbers the scraper runs on (1=Mon … 7=Sun). */
export interface ScraperSchedule {
  days: number[];
  hour: number;  // 0-23 UTC
  minute: number; // 0-59
}

const DEFAULT_SCHEDULE: ScraperSchedule = { days: [1], hour: 3, minute: 0 };

export async function getScraperSchedule(): Promise<ScraperSchedule> {
  const client = await getSupabaseClient();
  if (!client) return DEFAULT_SCHEDULE;
  const { data, error } = await client.from("scraper_config").select("value").eq("key", "schedule").maybeSingle();
  if (error || !data) return DEFAULT_SCHEDULE;
  const v = (data as { value: Record<string, unknown> }).value;
  if (!v) return DEFAULT_SCHEDULE;
  const days = Array.isArray(v.days) ? v.days.map(Number).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 7) : [1];
  const hour = typeof v.hour === "number" && v.hour >= 0 && v.hour <= 23 ? v.hour : 3;
  const minute = typeof v.minute === "number" && v.minute >= 0 && v.minute <= 59 ? v.minute : 0;
  return { days: days.length ? days : [1], hour, minute };
}

export async function saveScraperSchedule(schedule: ScraperSchedule): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("scraper_config").upsert(
    { key: "schedule", value: schedule, updated_at: Date.now() },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Run now (browser-side pipeline — same as the cron, no PAT needed)   */
/* ------------------------------------------------------------------ */

/** Fetches every enabled source, extracts questions, and upserts drafts.
    Returns a per-source report. CORS-hostile sources fail gracefully. */
export async function runScraperNow(sources: ScraperSourceRow[]): Promise<RunResult[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const results: RunResult[] = [];
  const now = new Date();
  const currentDay = now.getUTCDay() || 7; // 1=Mon..7=Sun (ISO)
  const currentHour = now.getUTCHours();

  for (const s of sources.filter(x => x.enabled)) {
    // Per-source schedule override check
    if (s.scheduleOverride && s.scheduleOverride.days.length > 0) {
      const so = s.scheduleOverride;
      if (!so.days.includes(currentDay)) continue;
      if (so.hour !== undefined && Math.abs(currentHour - so.hour) > 1) continue;
    }
    const report: RunResult = { sourceId: s.id, url: s.url, extracted: 0, inserted: 0 };
    try {
      const res = await fetch(s.url, { headers: { "User-Agent": "interviewiq-scraper/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const isJson = s.type === "json" || s.type === "hackernews";
      const body = isJson ? await res.json() : await res.text();
      const items = extractItems(body, {
        id: s.id, url: s.url, type: s.type, fieldId: s.fieldId, level: s.level,
        maxItems: s.maxItems, keyPoints: [], ...(s.config ?? {})
      }).slice(0, s.maxItems || 20);
      report.extracted = items.length;
      if (items.length) {
        const { error } = await client.from("published_questions").upsert(
          items.map(i => ({
            field_id: i.fieldId, level: i.level, question: i.question,
            answer: i.answer || "", key_points: i.keyPoints ?? [],
            source_id: i.sourceId || s.id, source_url: i.sourceUrl || s.url,
            meta: i.meta ?? {}, published: false
          })),
          { onConflict: "question" }
        );
        if (error) throw new Error(error.message);
        report.inserted = items.length;
      }
    } catch (e) {
      report.error = (e as Error).message || "failed";
    }
    results.push(report);
  }
  /* Run reports are fire-and-forget: a missing scraper_runs table (or an RLS
     hiccup) must not make the scrape itself look failed. */
  await recordScraperRun(client, results, "manual").catch(() => false);
  return results;
}
