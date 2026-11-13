/* Job-sites registry admin — the UI half of the self-discovering apply
   engine. Discovery (local engine) inserts sites with status 'pending';
   the owner approves them here, and only 'active' sites are driven by
   `auto-apply-jobs.js --all`. */

import { getCloudState, getSupabaseClient, subscribeCloud } from "./cloud.ts";
import { autoSubmitTrustPatch, autoSubmitTrustVerdict, AUTO_SUBMIT_NEVER_HOSTS } from "../../scripts/apply-engine-lib.js";

/* Core data is owner-scoped by auth.uid() in SQL. An unapplied migration is
   an error, never permission to retry through a global admin reader. */
async function myApply<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("my_apply_action", { p_action: action, p_args: args });
  if (error) throw new Error(error.message);
  return data as T;
}

export interface JobSite {
  id: string;
  host: string;
  label: string;
  jobs_url: string | null;
  status: "pending" | "active" | "disabled" | "dead";
  source: "builtin" | "discovered" | "manual" | "ats";
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
  discovered_at?: string | null;
  approved_at?: string | null;
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

/* Owner-tuned engine rules, one whitelisted key per call (admin_set_site_rules
   rejects anything outside the list — the rules column also carries
   engine-learned selectors and probation state the UI must never clobber).
   The engine reads rules.boardMatch each run: true opts any board's cards
   into the match-badge pre-filter; false turns it off even for instahyre/
   linkedin/naukri; absent = builtin behavior. */
export async function setSiteRule(host: string, key: "boardMatch" | "maxAgeDays", value: boolean | number | null): Promise<void> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  /* null = remove the key (RPC deletes it) — the owner restoring builtin behavior */
  const { error } = await client.rpc("admin_set_site_rules", { p_host: host, p_key: key, p_value: value });
  if (error) throw error;
}

/* Probation (job-sites-probation.sql): pending sites auto-activate once they
   have waited this long, oldest first, capped per sweep — the engine's --all
   cycle runs the sweep and DMs every activation. A site can opt out via
   rules.probation.skip. Pending rows show the countdown in the registry. */
export const PROBATION_DAYS = 7;

export function probationAutoActivateAt(s: JobSite): string | null {
  if (s.status !== "pending" || !s.discovered_at) return null;
  if ((s.rules as { probation?: { skip?: boolean } } | null)?.probation?.skip) return null;
  const d = new Date(s.discovered_at);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + PROBATION_DAYS * 24 * 3600_000).toISOString();
}

/* The discovery evidence the registry previously only hinted at with a bare
   "discovered" text badge: WHEN the engine found the portal. Renders a
   "🧭 DD-MMM HH:mm" chip with a full "discovered <date + time>" tooltip.
   Null for builtin/ats/manual sources (their registration was not a
   discovery event) and for rows without a parseable discovered_at. */
export function discoveredStamp(s: Pick<JobSite, "source" | "discovered_at">): { text: string; long: string } | null {
  if (s.source !== "discovered" || !s.discovered_at) return null;
  const d = new Date(s.discovered_at);
  if (isNaN(d.getTime())) return null;
  const text = `🧭 ${d.toLocaleString(undefined, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  })}`;
  const long = `discovered ${d.toLocaleString(undefined, {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  })}`;
  return { text, long };
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
  /** the POSTING's parsed age in hours at collect (board card stamp) —
      null = the board never said. Distinguish from created_at, which is
      the decision row's age. */
  posted_age_h: number | null;
  created_at: string;
}

export async function listJobReviews(): Promise<ReviewItem[]> {
  return (await myApply<ReviewItem[]>("reviews.list")) ?? [];
}

/* Resolved review rows (done/dismissed/closed), ONE per posting (newest
   variant wins server-side, same review_posting_key dedupe as the pending
   list) — powers the panel's "Applied by User" section. Carries fit and
   posted_age_h so the ⏱ posting-age filter and chips behave identically
   to the pending list. The RPC must exist first (supabase/
   review-queue-resolved.sql); until applied, callers must degrade to an
   honest skip, never crash. */
