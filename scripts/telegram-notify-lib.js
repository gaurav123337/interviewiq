/* Pure notification decisions + injected transports. The Playwright driver remains local-only. */
export const RESULT_STATES = Object.freeze(["submitted", "needs_review", "error", "skipped", "filtered", "budget_capped"]);
export const MAX_PENDING_RESULTS = 128;
const SECRET = /(?:\bBearer\s+\S+|\baiq1_[\w.-]+|\bsk-[\w-]+|\b\d{5,}:[\w-]{20,}|\b(?:bot_token|access_token|api[_ -]?key|password|authorization|secret)\s*[=:]\s*[^\s,;]+)/gi;
const CONTROLS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g;
export function safeNotifyText(value, max = 180) {
  return String(value ?? "").replace(SECRET, "[redacted]").replace(CONTROLS, " ").replace(/\s+/g, " ").trim().slice(0, Math.min(max, 3500));
}
export function safeNotifyUrl(value) {
  try {
    const u = new URL(String(value));
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return "";
    if (safeNotifyText(decodeURIComponent(u.pathname), 2000).includes("[redacted]")) return "";
    const query = new URLSearchParams();
    for (const key of ["id", "jobId", "currentJobId"]) {
      const v = u.searchParams.get(key);
      if (v && /^\d{1,20}$/.test(v)) query.set(key, v);
    }
    u.search = query.toString(); u.hash = "";
    const clean = u.toString();
    return clean.length <= 500 ? clean : "";
  } catch { return ""; }
}
export function normalizeResult(value) {
  return value === "needsReview" ? "needs_review" : RESULT_STATES.includes(value) ? value : "error";
}
// Never copy provider exceptions, model prose, field labels or candidate answers into alerts/retry metadata.
export function notifyReason(result, detail) {
  const state = normalizeResult(result), text = String(detail ?? "");
  if (state === "submitted") return "Engine detected a submission confirmation on the page.";
  if (state === "error") return "Engine step failed; submission not confirmed.";
  if (/cannot answer|required.*(?:missing|unfilled)|required answers need/i.test(text)) return "Required answers need your review.";
  if (/sign.in|guest view/i.test(text)) return "Sign-in or manual action is required.";
  if (/external ATS|external form/i.test(text)) return "External form requires manual review and submission.";
  if (/healed|changed form control|AI/i.test(text)) return "Healed form control requires manual verification.";
  if (/not detected|unconfirmed/i.test(text)) return "Submission confirmation was not detected.";
  if (state === "budget_capped") return "Policy budget reached; not auto-submitted.";
  if (state === "needs_review") return "Submission unconfirmed; review the posting manually.";
  if (state === "filtered") return "Posting did not pass the engine filters.";
  return "Posting skipped by the engine.";
}
export function notificationTime(value, zone = "UTC") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "time unavailable";
  let timeZone = safeNotifyText(zone, 80) || "UTC";
  let formatter;
  const options = { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" };
  try { formatter = new Intl.DateTimeFormat("en-GB", options); }
  catch { timeZone = "UTC"; formatter = new Intl.DateTimeFormat("en-GB", { ...options, timeZone }); }
  return `${formatter.format(date)} [${timeZone}] | ${date.toISOString()} [UTC]`;
}
export function resultCounts(rows = []) {
  const counts = Object.fromEntries(RESULT_STATES.map(s => [s, 0]));
  for (const row of rows) counts[normalizeResult(row.result)]++;
  return counts;
}
export function formatJobNotification(event, { timeZone = "UTC", sentAt = Date.now() } = {}) {
  const result = normalizeResult(event.result);
  if (!["submitted", "needs_review", "error"].includes(result)) return null;
  const wording = { submitted: "Submitted — engine detected confirmation", needs_review: "Needs review — submission unconfirmed; not auto-submitted", error: "Error — submission not confirmed" }[result];
  const url = safeNotifyUrl(event.formUrl || event.jobUrl);
  const queue = event.reviewQueue === "failed" ? "\nReview queue: save failed; open the posting manually."
    : event.reviewQueue === "queued" ? "\nReview queue: saved for manual action." : "";
  return ["InterviewIQ engine", wording, `${safeNotifyText(event.title) || "Posting"}${event.company ? ` — ${safeNotifyText(event.company)}` : ""}`,
    `Site: ${safeNotifyText(event.siteHost, 120)}`, notifyReason(result, event.detail),
    `Event: ${safeNotifyText(event.eventId, 40)}`,
    `Occurred at: ${notificationTime(event.occurredAt, timeZone)}`, `Notification sent at: ${notificationTime(sentAt, timeZone)}`,
    ...(url ? [`Posting: ${url}`] : [])].join("\n") + queue;
}
export function deliveryCounts(rows = []) {
  const counts = { sent: 0, failed: 0, unknown: 0, not_configured: 0, suppressed: 0, pending: 0 };
  for (const row of rows) { const status = row.notification?.status; if (Object.hasOwn(counts, status)) counts[status]++; }
  return counts;
}
export function formatRunNotification(report, { timeZone = "UTC", sentAt = Date.now() } = {}) {
  const c = report.counts || resultCounts(report.results);
  const d = report.deliveryCounts || deliveryCounts(report.results);
  return ["InterviewIQ engine — run summary", `Scope: ${safeNotifyText(report.site || "all active sites", 120)}`,
    `Submitted (engine confirmation): ${c.submitted || 0} | Needs review (unconfirmed): ${c.needs_review || 0} | Error (not confirmed): ${c.error || 0}`,
    `Skipped: ${c.skipped || 0} | Filtered: ${c.filtered || 0} | Budget capped: ${c.budget_capped || 0}`,
    `Started at: ${notificationTime(report.startedAt, timeZone)}`, `Ended at: ${notificationTime(report.endedAt, timeZone)}`,
    `Notification sent at: ${notificationTime(sentAt, timeZone)}`,
    `Result sync pending: ${Number(report.syncPending) || 0} | Site failures: ${Number(report.siteErrors) || 0} | Missing site reports: ${Number(report.missingReports) || 0}`,
    `Alerts: sent ${d.sent} | failed ${d.failed} | unknown ${d.unknown} | not configured ${d.not_configured} | suppressed ${d.suppressed} | pending ${d.pending}`,
    "These are engine observations, not employer receipt acknowledgements."].join("\n");
}

