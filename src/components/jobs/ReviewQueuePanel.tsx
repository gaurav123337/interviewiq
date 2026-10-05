/* Review queue panel — review-gate jobs the engine skipped in --unattended
   mode land here with their form URL; the owner finishes them in one click
   (open → submit manually → Done) or dismisses them. Also hosts the optional
   Telegram notify config the engine uses for post-batch summaries. */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listJobReviews, resolveJobReview, getNotifyConfig, setNotifyConfig, putJudgeExemplar, testNotifyConfig,
  type ReviewItem, type ReviewFormField,
} from "../../services/jobSites.ts";
import { serverAutoApply } from "../../services/entitlement.ts";
import { getCloudState } from "../../services/cloud.ts";

/* form-field preview: label + kind + answered marker, one line per field */
function FieldPreviewList({ fields }: { fields: ReviewFormField[] }) {
  return (
    <div className="mt-1.5 space-y-0.5 rounded bg-zinc-950/60 px-2 py-1.5">
      {fields.map((f, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px] leading-4">
          {f.answered ? <span className="text-emerald-400">✓</span> : <span className="text-amber-500">○</span>}
          <span className="min-w-0 flex-1 truncate text-zinc-300">{f.label || <span className="italic text-zinc-400">(unlabeled)</span>}</span>
          <span className="shrink-0 rounded bg-zinc-800 px-1 text-[10px] text-zinc-300">{f.kind}</span>
          {f.required && <span className="shrink-0 text-[10px] text-zinc-400">required</span>}
        </div>
      ))}
    </div>
  );
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ReviewQueuePanel() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const notifyRef = useRef<HTMLDivElement | null>(null);
  const [feedbackShown, setFeedbackShown] = useState<{id: string; type: 'applied'|'dismissed'|'closed'; show: boolean} | null>(null);
  const [chatId, setChatId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [notifyState, setNotifyState] = useState<string | null>(null);
  const [notifySaved, setNotifySaved] = useState(false);
  /* per-user binding: any signed-in user CAN pay-gate themselves — free
     users see the Platinum upsell instead of the form */
  const [entitled, setEntitled] = useState(true);
  useEffect(() => { setEntitled(serverAutoApply() || !getCloudState().user); }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const rows = await listJobReviews();
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /* badge truth on mount: whether Telegram is already bound (read-only peek) */
  useEffect(() => {
    void (async () => {
      try {
        const cfg = await getNotifyConfig();
        setNotifySaved(Boolean(cfg?.chat_id && cfg?.bot_token));
      } catch { /* config read failing shouldn't break the panel */ }
    })();
  }, []);

  useEffect(() => {
    if (!notifyOpen) return;
    void (async () => {
      try {
        const cfg = await getNotifyConfig();
        setChatId(cfg?.chat_id ?? "");
        setBotToken(cfg?.bot_token ?? "");
        setNotifySaved(Boolean(cfg?.chat_id && cfg?.bot_token));
      } catch { /* config read failing shouldn't break the panel */ }
    })();
  }, [notifyOpen]);

  /* posting id when the URL carries one (LinkedIn /jobs/view/<id> or
     currentJobId=<id>) — lets ownerExemplarFor match future postings by id */
  const jobIdFromUrl = (u: string | null): string | null => {
    const m = String(u || "").match(/(?:jobs\/view\/|currentJobId=)(\d+)/);
    return m ? m[1] : null;
  };

  /* one posting = one URL: strip tracking params + trailing slash so the
     optimistic removal below matches the server's variant folding (#160 —
     the same job used to arrive as /view/<id> AND /view/<id>/ and the
     identical-looking twin kept the row alive after every resolve) */
  const canonicJobUrl = (u: string | null): string => {
    try {
      const p = new URL(u || "");
      const keep = new URLSearchParams();
      for (const [k, v] of p.searchParams) {
        if (!/^(ebP|refId|trackingId|trk|gclid|fbclid|utm_.*)$/i.test(k)) keep.append(k, v);
      }
      const qs = keep.toString();
      return `${p.host}${p.pathname.replace(/\/+$/, "")}${qs ? `?${qs}` : ""}`;
    } catch { return u || ""; }
  };

  const resolve = async (it: ReviewItem, status: "done" | "dismissed" | "closed") => {
    setBusy(it.id);
    setError(null);
    /* Show feedback indication to user */
    const feedbackType = status === "done" ? "applied" : status === "dismissed" ? "dismissed" : "closed";
    setFeedbackShown({ id: it.id, type: feedbackType, show: true });
    
    try {
      /* Applied/Not-interested TEACH the judge (what the owner wants);
         Closed teaches NOTHING — a shut posting is the company's state,
         not a preference. Exemplar writes are best-effort. */
      const id = jobIdFromUrl(it.job_url);
      const base = `${it.title || "(untitled)"}${it.company ? ` at ${it.company}` : ""}${id ? ` (${id})` : ""}`;
      if (status === "done") {
        await putJudgeExemplar("positive", `${base}: owner-confirmed relevant — applied from review queue`, it.reason ?? undefined, it.job_url).catch(() => {});
      } else if (status === "dismissed") {
        await putJudgeExemplar("negative", `${base}: owner not interested — dismissed from review queue`, it.reason ?? undefined, it.job_url).catch(() => {});
      }
      await resolveJobReview(it.id, status);
      /* OPTIMISTIC: the resolver folds the verdict into every URL variant
         of this posting server-side — mirror that locally so the row (and
         any twin) leaves the list INSTANTLY; refresh() stays the truth */
      const key = canonicJobUrl(it.job_url);
      setItems((prev) => (prev ?? []).filter((r) => canonicJobUrl(r.job_url) !== key));
      /* Hide feedback after 1.5 seconds */
      setTimeout(() => setFeedbackShown(null), 1500);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFeedbackShown(null);
    } finally {
      setBusy(null);
    }
  };

  const openForm = (it: ReviewItem) => {
    const url = it.form_url || it.job_url;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /* open + reveal: the form renders above the row list, but long queues
     can still push it off-screen — scroll it into view on open */
  const openNotify = () => {
    setNotifyOpen(true);
    requestAnimationFrame(() => notifyRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const saveNotify = async () => {
    setNotifyState(null);
    try {
      await setNotifyConfig(chatId.trim(), botToken.trim());
      setNotifySaved(Boolean(chatId.trim() && botToken.trim()));
      setNotifyState("✓ saved — sending a test DM now (it carries the weekly digest)…");
      const res = await testNotifyConfig();
      setNotifyState(res === "sent"
        ? "✓ Test DM delivered — check Telegram. Every new needs-review row will ping this chat."
        : `⚠ ${res}`);
    } catch (e) {
      setNotifyState(e instanceof Error ? e.message : String(e));
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard denied */ }
  };

  if (items === null) return <div className="mt-3 text-xs text-zinc-300">Loading review queue…</div>;

  return (
    <div id="review-queue" className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
          📥 Review queue
          {items.length > 0 && <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">{items.length} waiting</span>}
          <span className="text-xs text-zinc-300">{open ? "▴" : "▾"}</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => (notifyOpen ? setNotifyOpen(false) : openNotify())}
            title="Bind Telegram: get a DM the moment a job needs you (💎 Platinum or the auto-apply add-on)"
            className={`rounded px-2 py-1 text-xs font-medium ${notifySaved ? "bg-emerald-500/15 text-emerald-400" : entitled ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25" : "bg-zinc-700/40 text-zinc-300 hover:bg-zinc-700/60"}`}>
            🔔 Telegram {notifySaved ? "· on" : entitled ? "· not set up" : "· 💎"}
          </button>
          <button onClick={() => void refresh()} className="text-xs text-zinc-300 hover:text-zinc-100">↻ refresh</button>
        </div>
      </div>
      {open && (<>
      <div className="mb-2 text-xs text-zinc-300">
        Review-gate forms the engine skipped in <code className="rounded bg-zinc-800 px-1">--unattended</code> mode wait here with their
        link — open, submit by hand, then record the outcome: <b className="text-zinc-200">✓ Applied</b> and <b className="text-zinc-200">✕ Not interested</b> teach the
        AI judge your preference for similar postings; <b className="text-zinc-200">🚫 Closed</b> (no longer accepting) just stops the engine from retrying.
        {!notifySaved && <> Want a phone ping when something lands here? <button onClick={openNotify} className="text-amber-400 underline underline-offset-2 hover:text-amber-300">Bind Telegram →</button></>}
      </div>
      {notifyOpen && !entitled && (
        <div ref={notifyRef} className="mb-3 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-2.5 text-xs text-zinc-300">
          💎 Per-user Telegram pings are part of the <b className="text-zinc-200">auto-apply engine</b> (Platinum or the auto-apply add-on).
          Upgrade to bind your own bot + chat id and get needs-you pings with direct form links on your phone.
        </div>
      )}
      {notifyOpen && entitled && (
        <div ref={notifyRef} className="mb-3 space-y-2 rounded-md border border-amber-500/30 bg-zinc-900 px-2.5 py-2.5">
          <div className="text-xs font-semibold text-zinc-300">Telegram notifications — bound to YOUR account {notifySaved && <span className="ml-1 text-emerald-400">· enabled</span>}</div>
          <p className="text-[11px] text-zinc-300">
            Create a bot with @BotFather (paste its token), send <code className="rounded bg-zinc-800 px-1">/start</code> to it once, then paste the chat id.
            Saving sends a test DM carrying the weekly digest so you can verify delivery instantly.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="chat id (e.g. 123456789)"
              className="w-44 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" />
            <input value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="bot token (123456:ABC-DEF…)" type="password"
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" />
            <button onClick={() => void saveNotify()} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">Save</button>
          </div>
          {notifyState && <div className="text-[11px] text-zinc-300">{notifyState}</div>}
        </div>
      )}
      {error && <div className="mb-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
      {!items.length && <div className="text-xs text-zinc-300">Nothing waiting — auto-submit sites never need review, and everything else lands here when skipped.</div>}
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className={`rounded-md border transition-all duration-300 ${feedbackShown?.id === it.id && feedbackShown.show ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900"} px-2.5 py-2`}>
            <div className="flex flex-col gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-zinc-200">
                  <div className="font-medium truncate">{it.title || "(untitled posting)"}</div>
                  {it.company && <div className="text-xs text-zinc-400 mt-0.5 font-medium">{it.company}</div>}
                  {typeof it.fit === "number" && (
                    <span className={`ml-0 mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold ${it.fit >= 80 ? "bg-emerald-500/15 text-emerald-400" : it.fit >= 50 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`} title="Keyword overlap between the JD and your resume's skills — NOT an overall match (seniority and core stack not included).">fit {it.fit}</span>
                  )}
                </div>
                <div className="text-xs text-zinc-300 mt-1.5">
                  {it.site_host} · {ago(it.created_at)}{it.reason ? ` · ${it.reason}` : ""}
                </div>
              </div>
              {Array.isArray(it.form_fields) && it.form_fields.length > 0 && <FieldPreviewList fields={it.form_fields} />}
              <div className="flex flex-wrap items-center gap-1.5">
                {feedbackShown?.id === it.id && feedbackShown.show ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    {feedbackShown.type === "applied" && (
                      <span className="text-emerald-400 flex items-center gap-1">✓ Recorded as applied</span>
                    )}
                    {feedbackShown.type === "dismissed" && (
                      <span className="text-red-400 flex items-center gap-1">✕ Recorded as not interested</span>
                    )}
                    {feedbackShown.type === "closed" && (
                      <span className="text-zinc-300 flex items-center gap-1">🚫 Recorded as closed</span>
                    )}
                  </div>
                ) : busy === it.id ? (
                  <span className="text-xs text-zinc-300">…</span>
                ) : (
                  <>
                    <button onClick={() => openForm(it)} className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500">Open form ↗</button>
                    <button onClick={() => void copy(it.form_url || it.job_url)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:text-zinc-100">📋</button>
                    <button onClick={() => void resolve(it, "done")} title="I already applied — also teaches the judge this kind of job is relevant" className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">✓ Applied</button>
                    <button onClick={() => void resolve(it, "dismissed")} title="Not interested — also teaches the judge to skip similar postings" className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-red-600 hover:text-red-400">✕ Not interested</button>
                    <button onClick={() => void resolve(it, "closed")} title="Posting closed / no longer accepting — stops retries, teaches nothing" className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:text-zinc-100">🚫 Closed</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      </>)}
    </div>
  );
}