export interface ResolvedReviewItem extends ReviewItem {
  status: "done" | "dismissed" | "closed";
  resolved_at: string;
}

export async function listResolvedJobReviews(): Promise<ResolvedReviewItem[]> {
  return (await myApply<ResolvedReviewItem[]>("reviews.resolved", { limit: 150 })) ?? [];
}

/* Send a mistakenly resolved posting back to pending (variant-wide
   server-side, like the resolver). Needs admin_unresolve_job_review from
   review-queue-resolved.sql — callers treat failure honestly (the row
   stays until the SQL is applied). */
export async function unresolveJobReview(id: string): Promise<void> {
  await myApply("reviews.unresolve", { id });
}

/* ── Phase 2: tailored-resume variants (apply_resume_variants) ───────── */

export interface ResumeVariantRow {
  id: string;
  site_host: string | null;
  job_url: string;
  title: string | null;
  company: string | null;
  master_text: string | null;
  variant_text: string | null;
  diff_summary: {
    sections?: Array<{ heading: string; status: "unchanged" | "changed"; matchedKeywords?: string[] }>;
    changedCount?: number;
    matchedKeywords?: string[];
  } | null;
  variant_id: string;
  approved: boolean;
  created_at: string;
  approved_at: string | null;
}

/** Needs `admin_list_resume_variants` from apply-resume-variants.sql — until
    it is applied the RPC errors and the panel shows the failure honestly. */
export async function listResumeVariants(limit = 50): Promise<ResumeVariantRow[]> {
  return (await myApply<ResumeVariantRow[]>("variants.list", { limit })) ?? [];
}

/** Approve / revert ONE variant row — a later tailoring (different content)
    is a new row and asks again. The engine's next run for that posting
    reads the approval and unlocks auto-submit for the gate. */
export async function approveResumeVariant(id: string, approved: boolean): Promise<void> {
  await myApply("variants.approve", { id, approved });
}

export async function resolveJobReview(id: string, status: "done" | "dismissed" | "closed"): Promise<void> {
  await myApply("reviews.resolve", { id, status });
}

/* ── Telegram binding metadata — secrets never come back to the browser.
   Save delivers a generic test before the server replaces a binding; revision
   fences concurrent changes. Cleanup remains available without entitlement. */

export interface NotifyConfig {
  chat_id: string | null;
  has_token: boolean;
  time_zone: string;
  delivery_tested_at: string | null;
  updated_at: string | null;
  revision: number;
}

export interface NotifyTestResult {
  sent: boolean;
  reason?: string;
  message_id?: number;
  disconnected?: boolean;
  config: NotifyConfig | null;
}

