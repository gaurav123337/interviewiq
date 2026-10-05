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
  credential_id: string | null;
  rules: Record<string, unknown>;
  session_ok: boolean;
  session_state: "unknown" | "verified" | "expired" | null;
  session_checked_at: string | null;
  session_expired_at: string | null;
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

/* Three-state session health for the per-site strip. "verified ✓" means a
   fresh headless probe (hourly watchdog) or a completed sign-in landed on a
   signed-in state; "expired ✗" means the probe hit the login wall — one OTP
   re-login fixes it; "never checked" means the watchdog has not reached it
   yet. Falls back to the legacy binary session_ok for rows not yet probed. */
export function sessionStateOf(s: JobSite): { key: "verified" | "expired" | "unchecked"; label: string; cls: string; title: string } {
  const checked = s.session_checked_at ? new Date(s.session_checked_at).toLocaleString() : null;
  if (s.session_state === "verified") {
    return { key: "verified", label: `session verified${checked ? ` · ${checked}` : ""}`, cls: "bg-emerald-500/15 text-emerald-400", title: "A fresh probe landed on a signed-in state — sessions are durable now and survive browser restarts." };
  }
  if (s.session_state === "expired") {
    return { key: "expired", label: `session EXPIRED${s.session_expired_at ? ` · ${new Date(s.session_expired_at).toLocaleString()}` : ""}`, cls: "bg-red-500/15 text-red-400", title: "The watchdog probe hit the login wall — the site killed the session server-side. One 🔑 OTP re-login restores it." };
  }
  if (s.session_state === "unknown" && s.session_checked_at) {
    return { key: "unchecked", label: `session unclear · ${checked}`, cls: "bg-zinc-500/15 text-zinc-300", title: "The last probe could not tell (bot-check page or error) — it retries hourly." };
  }
  return { key: "unchecked", label: "session never checked", cls: "bg-zinc-500/15 text-zinc-300", title: "The hourly watchdog has not probed this site yet." };
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

/* ── admin view of every user's binding (admin_list_user_notify RPC) ── */

export interface UserNotifyBinding {
  user_id: string;
  email: string | null;
  chat_id: string | null;
  token_prefix: string | null;
  updated_at: string | null;
}

export async function listUserNotifyBindings(): Promise<UserNotifyBinding[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_list_user_notify");
  if (error) throw error;
  return (data ?? []) as UserNotifyBinding[];
}

export async function clearUserNotifyBinding(userId: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.rpc("admin_clear_user_notify", { p_user: userId });
  if (error) throw error;
}

/* ── per-user activity drawer (admin): usage timeline + engine history + binding ── */

export interface UserUsageRow { kind: string; meta: Record<string, unknown> | null; created_at: string }
export interface UserApplyRow { site_host: string; job_url: string; title: string | null; company: string | null; result: string; detail: string | null; fit: number | null; created_at: string }
export interface UserReviewRow { job_url: string; title: string | null; company: string | null; status: string; reason: string | null; fit: number | null; created_at: string; resolved_at: string | null }
export interface UserNotifyRow { chat_id: string | null; token_prefix: string | null; updated_at: string | null }

export interface UserActivity {
  usage: UserUsageRow[];
  applyRows: UserApplyRow[];
  reviewRows: UserReviewRow[];
  notify: UserNotifyRow | null;
}

export async function getUserActivity(userId: string): Promise<UserActivity> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const [usage, applyRows, reviewRows, notify] = await Promise.all([
    client.rpc("admin_user_usage", { p_user: userId, p_limit: 40 }),
    client.rpc("admin_user_apply_rows", { p_limit: 30 }),
    client.rpc("admin_user_review_rows"),
    client.rpc("admin_user_notify_row", { p_user: userId }),
  ]);
  for (const r of [usage, applyRows, reviewRows, notify]) if (r.error) throw r.error;
  return {
    usage: (usage.data ?? []) as UserUsageRow[],
    applyRows: (applyRows.data ?? []) as UserApplyRow[],
    reviewRows: (reviewRows.data ?? []) as UserReviewRow[],
    notify: ((notify.data as UserNotifyRow[]) ?? [])[0] ?? null,
  };
}

/* ── site credentials (admin): store logins per site, clubbed when sites
   share auth; the engine uses them to re-login when a session dies ── */

export interface SiteCredential {
  id: string;
  label: string;
  kind: "password" | "oauth" | "otp" | "manual";
  username: string | null;
  secret_prefix: string | null;
  bound_sites: string;
  updated_at: string;
}

export async function listCredentials(): Promise<SiteCredential[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_list_credentials");
  if (error) throw error;
  return (data ?? []) as SiteCredential[];
}

export async function putCredential(id: string | null, label: string, kind: SiteCredential["kind"], username: string, secret: string): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_put_credential", { p_id: id, p_label: label, p_kind: kind, p_username: username, p_secret: secret });
  if (error) throw error;
  return String(data ?? "");
}