/** One bounded attempt, fixed HTTPS endpoint, no redirect forwarding or raw response logging. */
export function createTelegramSender({ getConfig, fetchFn = globalThis.fetch, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)), timeoutMs = 5000, minIntervalMs = 1500, maxMessages = 24 } = {}) {
  let chain = Promise.resolve(), lastAttempt = -Infinity, cooldownUntil = 0, attempts = 0;
  const timeout = Math.max(10, Math.min(timeoutMs, 10_000));
  async function attempt(textOrFormatter, beforeDispatch, summary) {
    let cfg;
    try { cfg = await getConfig(); } catch { return { status: "failed", reason: "configuration_unavailable" }; }
    if (!cfg?.chat_id || !cfg?.bot_token) return { status: "not_configured", reason: "missing_binding" };
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(String(cfg.bot_token)) || !/^-?\d{1,24}$/.test(String(cfg.chat_id))) return { status: "not_configured", reason: "invalid_binding" };
    if (attempts >= maxMessages + (summary ? 1 : 0) || now() < cooldownUntil) return { status: "failed", reason: "rate_limited" };
    await sleep(Math.max(0, lastAttempt + minIntervalMs - now()));
    const sentAt = now();
    const raw = typeof textOrFormatter === "function" ? textOrFormatter({ timeZone: cfg.time_zone || "UTC", sentAt }) : textOrFormatter;
    if (!raw) return { status: "failed", reason: "empty_message" };
    // Preserve formatter newlines, but strip secrets/unsafe directional controls for legacy callers too.
    const text = String(raw).replace(SECRET, "[redacted]").replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, " ").slice(0, 3500);
    beforeDispatch?.(); // caller durably marks unknown before the one-way network door
    attempts++; lastAttempt = sentAt;
    const controller = new AbortController();
    let timer;
    const expired = new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ status: "unknown", reason: "timeout" }); }, timeout); });
    const request = (async () => {
      try {
        const response = await fetchFn(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" }, redirect: "error", signal: controller.signal,
          body: JSON.stringify({ chat_id: cfg.chat_id, text, disable_web_page_preview: true }),
        });
        const body = await response.json().catch(() => null);
        if (response.ok && body?.ok === true) return { status: "sent", sentAt: new Date(sentAt).toISOString(),
          ...(Number.isSafeInteger(body?.result?.message_id) && body.result.message_id > 0 ? { messageId: body.result.message_id } : {}) };
        if (response.status === 429 || body?.error_code === 429) {
          cooldownUntil = now() + Math.max(1500, Math.min(60_000, (Number(body?.parameters?.retry_after) || 1) * 1000));
          return { status: "failed", reason: "rate_limited" };
        }
        if (response.status >= 500 || (response.ok && body?.ok !== false)) return { status: "unknown", reason: "invalid_acknowledgement" };
        return { status: "failed", reason: "rejected" };
      } catch { return { status: "unknown", reason: controller.signal.aborted ? "timeout" : "network_or_redirect" }; }
    })();
    try { return await Promise.race([request, expired]); } finally { clearTimeout(timer); }
  }
  return { send(text, beforeDispatch, { summary = false } = {}) {
    const next = chain.then(() => attempt(text, beforeDispatch, summary));
    chain = next.catch(() => {});
    return next;
  }, async drain() { await chain; }, async resetBudget() { await chain; attempts = 0; } };
}