export function defaultNotifyTimeZone(): string {
  try { return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

export function validateNotifyBinding(chatId: string, botToken: string, timeZone: string, hasToken = false): string | null {
  if (!/^-?[1-9]\d{0,19}$/.test(chatId.trim()) || BigInt(chatId.trim()) < -9223372036854775808n || BigInt(chatId.trim()) > 9223372036854775807n) {
    return "Enter a numeric Telegram chat ID (negative group IDs are allowed).";
  }
  if ((!botToken.trim() && !hasToken) || (botToken.trim() && !/^\d{5,16}:[A-Za-z0-9_-]{20,128}$/.test(botToken.trim()))) {
    return "Enter a valid BotFather token, not a bot name or URL.";
  }
  try {
    if (!timeZone.trim() || timeZone.trim().length > 100 || /^[+-]/.test(timeZone.trim())) throw new Error();
    new Intl.DateTimeFormat("en", { timeZone: timeZone.trim() });
  } catch { return "Enter a valid IANA time zone, for example Europe/London or UTC."; }
  return null;
}

function notifyMetadata(value: unknown): NotifyConfig | null {
  if (value == null) return null;
  const row = value as NotifyConfig;
  if (typeof row !== "object" || typeof row.has_token !== "boolean" || !Number.isSafeInteger(row.revision) || row.revision < 0
    || (row.chat_id !== null && typeof row.chat_id !== "string") || typeof row.time_zone !== "string"
    || (row.delivery_tested_at !== null && typeof row.delivery_tested_at !== "string")
    || (row.updated_at !== null && typeof row.updated_at !== "string")) throw new Error("Telegram configuration is unavailable. Try again.");
  return { chat_id: row.chat_id, has_token: row.has_token, time_zone: row.time_zone,
    delivery_tested_at: row.delivery_tested_at, updated_at: row.updated_at, revision: row.revision };
}

/* A→B→A still cancels the request. In particular, a delayed client/session
   lookup must not send account A's draft with account B's authorization. */
async function myNotify<T>(run: (client: NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>, check: () => void, userId: string, signal: AbortSignal) => Promise<T>): Promise<T> {
  const userId = getCloudState().user?.id;
  if (!userId) throw new Error("Sign in to manage your Telegram binding");
  let changed = false;
  const controller = new AbortController();
  const unsubscribe = subscribeCloud(s => { if (s.user?.id !== userId) { changed = true; controller.abort(); } });
  const check = () => {
    if (changed || getCloudState().user?.id !== userId) throw new Error("Account changed. Reopen Telegram settings for your current account.");
  };
  try {
    const client = await getSupabaseClient();
    check();
    if (!client) throw new Error("cloud not configured");
    return await run(client, check, userId, controller.signal);
  } finally { unsubscribe(); }
}

export async function getNotifyConfig(): Promise<NotifyConfig | null> {
  return myNotify(async (client, check) => {
    const { data, error } = await client.rpc("get_my_notify_config");
    check();
    if (error) throw new Error("Telegram configuration is unavailable. Try again.");
    return notifyMetadata(data);
  });
}

async function notifyOperation(body: Record<string, unknown>): Promise<NotifyTestResult> {
  return myNotify(async (client, check, userId, signal) => {
    const { data: session, error: sessionError } = await client.auth.getSession();
    check();
    if (sessionError || session.session?.user.id !== userId || !session.session.access_token) throw new Error("Sign in to manage your Telegram binding");
    const { data, error } = await client.functions.invoke("send-notify-test", {
      body, signal, headers: { Authorization: `Bearer ${session.session.access_token}` },
    });
    check();
    if (error) {
      const context: unknown = error.context;
      if (context instanceof Response) {
        let failure: { reason?: unknown; config?: unknown } | null = null;
        try { failure = await context.clone().json(); } catch { /* transport bodies are not safe display text */ }
        check();
        if (typeof failure?.reason === "string" && ["stale_binding", "binding_changed", "invalid_settings", "not_entitled", "unauthorized", "rate_limited", "telegram_rejected", "telegram_unavailable"].includes(failure.reason)) {
          return { sent: false, reason: failure.reason, config: notifyMetadata(failure.config) };
        }
      }
      throw new Error("Telegram request failed. Reload settings before retrying; your previous binding is retained if delivery failed.");
    }
    const res = data as NotifyTestResult | null;
    if (!res || typeof res.sent !== "boolean" || !("config" in res)) throw new Error("Telegram returned an invalid response. Reload settings before retrying.");
    return { sent: res.sent, config: notifyMetadata(res.config),
      ...(typeof res.reason === "string" && /^[a-z_]{1,80}$/.test(res.reason) ? { reason: res.reason } : {}),
      ...(Number.isSafeInteger(res.message_id) ? { message_id: res.message_id } : {}),
      ...(res.disconnected === true ? { disconnected: true } : {}),
    };
  });
}

export async function setNotifyConfig(chatId: string, botToken: string, timeZone: string, revision: number | null): Promise<NotifyTestResult> {
  const invalid = validateNotifyBinding(chatId, botToken, timeZone, true);
  if (invalid) throw new Error(invalid);
  return notifyOperation({ operation: "save", chatId: chatId.trim(), botToken: botToken.trim(), timeZone: timeZone.trim(), revision });
}

export async function disconnectNotifyConfig(revision: number | null): Promise<NotifyTestResult> {
  return notifyOperation({ operation: "unbind", revision });
}

/* ── admin view of every user's binding (admin_list_user_notify RPC) ── */

export interface UserNotifyBinding {
  user_id: string;
  email: string | null;
  bound: boolean;
  updated_at: string | null;
}

export async function listUserNotifyBindings(): Promise<UserNotifyBinding[]> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_list_notify_summary");
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
  available: boolean;
  result_count: number;
  review_count: number;
  variant_count: number;
  last_activity: string | null;
}

export async function getUserActivity(userId: string): Promise<UserActivity> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.rpc("admin_user_apply_summary", { p_user: userId });
  if (error) throw new Error(error.message);
  return data as UserActivity;
}

