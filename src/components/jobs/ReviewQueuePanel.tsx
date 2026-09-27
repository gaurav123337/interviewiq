/* Review queue panel — review-gate jobs the engine skipped in --unattended
   mode land here with their form URL; the owner finishes them in one click
   (open → submit manually → Done) or dismisses them. Also hosts the optional
   Telegram notify config the engine uses for post-batch summaries. */

import { useCallback, useEffect, useState } from "react";
import {
  listJobReviews, resolveJobReview, getNotifyConfig, setNotifyConfig,
  type ReviewItem,
} from "../../services/jobSites.ts";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [chatId, setChatId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [notifyState, setNotifyState] = useState<string | null>(null);
  const [notifySaved, setNotifySaved] = useState(false);

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

  const resolve = async (it: ReviewItem, status: "done" | "dismissed") => {
    setBusy(it.id);
    try {
      await resolveJobReview(it.id, status);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const openForm = (it: ReviewItem) => {
    const url = it.form_url || it.job_url;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const saveNotify = async () => {
    setNotifyState(null);
    try {
      await setNotifyConfig(chatId.trim(), botToken.trim());
      setNotifySaved(Boolean(chatId.trim() && botToken.trim()));
      setNotifyState("✓ saved — the engine will DM summaries after each batch (test: `node scripts/auto-apply-jobs.js --status`)");
    } catch (e) {
      setNotifyState(e instanceof Error ? e.message : String(e));
    }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard denied */ }
  };

  if (items === null) return <div className="mt-3 text-xs text-zinc-500">Loading review queue…</div>;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-200">
          📥 Review queue {items.length > 0 && <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">{items.length} waiting</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setNotifyOpen(o => !o)} className="text-xs text-zinc-400 hover:text-zinc-200">🔔 notify</button>
          <button onClick={() => void refresh()} className="text-xs text-zinc-400 hover:text-zinc-200">↻ refresh</button>
        </div>
      </div>
      <div className="mb-2 text-xs text-zinc-500">
        Review-gate forms the engine skipped in <code className="rounded bg-zinc-800 px-1">--unattended</code> mode wait here with their
        link — open, submit by hand, then mark Done. Dismissed jobs never come back.
      </div>
      {error && <div className="mb-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
      {!items.length && <div className="text-xs text-zinc-500">Nothing waiting — auto-submit sites never need review, and everything else lands here when skipped.</div>}
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-zinc-200">
                  {it.title || "(untitled posting)"} {it.company && <span className="text-zinc-500">— {it.company}</span>}
                </div>
                <div className="truncate text-xs text-zinc-500">
                  {it.site_host} · {ago(it.created_at)}{it.reason ? ` · ${it.reason}` : ""}
                </div>
              </div>
              {busy === it.id ? (
                <span className="text-xs text-zinc-500">…</span>
              ) : (
                <>
                  <button onClick={() => openForm(it)} className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500">Open form ↗</button>
                  <button onClick={() => void copy(it.form_url || it.job_url)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200">📋</button>
                  <button onClick={() => void resolve(it, "done")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">✓ Done</button>
                  <button onClick={() => void resolve(it, "dismissed")} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200">✕</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {notifyOpen && (
        <div className="mt-3 space-y-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2.5">
          <div className="text-xs font-semibold text-zinc-300">Telegram notifications {notifySaved && <span className="ml-1 text-emerald-400">· enabled</span>}</div>
          <p className="text-[11px] text-zinc-500">
            Create a bot with @BotFather (paste its token), send <code className="rounded bg-zinc-800 px-1">/start</code> to it once, then paste the chat id.
            The engine DMs a ✅/⏸/✗ summary after every batch.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="chat id (e.g. 123456789)"
              className="w-44 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" />
            <input value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="bot token (123456:ABC-DEF…)" type="password"
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" />
            <button onClick={() => void saveNotify()} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">Save</button>
          </div>
          {notifyState && <div className="text-[11px] text-zinc-400">{notifyState}</div>}
        </div>
      )}
    </div>
  );
}
