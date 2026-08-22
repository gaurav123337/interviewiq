/* Admin config writes — remote config, job salary enrichment, fetch reports.
   RLS enforces is_admin server-side for every write. */

import { getSupabaseClient } from "../cloud";
import { type RemoteConfig } from "../remoteConfig";
import { refreshAdminData } from "./state";

export async function saveRemoteConfig(patch: Partial<RemoteConfig>): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const now = Date.now();
  const rows = Object.entries(patch)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => ({ key, value, updated_at: now }));
  if (!rows.length) return;
  const { error } = await client.from("app_config").upsert(rows, { onConflict: "key" });
  if (error) throw new Error(error.message);
  await refreshAdminData();
}

/** Job salary enrichment — separate app_config row so jobs-fetch can read it. */
export async function saveJobSalaryEnrichment(cfg: { provider: string; country: string; cap: number }): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { error } = await client.from("app_config").upsert(
    { key: "job_salary_enrichment", value: cfg, updated_at: Date.now() },
    { onConflict: "key" }
  );
  if (error) throw new Error(error.message);
}

/** Latest jobs-fetch refresh report. */
export interface JobsFetchReport {
  id: number;
  ran_at: string;
  added: number;
  updated: number;
  total: number;
  per_source: Record<string, number>;
  errors: Record<string, string>;
}

export async function getLastJobsFetchReport(): Promise<JobsFetchReport | null> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Cloud not configured");
  const { data, error } = await client
    .from("jobs_fetch_reports")
    .select("id, ran_at, added, updated, total, per_source, errors")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as JobsFetchReport | null;
}
