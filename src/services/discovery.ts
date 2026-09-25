/* Discovery service (Phase 4 Item D4) — client layer over the D2 crawler's
   storage (discovery_seeds / discovered_resources, supabase/discovery.sql).

   Contracts carried over from scraper.ts:
   • graceful degradation — a pre-migration database reads as empty and never
     crashes a render (every read try/catches to [] / empty aggregates);
   • the fake-able client seam (`SupabaseClientLike`) so vitest can assert
     clause mapping without a live Supabase;
   • classify preview runs the SAME pure engine the crawler uses
     (scripts/discover-lib.js — zero-I/O, browser-safe), so what an admin
     sees in the preview is exactly what a crawl would do. */

import { getSupabaseClient } from "./cloud";
import { classifySeed, planDiscovery } from "../../scripts/discover-lib.js";
import { markerFromText } from "../../scripts/revalidate-lib.js";
import type { SupabaseClientLike } from "./scraper";

export type SeedStatus = "pending" | "approved" | "rejected";
export type ResourceStatus = "pending" | "approved" | "rejected";
export type SeedKind = "github-topic" | "github-repo" | "github-search" | "json" | "sitemap" | "html";

export interface DiscoverySeed {
  id: number;
  url: string;
  kind: SeedKind;
  origin: "manual" | "skill-auto";
  originDetail: string;
  status: SeedStatus;
  skill: string | null;
  note: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface DiscoveryAttribution {
  source?: string;
  kind?: string;
  url?: string;
  owner?: string;
  repo?: string;
  topic?: string;
  license?: string;
}

export interface DiscoveredResourceRow {
  id: number;
  url: string;
  title: string;
  kind: "resource" | "qa" | "problem";
  attribution: DiscoveryAttribution;
  license: string;
  status: ResourceStatus;
  /** true when the seed had no recognizable license — approval is a human
      licensing decision, never a routine content check (D2 contract). */
  needsLicenseReview: boolean;
  seedId: number | null;
  meta: Record<string, unknown>;
  createdAt: string;
  decidedAt: string | null;
}

export interface SeedDecision {
  ok: boolean;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Classify preview — the same engine the crawler runs                 */
/* ------------------------------------------------------------------ */

export interface SeedPreview {
  kind: SeedKind;
  url: string;
  host: string;
  plan: { action: string; note: string }[];
  attributionSource: string;
  licenseCheck: boolean;
}

/** Pure + synchronous: classifies a URL and returns the crawl plan the D2
    orchestrator would follow. Null-ish input / bad URL → error string. */
export function classifyUrlPreview(raw: string): { ok: true; preview: SeedPreview } | { ok: false; error: string } {
  const cls = classifySeed(raw);
  if (!cls) return { ok: false, error: "Enter a valid http(s) URL." };
  const plan = planDiscovery(cls);
  return {
    ok: true,
    preview: {
      kind: cls.kind,
      url: cls.url,
      host: cls.host,
      plan: (plan?.steps ?? []).map(s => ({ action: s.action, note: s.note ?? "" })),
      attributionSource: cls.attributionSource,
      licenseCheck: cls.licenseCheck
    }
  };
}

/* ------------------------------------------------------------------ */
/* Seeds — the approval queue IS the crawl trigger                     */
/* ------------------------------------------------------------------ */

/** Seeds newest-first, optionally filtered by status. [] on pre-migration DBs. */
export async function listDiscoverySeeds(status?: SeedStatus, limit = 100, client?: SupabaseClientLike): Promise<DiscoverySeed[]> {
  const c = (client ?? await getSupabaseClient()) as SupabaseClientLike | null;
  if (!c) return [];
  try {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    let q: any = (c.from("discovery_seeds") as any)
      .select("id, url, kind, origin, origin_detail, status, skill, note, created_at, decided_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q as { data: Record<string, unknown>[] | null; error: { message: string } | null };
    if (error) return [];
    return (data ?? []).map(r => ({
      id: Number(r.id),
      url: String(r.url),
      kind: String(r.kind) as SeedKind,
      origin: String(r.origin) === "skill-auto" ? "skill-auto" : "manual",
      originDetail: String(r.origin_detail ?? ""),
      status: String(r.status) as SeedStatus,
      skill: r.skill == null ? null : String(r.skill),
      note: String(r.note ?? ""),
      createdAt: String(r.created_at ?? ""),
      decidedAt: r.decided_at == null ? null : String(r.decided_at)
    }));
  } catch {
    return [];
  }
}

/** Admin decision on a seed. Approving schedules it for the crawler's next
    run (the approval gate is the crawl trigger); rejecting records why. */
export async function decideSeed(id: number, decision: "approved" | "rejected", note = "", client?: SupabaseClientLike): Promise<SeedDecision> {
  const c = (client ?? await getSupabaseClient()) as SupabaseClientLike | null;
  if (!c) return { ok: false, error: "Not connected" };
  try {
    const res = (await (c.from("discovery_seeds") as any)
      .update({ status: decision, note, decided_at: new Date().toISOString() })
      .eq("id", id)) as { error: { message: string } | null };
    return res.error ? { ok: false, error: res.error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** "Discover from URL" submit — inserts the seed as pending with the same
    kind the crawler would classify. unique(url) violation surfaces as a
    friendly "already queued" message. */
export async function addManualSeed(raw: string, client?: SupabaseClientLike): Promise<SeedDecision> {
  const cls = classifySeed(raw);
  if (!cls) return { ok: false, error: "Enter a valid http(s) URL." };
  const c = (client ?? await getSupabaseClient()) as SupabaseClientLike | null;
  if (!c) return { ok: false, error: "Not connected" };
  try {
    const res = (await (c.from("discovery_seeds") as any).insert({
      url: cls.url,
      kind: cls.kind,
      origin: "manual",
      origin_detail: "Admin Discover-from-URL",
      status: "pending"
    })) as { error: { message: string; code?: string } | null };
    if (!res.error) return { ok: true };
    if (res.error.code === "23505") return { ok: false, error: "That URL is already in the queue." };
    return { ok: false, error: res.error.message };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Resources — the L4 gate before anything surfaces publicly           */
/* ------------------------------------------------------------------ */

export interface ResourceFilter {
  status?: ResourceStatus;
  /** only rows whose seed had no recognizable license */
  needsLicenseReview?: boolean;
}

/** Pure: maps a ResourceFilter onto Supabase query clauses — (call, args)
    pairs, testable without a live client (mirrors runFilterClauses). */
export function resourceFilterClauses(f: ResourceFilter): { key: string; args: unknown[] }[] {
  const out: { key: string; args: unknown[] }[] = [];
  if (f.status) out.push({ key: "eq", args: ["status", f.status] });
  if (f.needsLicenseReview) out.push({ key: "eq", args: ["meta->>needs_license_review", "true"] });
  return out;
}

export async function listDiscoveredResources(filter: ResourceFilter = {}, limit = 100, client?: SupabaseClientLike): Promise<DiscoveredResourceRow[]> {
  const c = (client ?? await getSupabaseClient()) as SupabaseClientLike | null;
  if (!c) return [];
  try {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    let q: any = (c.from("discovered_resources") as any)
      .select("id, url, title, kind, attribution, license, status, seed_id, meta, created_at, decided_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    for (const clause of resourceFilterClauses(filter)) q = q[clause.key](...clause.args);
    const { data, error } = await q as { data: Record<string, unknown>[] | null; error: { message: string } | null };
    if (error) return [];
    return (data ?? []).map(mapResourceRow);
  } catch {
    return [];
  }
}

function mapResourceRow(r: Record<string, unknown>): DiscoveredResourceRow {
  const meta = (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>;
  return {
    id: Number(r.id),
    url: String(r.url),
    title: String(r.title),
    kind: (["resource", "qa", "problem"].includes(String(r.kind)) ? String(r.kind) : "resource") as DiscoveredResourceRow["kind"],
    attribution: (r.attribution && typeof r.attribution === "object" ? r.attribution : {}) as DiscoveryAttribution,
    license: String(r.license ?? "unknown"),
    status: String(r.status) as ResourceStatus,
    needsLicenseReview: meta.needs_license_review === true || meta.needs_license_review === "true",
    seedId: r.seed_id == null ? null : Number(r.seed_id),
    meta,
    createdAt: String(r.created_at ?? ""),
    decidedAt: r.decided_at == null ? null : String(r.decided_at)
  };
}

/** Admin decision on a discovered resource. The decision note is merged into
    meta (decision_note) — jsonb updates replace the whole value, so the
    caller's existing meta rides along and nothing is lost. On APPROVAL the
    resource's page head is fingerprinted into meta.contentMarker so the L5
    weekly re-validation can detect content drift (best-effort: a failed or
    blocked fetch stores no marker and L5 passes on reachability alone). */
export async function decideResource(
  id: number,
  decision: "approved" | "rejected",
  existingMeta: Record<string, unknown> = {},
  note = "",
  resourceUrl?: string,
  client?: SupabaseClientLike
): Promise<SeedDecision> {
  const c = (client ?? await getSupabaseClient()) as SupabaseClientLike | null;
  if (!c) return { ok: false, error: "Not connected" };
  const meta = { ...existingMeta };
  if (note.trim()) meta.decision_note = note.trim();
  if (decision === "approved" && resourceUrl && !meta.contentMarker) {
    try {
      const res2 = await fetch(resourceUrl, {
        headers: { "User-Agent": "InterviewIQGuard/1.0 (content marker at approval)" },
        signal: AbortSignal.timeout(8000)
      });
      if (res2.ok) {
        const marker = markerFromText(await res2.text());
        if (marker) meta.contentMarker = marker;
      }
    } catch { /* marker capture is best-effort — approval never fails on it */ }
  }
  try {
    const res = (await (c.from("discovered_resources") as any)
      .update({ status: decision, meta, decided_at: new Date().toISOString() })
      .eq("id", id)) as { error: { message: string } | null };
    return res.error ? { ok: false, error: res.error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Credits — the public, aggregated attribution feed                   */
/* ------------------------------------------------------------------ */

export interface CreditSource {
  /** attribution.source (host / "github") */
  source: string;
  url: string;
  kind: string;
  owner?: string;
  repo?: string;
  topic?: string;
  license: string;
  /** approved resources attributed to this source */
  count: number;
}

export interface DiscoveryCredits {
  sources: CreditSource[];
  total: number;
}

/** Aggregates approved resources by attribution source — the data behind the
    "Sources & credits" page and the Counselor community card. Reads the
    public view (discovered_resources_public) so it works for signed-out
    visitors; [] on pre-migration DBs. */
export async function discoveryCredits(client?: SupabaseClientLike): Promise<DiscoveryCredits> {
  const c = (client ?? await getSupabaseClient()) as SupabaseClientLike | null;
  if (!c) return { sources: [], total: 0 };
  try {
    const { data, error } = (await (c.from("discovered_resources_public") as any)
      .select("attribution, license")) as { data: Record<string, unknown>[] | null; error: { message: string } | null };
    if (error || !data?.length) return { sources: [], total: 0 };
    const byKey = new Map<string, CreditSource>();
    for (const row of data) {
      const a = (row.attribution && typeof row.attribution === "object" ? row.attribution : {}) as DiscoveryAttribution;
      const source = String(a.source ?? "unknown");
      /* credit grain: the repo when GitHub attribution is present, else the
         topic/host — per-link provenance lives on each resource row. */
      const creditKey = a.owner && a.repo ? `${a.owner}/${a.repo}` : a.topic ? `topic:${a.topic}` : String(a.url ?? "");
      const key = `${source}::${creditKey}`;
      const prev = byKey.get(key);
      if (prev) prev.count++;
      else byKey.set(key, {
        source,
        url: String(a.url ?? ""),
        kind: String(a.kind ?? "html"),
        owner: a.owner ? String(a.owner) : undefined,
        repo: a.repo ? String(a.repo) : undefined,
        topic: a.topic ? String(a.topic) : undefined,
        license: String(row.license ?? "unknown"),
        count: 1
      });
    }
    const sources = [...byKey.values()].sort((x, y) => y.count - x.count || x.source.localeCompare(y.source));
    return { sources, total: data.length };
  } catch {
    return { sources: [], total: 0 };
  }
}

/** Public, approved discovery resources for the Counselor "Community
    discovered" card (same view as credits; smallest read that renders it). */
export async function communityDiscovered(limit = 6, client?: SupabaseClientLike): Promise<DiscoveredResourceRow[]> {
  const c = (client ?? await getSupabaseClient()) as SupabaseClientLike | null;
  if (!c) return [];
  try {
    const { data, error } = (await (c.from("discovered_resources_public") as any)
      .select("id, url, title, kind, attribution, license, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)) as { data: Record<string, unknown>[] | null; error: { message: string } | null };
    if (error || !data?.length) return [];
    return data.map(r => ({
      ...mapResourceRow(r),
      status: "approved" as const,
      needsLicenseReview: false,
      seedId: null,
      meta: {},
      decidedAt: null
    }));
  } catch {
    return [];
  }
}
