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

/* ── Review queue: review-gate jobs the engine skipped in --unattended mode.
   The engine records them with the form URL; the owner finishes them here. */

export interface ReviewFormField {
  label: string;
  kind: string;
  required: boolean;
  answered: boolean;
}

export interface ReviewItem {
  id: string;
  site_host: string;
  job_url: string;
  title: string | null;
  company: string | null;
  form_url: string | null;
  reason: string | null;
  fit: number | null;
  form_fields: ReviewFormField[] | null;
  created_at: string;
}

export async function listJobReviews(): Promise<ReviewItem[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_list_job_reviews");
  if (error) throw error;
  return (data ?? []) as ReviewItem[];
}

export async function resolveJobReview(id: string, status: "done" | "dismissed" | "closed"): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.rpc("admin_resolve_job_review", { p_id: id, p_status: status });
  if (error) throw error;
}

/* ── Telegram notify config — PER-USER since #135 ──────────────────────
   Every signed-in Platinum/add-on user binds their own bot + chat id
   (RLS scopes the row to auth.uid()); the engine pings the entitled
   row via engine_notify_config(). Free users see the upsell instead. */

export interface NotifyConfig {
  chat_id: string | null;
  bot_token: string | null;
  updated_at: string | null;
}

export async function getNotifyConfig(): Promise<NotifyConfig | null> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.from("user_notify_config").select("chat_id, bot_token, updated_at").maybeSingle();
  if (error) throw error;
  return (data as NotifyConfig | null) ?? null;
}

export async function setNotifyConfig(chatId: string, botToken: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.from("user_notify_config").upsert({ chat_id: chatId, bot_token: botToken, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ── Apply mode control: off (kill switch) / local machine / cloud session ── */

export type ApplyMode = "off" | "local" | "cloud";

export interface ApplyConfig {
  mode: ApplyMode;
  cloud_provider: string | null;
  cloud_endpoint: string | null;
  updated_at: string | null;
}

export async function getApplyConfig(): Promise<ApplyConfig | null> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_get_apply_config");
  if (error) throw error;
  return ((data as ApplyConfig[]) ?? [])[0] ?? null;
}

/** CDP endpoint shape: ws/wss (vendors) or http(s) (local test servers). */
export function isValidCdpEndpoint(endpoint: string): boolean {
  return /^(wss?|https?):\/\//i.test(endpoint.trim());
}

export async function setApplyConfig(mode: ApplyMode, cloudProvider?: string, cloudEndpoint?: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.rpc("admin_set_apply_config", {
    p_mode: mode,
    p_cloud_provider: cloudProvider ?? null,
    p_cloud_endpoint: cloudEndpoint ?? null,
  });
  if (error) throw error;
}

/* ── Per-job run report: every decision the engine made, newest first ── */

export interface ApplyResultRow {
  id: string;
  site_host: string;
  job_url: string;
  title: string | null;
  company: string | null;
  result: "submitted" | "needs_review" | "skipped" | "error";
  detail: string | null;
  fit: number | null;
  feedback: "good" | "bad" | null;
  created_at: string;
}

export async function listApplyResults(limit = 100): Promise<ApplyResultRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_list_apply_results", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as ApplyResultRow[];
}

export function applyResultCounts(rows: ApplyResultRow[]): Record<ApplyResultRow["result"], number> {
  const counts = { submitted: 0, needs_review: 0, skipped: 0, error: 0 };
  for (const r of rows) if (r.result in counts) counts[r.result] += 1;
  return counts;
}

/* ── feedback loop: 👍/👎 on applied jobs teach the gate ────────────────── */

export type FeedbackVerdict = "good" | "bad";

/** Record owner feedback; skills are the row's missing-core skills (bad →
    strikes, good → clears). Returns resulting global strike counts. */
export async function sendApplyFeedback(id: string, verdict: FeedbackVerdict, skills: string[]): Promise<{ skill: string; strikes: number }[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("engine_apply_feedback", {
    p_result_id: id, p_verdict: verdict, p_skills: skills.length ? skills : null,
  });
  if (error) throw error;
  return ((data as { skill: string; strikes: number }[]) ?? []);
}

export async function getSkillStrikes(): Promise<{ skill: string; strikes: number }[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_get_skill_strikes");
  if (error) throw error;
  return ((data as { skill: string; strikes: number }[]) ?? []);
}

/* ── judge exemplars: real postings the owner labeled, fed into the judge prompt ── */

export interface JudgeExemplar {
  kind: "positive" | "negative";
  summary: string;
  reason: string | null;
}
/* full row shape (id + source_url + created_at) is JudgeExemplarRow below */

export async function putJudgeExemplar(kind: "positive" | "negative", summary: string, reason?: string, sourceUrl?: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.rpc("admin_put_judge_exemplar", {
    p_kind: kind, p_summary: summary, p_reason: reason ?? null, p_source_url: sourceUrl ?? null,
  });
  if (error) throw error;
}

/* ── exemplar management: the owner sees and prunes what the judge was taught ── */

export interface JudgeExemplarRow extends JudgeExemplar {
  id: string;
  source_url: string | null;
  created_at: string;
}

export async function listJudgeExemplars(): Promise<JudgeExemplarRow[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_list_judge_exemplars");
  if (error) throw error;
  return (data ?? []) as JudgeExemplarRow[];
}

export async function deleteJudgeExemplar(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.rpc("admin_delete_judge_exemplar", { p_id: id });
  if (error) throw error;
}

/* ── notify test-fire: the send-notify-test edge function sends the digest DM
   server-side and returns Telegram's REAL verdict. Per-user since #135: the
   signed-in user tests their OWN binding, gated on Platinum/add-on (the
   function enforces it server-side; free users get the upsell message). ── */

export async function testNotifyConfig(): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.functions.invoke("send-notify-test");
  if (error) throw error;
  const res = (data ?? {}) as { sent?: boolean; reason?: string };
  if (res.sent) return "sent";
  return res.reason || "unknown failure";
}
