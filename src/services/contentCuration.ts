/* Content Curation Service — CRUD for content sources and items,
   admin review actions, stats queries. Client-side only (runs in browser). */

import { getSupabaseClient } from "./cloud";

/* ── Types ─────────────────────────────────────────────────────────────── */

export interface ContentSourceRow {
  id: string;
  url: string;
  domain: string;
  name: string;
  sourceType: string;
  fieldId: string;
  enabled: boolean;
  domainReputation: number;
  lastScrapedAt: string | null;
  scrapeCount: number;
}

export interface ContentItemRow {
  id: string;
  sourceId: string;
  sourceUrl: string;
  sourceName: string;
  domain: string;
  title: string;
  content: string;
  summary: string | null;
  author: string | null;
  publishedDate: string | null;
  qualityScore: number | null;
  accuracyScore: number | null;
  relevanceScore: number | null;
  depthScore: number | null;
  freshnessScore: number | null;
  credibilityScore: number | null;
  qualityNotes: string | null;
  qualityCheckedAt: string | null;
  status: "pending" | "approved" | "rejected" | "archived";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  fieldId: string;
  tags: string[];
  contentType: string;
  /** pdf_documents.id of the KB doc indexed from this item, or null. Resolved by a
      reverse lookup on pdf_documents.content_item_id (D5) — the item no longer stores
      the link itself (the legacy content_items.rag_document_id is deprecated). */
  ragDocumentId: number | null;
  createdAt: string;
}

export interface ContentStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  avgQuality: number | null;
  topSources: { name: string; count: number; avgQuality: number | null }[];
}

/* ── Sources ───────────────────────────────────────────────────────────── */

export async function listContentSources(): Promise<ContentSourceRow[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("content_sources")
    .select("*")
    .order("name");
  if (error) return [];
  return (data ?? []).map(r => ({
    id: String(r.id),
    url: String(r.url),
    domain: String(r.domain),
    name: String(r.name),
    sourceType: String(r.source_type),
    fieldId: String(r.field_id),
    enabled: !!r.enabled,
    domainReputation: Number(r.domain_reputation ?? 7),
    lastScrapedAt: r.last_scraped_at ?? null,
    scrapeCount: Number(r.scrape_count ?? 0),
  }));
}