/* ── site credentials (admin): store logins per site, clubbed when sites
   share auth; the engine uses them to re-login when a session dies ── */

export interface SiteCredential {
  id: string;
  label: string;
  kind: "password" | "oauth" | "otp" | "totp" | "manual";
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

/* 🔑 Sign in (or 👁 proof-view) from the app: queues a login request the
   desktop listener picks up within ~30s. kind 'signin' opens the engine's
   sign-in window (the only safe way to use Google OAuth — the human types
   it, once); kind 'view' opens the site LOGGED IN over the engine's saved
   session — visible proof behind a "session verified" badge, because that
   verdict is an engine-profile probe sharing no cookies with this app's
   browser. Requires the p_kind SQL overload; until it is applied the RPC
   errors honestly instead of pretending. */
export async function requestSiteLogin(host: string, kind: "signin" | "view" = "signin"): Promise<string> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("cloud not configured");
  if (kind === "signin") {
    const { data, error } = await client.rpc("admin_request_login", { p_host: host });
    if (error) throw error;
    return String(data ?? "");
  }
  const { data, error } = await client.rpc("admin_request_login", { p_host: host, p_kind: "view" });
  if (error) throw error;
  return String(data ?? "");
}

export type LoginLifecycle = "requested" | "opened" | "crashed" | "verified" | "failed" | "closed";

/* The engine reports every sign-in transition here; the 🔑 row polls this
   so the owner sees "window open — act now" / "crashed" / "verified" /
   "failed" in the app instead of the flow going dark after the click.
   'closed' is the 👁 proof-view terminal (owner closed the window after
   seeing the logged-in page) — success for a view, not for a sign-in. */
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
  result: "submitted" | "needs_review" | "skipped" | "error" | "budget_capped" | "filtered";
  detail: string | null;
  fit: number | null;
  /** the POSTING's parsed age in hours at collect (board card stamp) —
      null = the board never said. created_at is the DECISION's age. */
  posted_age_h: number | null;
  feedback: "good" | "bad" | null;
  created_at: string;
  occurred_at?: string | null;
}

export async function listApplyResults(limit = 100): Promise<ApplyResultRow[]> {
  return (await myApply<ApplyResultRow[]>("results.list", { limit })) ?? [];
}

export function applyResultCounts(rows: ApplyResultRow[]): Record<ApplyResultRow["result"], number> {
  const counts = { submitted: 0, needs_review: 0, skipped: 0, error: 0, budget_capped: 0, filtered: 0 };
  for (const r of rows) if (r.result in counts) counts[r.result] += 1;
  return counts;
}

/* ── form-answer memory stats (#heal-reuse): every field the engine FILLED
   straight from a remembered answer bumps reuse_count server-side; the doc
   table drives the report's 🧠 strip so the owner sees the memory paying
   rent (how many remembered answers sit per site, how often reused). The
   RPC exists since form-answer-reuse.sql — until applied, degrade to an
   honest [] strip, never crash. ── */

export interface FormAnswerStats {
  site_host: string;
  /** remembered answers currently held for this site */
  answers: number;
  /** of those, how many have been reused at least once */
  reused: number;
  /** total reuse events — the AI-call/time-savings counter */
  total_reuses: number;
  last_used: string | null;
}

