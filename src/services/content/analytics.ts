/* Analytics tracking — clicks, impressions, summaries, daily analytics */

import { getSupabaseClient } from "../cloud";
import { storageSet } from "../storage"

import { type Ad, type Banner, type AnalyticsSummary, type ABTestResult, type DailyAnalytics } from "./types";
import { CACHE, fetchFromDB } from "./cache";
import { fetchAds } from "./crud";

/* Analytics — track clicks and impressions                            */
/* ------------------------------------------------------------------ */

export async function trackClick(entityType: "ad" | "resource" | "testimonial" | "banner", entityId: string, variant?: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return; // silently fail if offline

  try {
    await client.rpc("track_content_click", {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_variant: variant || null,
    });
  } catch {
    // Silent fail — analytics shouldn't block UX
  }
}

export async function trackImpression(entityType: "ad" | "resource" | "testimonial" | "banner", entityId: string, variant?: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) return;

  try {
    await client.rpc("track_content_impression", {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_variant: variant || null,
    });
  } catch {
    // Silent fail
  }
}

/** Fetch active ads for a specific position (for the landing page). */
export async function fetchAdsForPosition(position: Ad["position"]): Promise<Ad[]> {
  const allAds = await fetchAds();
  const now = new Date().toISOString().slice(0, 10);
  return allAds.filter(a => {
    if (a.position !== position) return false;
    if (a.start_date && a.start_date > now) return false;
    if (a.end_date && a.end_date < now) return false;
    return true;
  });
}

// ---- Banners ----

export async function fetchBanners(): Promise<Banner[]> {
  return fetchFromDB<Banner>("admin_banners", CACHE.banners, [], "created_at");
}

export async function saveBanner(b: Banner): Promise<Banner> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    title: b.title,
    subtitle: b.subtitle,
    cta_text: b.cta_text,
    cta_url: b.cta_url,
    image_url: b.image_url,
    bg_gradient: b.bg_gradient,
    text_color: b.text_color,
    position: b.position,
    published: b.published,
  };

  if (b.id && !b.id.startsWith("bn")) {
    const { data, error } = await client.from("admin_banners").update({ ...row, updated_at: new Date().toISOString() }).eq("id", b.id).select().single();
    if (error) throw new Error(error.message);
    await refreshBannerCache();
    return data as Banner;
  } else {
    const { data, error } = await client.from("admin_banners").insert(row).select().single();
    if (error) throw new Error(error.message);
    await refreshBannerCache();
    return data as Banner;
  }
}

export async function deleteBanner(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");
  const { error } = await client.from("admin_banners").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshBannerCache();
}

async function refreshBannerCache(): Promise<void> {
  const items = await fetchFromDB<Banner>("admin_banners", CACHE.banners, [], "created_at");
  storageSet(CACHE.banners, items);
}

/** Fetch active banners for a specific position. */
export async function fetchBannersForPosition(position: Banner["position"]): Promise<Banner[]> {
  const allBanners = await fetchBanners();
  return allBanners.filter(b => b.position === position);
}

// ---- Analytics Dashboard ----

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("admin_content_analytics_summary");
  if (error || !data) return [];
  return data as AnalyticsSummary[];
}

export async function fetchABTestResults(): Promise<ABTestResult[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("admin_ab_test_results");
  if (error || !data) return [];
  return data as ABTestResult[];
}

export async function fetchDailyAnalytics(): Promise<DailyAnalytics[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.rpc("admin_daily_analytics");
  if (error || !data) return [];
  return data as DailyAnalytics[];
}