export async function saveContentSource(input: {
  id?: string;
  url: string;
  name: string;
  sourceType: string;
  fieldId: string;
  domainReputation?: number;
  enabled?: boolean;
}): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const domain = (() => { try { return new URL(input.url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })();
  const id = input.id ?? `${domain.replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
  const { error } = await client.from("content_sources").upsert({
    id,
    url: input.url,
    domain,
    name: input.name,
    source_type: input.sourceType,
    field_id: input.fieldId,
    domain_reputation: input.domainReputation ?? 7,
    enabled: input.enabled ?? true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) throw error;
}

export async function toggleContentSource(id: string, enabled: boolean): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("content_sources").update({ enabled, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteContentSource(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("content_sources").delete().eq("id", id);
  if (error) throw error;
}

/* ── Content Items ─────────────────────────────────────────────────────── */

export async function listContentItems(params: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: ContentItemRow[]; total: number }> {
  const client = await getSupabaseClient();
  if (!client) return { items: [], total: 0 };

  const { status = "pending", limit = 50, offset = 0 } = params;

  let query = client.from("content_items").select("*", { count: "exact" });
  if (status !== "all") query = query.eq("status", status);
  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return { items: [], total: 0 };

  /* Resolve the RAG link with a reverse lookup on pdf_documents.content_item_id
     (D5) rather than reading a column off the item. A separate query keeps the
     list resilient: if the FK/columns aren't migrated yet the lookup just yields
     no links (no badges) instead of failing the whole page, which a PostgREST
     embed on an unknown relationship would. */
  const rows = data ?? [];
  const linkByItem = new Map<string, number>();
  if (rows.length) {
    const ids = rows.map(r => String(r.id));
    const { data: docs } = await client
      .from("pdf_documents")
      .select("id, content_item_id")
      .in("content_item_id", ids);
    for (const d of (docs ?? []) as { id: number; content_item_id: string | null }[]) {
      if (d.content_item_id) linkByItem.set(String(d.content_item_id), d.id);
    }
  }

  return {
    items: rows.map(r => ({
      id: String(r.id),
      sourceId: String(r.source_id),
      sourceUrl: String(r.source_url),
      sourceName: String(r.source_name),
      domain: String(r.domain),
      title: String(r.title),
      content: String(r.content),
      summary: r.summary ?? null,
      author: r.author ?? null,
      publishedDate: r.published_date ?? null,
      qualityScore: r.quality_score != null ? Number(r.quality_score) : null,
      accuracyScore: r.accuracy_score != null ? Number(r.accuracy_score) : null,
      relevanceScore: r.relevance_score != null ? Number(r.relevance_score) : null,
      depthScore: r.depth_score != null ? Number(r.depth_score) : null,
      freshnessScore: r.freshness_score != null ? Number(r.freshness_score) : null,
      credibilityScore: r.credibility_score != null ? Number(r.credibility_score) : null,
      qualityNotes: r.quality_notes ?? null,
      qualityCheckedAt: r.quality_checked_at ?? null,
      status: r.status as ContentItemRow["status"],
      reviewedBy: r.reviewed_by ?? null,
      reviewedAt: r.reviewed_at ?? null,
      reviewNotes: r.review_notes ?? null,
      fieldId: String(r.field_id),
      tags: Array.isArray(r.tags) ? r.tags : [],
      contentType: String(r.content_type),
      ragDocumentId: linkByItem.get(String(r.id)) ?? null,
      createdAt: r.created_at,
    })),
    total: count ?? 0,
  };
}

export async function reviewContentItem(
  id: string,
  status: "approved" | "rejected",
  notes?: string,
): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("content_items").update({
    status,
    reviewed_at: new Date().toISOString(),
    review_notes: notes ?? null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function bulkReviewItems(
  ids: string[],
  status: "approved" | "rejected",
): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("content_items").update({
    status,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).in("id", ids);
  if (error) throw error;
}

/* ── Stats ─────────────────────────────────────────────────────────────── */

export async function getContentStats(): Promise<ContentStats> {
  const client = await getSupabaseClient();
  if (!client) return { total: 0, pending: 0, approved: 0, rejected: 0, avgQuality: null, topSources: [] };

  const [allResult, pendingResult, approvedResult, rejectedResult] = await Promise.all([
    client.from("content_items").select("id", { count: "exact", head: true }),
    client.from("content_items").select("id", { count: "exact", head: true }).eq("status", "pending"),
    client.from("content_items").select("id", { count: "exact", head: true }).eq("status", "approved"),
    client.from("content_items").select("id", { count: "exact", head: true }).eq("status", "rejected"),
  ]);

  const { data: avgData } = await client
    .from("content_items")
    .select("quality_score")
    .not("quality_score", "is", null)
    .limit(1000);

  const avgQuality = avgData?.length
    ? avgData.reduce((s, r) => s + Number(r.quality_score), 0) / avgData.length
    : null;

  const { data: sourceData } = await client
    .from("content_items")
    .select("source_name, quality_score")
    .limit(1000);

  const sourceMap = new Map<string, { count: number; totalQuality: number; qualityCount: number }>();
  for (const r of sourceData ?? []) {
    const existing = sourceMap.get(r.source_name) ?? { count: 0, totalQuality: 0, qualityCount: 0 };
    existing.count++;
    if (r.quality_score != null) {
      existing.totalQuality += Number(r.quality_score);
      existing.qualityCount++;
    }
    sourceMap.set(r.source_name, existing);
  }

  const topSources = [...sourceMap.entries()]
    .map(([name, s]) => ({
      name,
      count: s.count,
      avgQuality: s.qualityCount > 0 ? Math.round(s.totalQuality / s.qualityCount) : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total: allResult.count ?? 0,
    pending: pendingResult.count ?? 0,
    approved: approvedResult.count ?? 0,
    rejected: rejectedResult.count ?? 0,
    avgQuality: avgQuality != null ? Math.round(avgQuality) : null,
    topSources,
  };
}