export function resultEvent(row, siteHost, runId) {
  return {
    eventId: row.eventId, occurredAt: new Date(row.at).toISOString(), runId,
    siteHost: safeNotifyText(siteHost, 160), jobUrl: safeNotifyUrl(row.url), title: safeNotifyText(row.title), company: safeNotifyText(row.company),
    result: normalizeResult(row.result), detail: notifyReason(row.result, row.detail),
    fit: Number.isFinite(row.fit) ? row.fit : null, ageH: Number.isFinite(row.ageH) && row.ageH >= 0 ? row.ageH : null,
  };
}

/** Bounded metadata retry, not an application executor. Only record() and send() are injected. */
export function createResultDeliveryQueue({ runId, load = () => [], save, record, send, now = Date.now, maxPending = MAX_PENDING_RESULTS, retryLimit = 16, onFailure = () => {} }) {
  let entries = [], chain = Promise.resolve();
  const rows = new Map();
  const persist = () => save(entries);
  function update(entry) {
    const row = rows.get(entry.event.eventId);
    if (row) { row.sync = entry.recorded ? "recorded" : "pending"; row.notification = { ...entry.notification }; }
  }
  function remove(entry) { entries = entries.filter(e => e !== entry); rows.delete(entry.event.eventId); persist(); }
  function serialized(task) {
    const next = chain.then(task); chain = next.catch(() => {}); return next;
  }
  async function processEntry(entry) {
    if (!entries.includes(entry)) return;
    if (!entry.recorded) {
      try { await record(entry.event); }
      catch { update(entry); onFailure("result_sync_pending"); return; }
      entry.recorded = true; persist();
    }
    update(entry);
    if (!entry.ready) return;
    if (entry.notification.status !== "pending") { remove(entry); return; }
    const outcome = await send(entry.event, () => {
      entry.notification = { status: "unknown", reason: "dispatch_started" };
      persist(); update(entry);
    });
    entry.notification = outcome; update(entry); persist(); remove(entry);
  }
  return {
    async startup() {
      const loaded = load();
      if (!Array.isArray(loaded) || loaded.length > maxPending) throw new Error("Result retry metadata invalid or full");
      if (loaded.some(e => !e?.event?.eventId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(e.event.eventId)
        || !Number.isFinite(Date.parse(e.event.occurredAt)) || !RESULT_STATES.includes(e.event.result))) throw new Error("Result retry metadata contains an invalid event; refusing to discard it");
      entries = loaded.map(e => ({
          event: resultEvent({ ...e.event, url: e.event.jobUrl, at: e.event.occurredAt }, e.event.siteHost, e.event.runId),
          recorded: e.recorded === true, ready: true, notification: { status: "suppressed", reason: "historical_event" },
        }));
      persist();
      await this.retry();
    },
    enqueue(event, row, { notify = true, ready = true } = {}) {
      if (entries.length >= maxPending) { const error = new Error("Result retry queue full; stopping before further jobs"); error.code = "RESULT_QUEUE_FULL"; throw error; }
      const entry = { event, recorded: false, ready, notification: { status: notify ? "pending" : "suppressed", reason: notify ? "awaiting_record" : "summary_only" } };
      entries.push(entry); rows.set(event.eventId, row); persist(); update(entry);
      return serialized(() => processEntry(entry));
    },
    finishReview(eventId, outcome) {
      const entry = entries.find(e => e.event.eventId === eventId);
      if (!entry) return Promise.resolve();
      entry.ready = true; entry.event.reviewQueue = outcome.status; entry.event.formUrl = safeNotifyUrl(outcome.formUrl);
      if (outcome.suppress) entry.notification = { status: "suppressed", reason: "pending_review_or_unknown" };
      persist();
      return serialized(() => processEntry(entry));
    },
    retry() { return serialized(async () => { for (const entry of entries.slice(0, retryLimit)) await processEntry(entry); }); },
    async drain() { await chain; },
    get pending() { return entries.filter(e => !e.recorded).length; },
  };
}

export function cycleLockReclaimable(lock, { activePid, now = Date.now(), modifiedAt = now, corruptGraceMs = 30_000 } = {}) {
  if (Number.isInteger(lock?.pid) && lock.pid > 0) return !activePid(lock.pid);
  return now - modifiedAt > corruptGraceMs;
}
export function aggregateCycleReports(reports, cycleId, { startedAt, endedAt, siteErrors = 0, expectedReports = 0 } = {}) {
  const current = reports.filter(r => r?.cycleId === cycleId);
  return { cycleId, site: "all active sites", startedAt, endedAt, counts: resultCounts(current.flatMap(r => r.results || [])),
    deliveryCounts: deliveryCounts(current.flatMap(r => r.results || [])),
    syncPending: current.reduce((n, r) => n + (Number(r.syncPending) || 0), 0), siteErrors, missingReports: Math.max(0, expectedReports - current.length) };
}
