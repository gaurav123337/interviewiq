/* Job-sites registry admin — the UI half of the self-discovering apply
   engine. Discovery (local engine) inserts sites with status 'pending';
   the owner approves them here, and only 'active' sites are driven by
   `auto-apply-jobs.js --all`. */

import { getSupabaseClient } from "./cloud.ts";

export interface JobSite {
  id: string;
  host: string;
  label: string;
  jobs_url: string | null;
  status: "pending" | "active" | "disabled" | "dead";
  source: "builtin" | "discovered" | "manual";
  rules: Record<string, unknown>;
  session_ok: boolean;
  last_run_at: string | null;
  last_submitted: number | null;
  last_collected: number | null;
  last_ok: boolean | null;
}

export async function listJobSites(): Promise<JobSite[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_list_job_sites");
  if (error) throw error;
  return (data ?? []) as JobSite[];
}

export async function setJobSiteStatus(id: string, status: JobSite["status"]): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.rpc("admin_set_job_site_status", { p_id: id, p_status: status });
  if (error) throw error;
}

export function summarizeSite(s: JobSite): string {
  if (s.last_run_at == null) return "never run";
  const when = new Date(s.last_run_at).toLocaleString();
  if (!s.last_ok) return `last run failed · ${when}`;
  return `${s.last_submitted ?? 0} submitted / ${s.last_collected ?? 0} seen · ${when}`;
}
