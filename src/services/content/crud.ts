/* CRUD operations — testimonials, ads, resources, tips, banners, positions */

import { getSupabaseClient } from "../cloud";
import { storageGet, storageSet } from "../storage";

import { type Testimonial, type Ad, type Resource, type TipConfig } from "./types";
import { CACHE, DEFAULT_ADS, DEFAULT_RESOURCES, DEFAULT_TESTIMONIALS, DEFAULT_TIPS, fetchFromDB, fetchSingleton } from "./cache";

export async function fetchTestimonials(): Promise<Testimonial[]> {
  return fetchFromDB<Testimonial>("admin_testimonials", CACHE.testimonials, DEFAULT_TESTIMONIALS, "sort_order");
}

export async function saveTestimonial(t: Testimonial): Promise<Testimonial> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    name: t.name,
    role: t.role,
    company: t.company,
    avatar: t.avatar,
    rating: t.rating,
    text: t.text,
    highlight: t.highlight || null,
    variant: t.variant || "all",
    published: t.published,
    sort_order: t.sort_order,
  };

  if (t.id && !t.id.startsWith("t")) {
    // Existing — update
    const { data, error } = await client.from("admin_testimonials").update({ ...row, updated_at: new Date().toISOString() }).eq("id", t.id).select().single();
    if (error) throw new Error(error.message);
    await refreshTestimonialCache();
    return data as Testimonial;
  } else {
    // New — insert
    const { data, error } = await client.from("admin_testimonials").insert(row).select().single();
    if (error) throw new Error(error.message);
    await refreshTestimonialCache();
    return data as Testimonial;
  }
}

export async function deleteTestimonial(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");
  const { error } = await client.from("admin_testimonials").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshTestimonialCache();
}

async function refreshTestimonialCache(): Promise<void> {
  const items = await fetchFromDB<Testimonial>("admin_testimonials", CACHE.testimonials, DEFAULT_TESTIMONIALS, "sort_order");
  storageSet(CACHE.testimonials, items);
}

// ---- Ads ----

export async function fetchAds(): Promise<Ad[]> {
  return fetchFromDB<Ad>("admin_ads", CACHE.ads, DEFAULT_ADS, "created_at");
}

export async function saveAd(a: Ad): Promise<Ad> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    title: a.title,
    description: a.description,
    sponsor: a.sponsor,
    image_url: a.image_url,
    link_url: a.link_url,
    bg_color: a.bg_color || "",
    text_color: a.text_color || "",
    position: a.position,
    start_date: a.start_date || null,
    end_date: a.end_date || null,
    published: a.published,
    auto_rotate: a.auto_rotate || false,
    rotate_interval: a.rotate_interval || 5,
  };

  if (a.id && !a.id.startsWith("ad")) {
    const { data, error } = await client.from("admin_ads").update({ ...row, updated_at: new Date().toISOString() }).eq("id", a.id).select().single();
    if (error) throw new Error(error.message);
    await refreshAdCache();
    return data as Ad;
  } else {
    const { data, error } = await client.from("admin_ads").insert(row).select().single();
    if (error) throw new Error(error.message);
    await refreshAdCache();
    return data as Ad;
  }
}

export async function deleteAd(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");
  const { error } = await client.from("admin_ads").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshAdCache();
}

async function refreshAdCache(): Promise<void> {
  const items = await fetchFromDB<Ad>("admin_ads", CACHE.ads, DEFAULT_ADS, "created_at");
  storageSet(CACHE.ads, items);
}

// ---- Resources ----

export async function fetchResources(): Promise<Resource[]> {
  return fetchFromDB<Resource>("admin_resources", CACHE.resources, DEFAULT_RESOURCES, "sort_order");
}

export async function saveResource(r: Resource): Promise<Resource> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    title: r.title,
    author: r.author,
    type: r.type,
    description: r.description,
    affiliate_url: r.affiliate_url,
    icon: r.icon,
    price: r.price,
    badge: r.badge || null,
    published: r.published,
    sort_order: r.sort_order,
  };

  if (r.id && !r.id.startsWith("r")) {
    const { data, error } = await client.from("admin_resources").update({ ...row, updated_at: new Date().toISOString() }).eq("id", r.id).select().single();
    if (error) throw new Error(error.message);
    await refreshResourceCache();
    return data as Resource;
  } else {
    const { data, error } = await client.from("admin_resources").insert(row).select().single();
    if (error) throw new Error(error.message);
    await refreshResourceCache();
    return data as Resource;
  }
}

export async function deleteResource(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");
  const { error } = await client.from("admin_resources").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await refreshResourceCache();
}

async function refreshResourceCache(): Promise<void> {
  const items = await fetchFromDB<Resource>("admin_resources", CACHE.resources, DEFAULT_RESOURCES, "sort_order");
  storageSet(CACHE.resources, items);
}

// ---- Tips ----

export async function fetchTips(): Promise<TipConfig> {
  return fetchSingleton<TipConfig>("admin_tips", CACHE.tips, DEFAULT_TIPS);
}

export async function saveTips(t: TipConfig): Promise<TipConfig> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud sync not configured");

  const row = {
    amounts: t.amounts,
    labels: t.labels,
    descriptions: t.descriptions,
    stripe_link: t.stripe_link,
    buymeacoffee_link: t.buymeacoffee_link,
    enabled: t.enabled,
  };

  if (t.id && t.id !== "default") {
    const { data, error } = await client.from("admin_tips").update({ ...row, updated_at: new Date().toISOString() }).eq("id", t.id).select().single();
    if (error) throw new Error(error.message);
    storageSet(CACHE.tips, data);
    return data as TipConfig;
  } else {
    const { data, error } = await client.from("admin_tips").insert(row).select().single();
    if (error) throw new Error(error.message);
    storageSet(CACHE.tips, data);
    return data as TipConfig;
  }
}