export async function deleteCredential(id: string): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.rpc("admin_delete_credential", { p_id: id });
  if (error) throw error;
}

export async function bindCredential(host: string, credentialId: string | null): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.rpc("admin_bind_credential", { p_host: host, p_credential_id: credentialId });
  if (error) throw error;
}

export async function addJobSiteUrl(jobsUrl: string, label?: string): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_add_job_site", { p_jobs_url: jobsUrl, p_label: label ?? null });
  if (error) throw error;
  return String(data ?? "");
}

/* 🔑 Sign in from the app: queues a login request the desktop listener
   picks up within ~30s and opens the engine's own sign-in window (the
   only safe way to use Google OAuth — the human types it, once). */
export async function requestSiteLogin(host: string): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_request_login", { p_host: host });
  if (error) throw error;
  return String(data ?? "");
}

export type LoginLifecycle = "requested" | "opened" | "crashed" | "verified" | "failed";

/* The engine reports every sign-in transition here; the 🔑 row polls this
   so the owner sees "window open — act now" / "crashed" / "verified" /
   "failed" in the app instead of the flow going dark after the click. */
export async function fetchLoginStatus(host: string): Promise<LoginLifecycle | null> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_login_status", { p_host: host });
  if (error) throw error;
  const row = (data as { status: string }[] | null)?.[0];
  return (row?.status as LoginLifecycle) ?? null;
}

/* ⚡ Run now: queue a full --all cycle on the desktop engine (the listener
   picks it up within ~30s), then poll the lifecycle for the button. */
export type RunLifecycle = "requested" | "running" | "done" | "failed";

export async function requestRunNow(): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_request_run");
  if (error) throw error;
  return String(data ?? "run requested");
}

export async function fetchRunStatus(): Promise<{ status: RunLifecycle | null; detail: string | null }> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_run_status");
  if (error) throw error;
  const row = (data as { status: string; detail: string }[] | null)?.[0];
  return { status: (row?.status as RunLifecycle) ?? null, detail: row?.detail ?? null };
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

/* ── Live engine state: the local listener beats every ~2 min; a STALE beat
   reads as stopped, so a crashed/killed engine can never look alive. ── */

export interface EngineState {
  state: "running" | "stopped" | string;
  detail: string | null;
  beat_at: string | null;
}

export const ENGINE_STALE_MS = 5 * 60_000; // beats arrive every ~2 min

export async function fetchEngineState(): Promise<EngineState | null> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_engine_state");
  if (error) throw error;
  return ((data as EngineState[]) ?? [])[0] ?? null;
}

/** running = fresh heartbeat that says running; anything else is stopped. */
export function engineIsRunning(s: EngineState | null): boolean {
  if (!s?.beat_at || s.state !== "running") return false;
  return Date.now() - new Date(s.beat_at).getTime() < ENGINE_STALE_MS;
}

/* ── Engine activity timeline: the event history behind the badge, grouped
   into contiguous run sessions (a gap > 6 min or a stopped report closes
   one). Rendered as "24h uptime Xh Ym — 🟢 09:02→10:41 · 🟢 12:10→now". ── */

export interface EngineEvent {
  state: string;
  detail: string | null;
  created_at: string;
}

export async function fetchEngineEvents(hours = 24): Promise<EngineEvent[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_engine_events", { p_hours: hours });
  if (error) throw error;
  return (data ?? []) as EngineEvent[];
}

export interface EngineSession {
  start: string;
  /** null = still open (or implicitly closed by staleness at render time). */
  end: string | null;
}

export function buildEngineSessions(events: EngineEvent[], gapMs = 6 * 60_000): EngineSession[] {
  const evs = [...events].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const sessions: EngineSession[] = [];
  let cur: EngineSession | null = null;
  let prevT = 0;
  for (const e of evs) {
    const t = +new Date(e.created_at);
    if (e.state === "running") {
      if (!cur || t - prevT > gapMs) { cur = { start: e.created_at, end: null }; sessions.push(cur); }
    } else if (e.state === "stopped" && cur) {
      cur.end = e.created_at;
      cur = null;
    }
    prevT = t;
  }
  return sessions;
}

/** Total running time inside the window, in ms. An open session counts up to
    its last beat + the staleness window (a crashed engine can't fake uptime). */
export function engineUptimeMs(events: EngineEvent[], windowMs = 24 * 3600_000, now = Date.now()): number {
  const windowStart = now - windowMs;
  return buildEngineSessions(events).reduce((sum, s) => {
    const start = Math.max(+new Date(s.start), windowStart);
    // open session: only trust it while the last event is still fresh
    const last = events.length ? +new Date(events[0].created_at) : 0;
    const end = s.end ? +new Date(s.end) : Math.min(now, last + ENGINE_STALE_MS);
    return sum + Math.max(0, Math.min(end, now) - start);
  }, 0);
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
