/* 🧠 What the judge learned — every exemplar distilled from the owner's
   verdicts (Done/Not-interested in the review queue, 👍/👎 on applied rows,
   hand-seeded confirmations). These are the few-shot lines the AI judge
   imitates; deleting one immediately weakens that lesson. */

import { useCallback, useEffect, useState } from "react";
import { listJudgeExemplars, deleteJudgeExemplar, type JudgeExemplarRow } from "../../services/jobSites.ts";

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ExemplarsPanel() {
  const [rows, setRows] = useState<JudgeExemplarRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setRows(await listJudgeExemplars());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  }, []);

  useEffect(() => { if (open && rows === null) void refresh(); }, [open, rows, refresh]);

  const del = async (id: string) => {
    setBusy(id);
    try {
      await deleteJudgeExemplar(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const positives = rows?.filter(r => r.kind === "positive").length ?? 0;
  const negatives = rows?.filter(r => r.kind === "negative").length ?? 0;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen(o => !o)} className="text-sm font-semibold text-zinc-200">
          🧠 What the judge learned
          {rows && <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">{positives} apply</span>}
          {rows && <span className="ml-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-400">{negatives} skip</span>}
          <span className="ml-2 text-xs text-zinc-500">{open ? "▴" : "▾"}</span>
        </button>
        {open && <button onClick={() => void refresh()} className="text-xs text-zinc-400 hover:text-zinc-200">↻ refresh</button>}
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        Every verdict you record (✓ Applied, ✕ Not interested, 👍/👎) becomes one of these lines in the AI judge's prompt —
        it imitates <i>your</i> taste on future postings. Deleting a line removes that lesson.
      </div>
      {open && (
        <div className="mt-2">
          {error && <div className="mb-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
          {rows === null && <div className="text-xs text-zinc-500">Loading…</div>}
          {rows?.length === 0 && <div className="text-xs text-zinc-500">Nothing learned yet — resolve review-queue rows or use 👍/👎 to teach it.</div>}
          <div className="space-y-1.5">
            {rows?.map(r => (
              <div key={r.id} className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${r.kind === "positive" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                  {r.kind === "positive" ? "APPLY" : "SKIP"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-zinc-200" title={r.summary}>{r.summary}</div>
                  {r.reason && <div className="truncate text-[11px] text-zinc-500" title={r.reason}>{r.reason}</div>}
                </div>
                <span className="shrink-0 text-[10px] text-zinc-600">{ago(r.created_at)}</span>
                {r.source_url && (
                  <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] text-sky-400 hover:text-sky-300">↗</a>
                )}
                {busy === r.id ? (
                  <span className="shrink-0 text-xs text-zinc-500">…</span>
                ) : (
                  <button onClick={() => void del(r.id)} title="Delete this lesson — the judge stops imitating it"
                    className="shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-400 hover:border-red-600 hover:text-red-400">🗑</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
