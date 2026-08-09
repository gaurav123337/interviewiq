/* Admin-configurable question scraper. Sources + schedule live in Supabase
   (scraper_sources / scraper_config) and are edited from the Admin dashboard;
   the GitHub Actions cron runs the same pipeline server-side. The dashboard's
   "Run now" executes the identical fetch → extract → draft-insert pipeline
   from the browser, so admins see results without waiting for the cron. */

import { getSupabaseClient } from "./cloud";
import { extractItems } from "../../scripts/scrape-lib.js";

export interface ScraperSourceRow {
  id: string;
  url: string;
  type: "json" | "html" | "markdown";
  fieldId: string;
  level: string;
  maxItems: number;
  enabled: boolean;
  note: string;
}

export interface RunResult {
  sourceId: string;
  url: string;
  extracted: number;
  inserted: number;
  error?: string;
}

const DEFAULT_DAYS = [1]; /* Monday — matches the original weekly cron */

/* ------------------------------------------------------------------ */
/* Sources                                                            */
/* ------------------------------------------------------------------ */

export async function listScraperSources(): Promise<ScraperSourceRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("scraper_sources")
    .select("id, url, type, field_id, level, max_items, enabled, note")
    .order("id");
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(r => ({
    id: String(r.id), url: String(r.url),
    type: (String(r.type) as ScraperSourceRow["type"]) || "markdown",
    fieldId: String(r.field_id), level: String(r.level),
    maxItems: Number(r.max_items ?? 20), enabled: !!r.enabled, note: String(r.note ?? "")
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

/* ------------------------------------------------------------------ */
/* Schedule                                                           */
/* ------------------------------------------------------------------ */

/** ISO weekday numbers the scraper runs on (1=Mon … 7=Sun). */
export async function getScraperSchedule(): Promise<number[]> {
  const client = await getSupabaseClient();
  if (!client) return DEFAULT_DAYS;
  const { data, error } = await client.from("scraper_config").select("value").eq("key", "schedule").maybeSingle();
  if (error || !data) return DEFAULT_DAYS;
  const days = (data as { value: { days?: unknown } }).value?.days;
  if (!Array.isArray(days)) return DEFAULT_DAYS;
  const nums = days.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 7);
  return nums.length ? nums : DEFAULT_DAYS;
}

export async function saveScraperSchedule(days: number[]): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("scraper_config").upsert(
    { key: "schedule", value: { days }, updated_at: Date.now() },
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

  for (const s of sources.filter(x => x.enabled)) {
    const report: RunResult = { sourceId: s.id, url: s.url, extracted: 0, inserted: 0 };
    try {
      const res = await fetch(s.url, { headers: { "User-Agent": "interviewiq-scraper/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = s.type === "json" ? await res.json() : await res.text();
      const items = extractItems(body, {
        id: s.id, url: s.url, type: s.type, fieldId: s.fieldId, level: s.level,
        maxItems: s.maxItems, keyPoints: []
      }).slice(0, s.maxItems || 20);
      report.extracted = items.length;
      if (items.length) {
        const { error } = await client.from("published_questions").upsert(
          items.map(i => ({
            field_id: i.fieldId, level: i.level, question: i.question,
            answer: i.answer || "", key_points: i.keyPoints ?? [], published: false
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
  return results;
}