export async function listFormAnswerStats(): Promise<FormAnswerStats[]> {
  return (await myApply<FormAnswerStats[]>("memory.stats")) ?? [];
}

/* ── auto-submit trust state (#trust-chips): recompute the same per-host
   latch the engine computes at run start (autoSubmitTrustVerdict in the
   pure lib) from the rows this admin session can see — up to 40 newest
   per host, capped by the RPC's window. This is EVIDENCE-ONLY: the UI
   shows what the engine would decide NOW; the owner's explicit
   autoSubmit:false stays "explicit off", and gmail/linkedin-style never
   hosts stay blocked regardless of history. ── */

export interface SiteTrustState {
  /** trust = would auto-submit this run; review = still at the review gate */
  verdict: "trust" | "review";
  trusted: boolean;
  blocked: boolean;
  note: string;
}

export function siteTrustState(
  host: string,
  rows: Pick<ApplyResultRow, "result" | "detail">[],
  rules: Record<string, unknown> | null | undefined,
): SiteTrustState {
  const adapted = rows
    .filter((r) => r.result === "submitted" || r.result === "needs_review" || r.result === "skipped" || r.result === "error")
    .slice(0, 40) // same 40-row window the engine grants its latch
    .map((r) => ({
      result: r.result as string,
      unknownModeled: /healed/i.test(r.detail ?? ""),
      submittedUnverified: /not detected/i.test(r.detail ?? ""),
    }));
  const libVerdict = autoSubmitTrustVerdict(adapted);
  const patch = autoSubmitTrustPatch(libVerdict, host, rules ?? {});
  return {
    /* the ENGINE's decision this run: autoSubmit flips on only for a trusted,
       non-blocked host the owner hasn't explicitly turned off */
    verdict: patch.autoSubmit ? ("trust" as const) : ("review" as const),
    trusted: patch.trusted === true,
    blocked: AUTO_SUBMIT_NEVER_HOSTS.some((h) => host.toLowerCase().includes(h)),
    note: patch.trustNote ?? "",
  };
}

/* ── feedback loop: 👍/👎 on applied jobs teach the gate ────────────────── */

export type FeedbackVerdict = "good" | "bad";

/** Record owner feedback; skills are the row's missing-core skills (bad →
    strikes, good → clears). Returns resulting global strike counts. */
export async function sendApplyFeedback(id: string, verdict: FeedbackVerdict, skills: string[]): Promise<{ skill: string; strikes: number }[]> {
  return (await myApply<{ skill: string; strikes: number }[]>("feedback.put", { id, verdict, skills })) ?? [];
}

export async function getSkillStrikes(): Promise<{ skill: string; strikes: number }[]> {
  return (await myApply<{ skill: string; strikes: number }[]>("strikes.list")) ?? [];
}

/* ── judge exemplars: real postings the owner labeled, fed into the judge prompt ── */

export interface JudgeExemplar {
  kind: "positive" | "negative";
  summary: string;
  reason: string | null;
}
/* full row shape (id + source_url + created_at) is JudgeExemplarRow below */

export async function putJudgeExemplar(kind: "positive" | "negative", summary: string, reason?: string, sourceUrl?: string): Promise<void> {
  await myApply("exemplars.put", { kind, summary, reason: reason ?? null, sourceUrl: sourceUrl ?? null });
}

/* ── exemplar management: the owner sees and prunes what the judge was taught ── */

export interface JudgeExemplarRow extends JudgeExemplar {
  id: string;
  source_url: string | null;
  created_at: string;
}

export async function listJudgeExemplars(): Promise<JudgeExemplarRow[]> {
  return (await myApply<JudgeExemplarRow[]>("exemplars.list", { limit: 200 })) ?? [];
}

export async function deleteJudgeExemplar(id: string): Promise<void> {
  await myApply("exemplars.delete", { id });
}

/* Test the saved binding, not unpersisted drafts or a digest/ownership proof. */
export async function testNotifyConfig(revision: number | null): Promise<NotifyTestResult> {
  return notifyOperation({ operation: "test", revision });
}
