/* Applications report — every per-job decision the engine recorded
   (submitted / needs review / skipped / error), newest first, with counts.
   The engine pushes one apply_results row per decision, so this is the full
   story; the review queue handles only the "you must act" subset. */

import { useCallback, useEffect, useState } from "react";
import { listApplyResults, applyResultCounts, type ApplyResultRow } from "../../services/jobSites.ts";

const RESULT_META: Record<ApplyResultRow["result"], { icon: string; label: string; cls: string }> = {
  submitted: { icon: "✅", label: "applied", cls: "bg-emerald-500/15 text-emerald-400" },
  needs_review: { icon: "⏸", label: "needs you", cls: "bg-amber-500/15 text-amber-400" },
  skipped: { icon: "⏭", label: "skipped", cls: "bg-zinc-500/15 text-zinc-400" },
  error: { icon: "✗", label: "error", cls: "bg-red-500/15 text-red-400" },
};

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ApplyResultsPanel() {
  const [rows, setRows] = useState<ApplyResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApplyResultRow["result"] | "all">("all");

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setRows(await listApplyResults(150));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (rows === null) return <div className="mt-3 text-xs text-zinc-500">Loading applications report…</div>;

  const counts = applyResultCounts(rows);
  const shown = filter === "all" ? rows : rows.filter((r) => r.result === filter);

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-200">📊 Applications report</div>
        <button onClick={() => void refresh()} className="text-xs text-zinc-400 hover:text-zinc-200">↻ refresh</button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(["submitted", "needs_review", "skipped", "error"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(filter === k ? "all" : k)}
            className={`rounded px-2 py-0.5 text-[11px] font-bold ${RESULT_META[k].cls} ${filter === k ? "ring-1 ring-zinc-400" : "opacity-80"}`}>
            {RESULT_META[k].icon} {counts[k]} {RESULT_META[k].label}
          </button>
        ))}
        {filter !== "all" && <button onClick={() => setFilter("all")} className="rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200">✕ clear filter</button>}
      </div>

      {error && <div className="mt-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
      {!rows.length && <div className="mt-2 text-xs text-zinc-500">No decisions recorded yet — they land here as soon as the engine runs a site.</div>}

      <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {shown.map((r) => (
          <div key={r.id} className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${RESULT_META[r.result].cls}`}>
                {RESULT_META[r.result].icon} {RESULT_META[r.result].label}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">
                {r.title || "(untitled posting)"}{r.company ? <span className="text-zinc-500"> — {r.company}</span> : null}
              </span>
              {typeof r.fit === "number" && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${r.fit >= 80 ? "bg-emerald-500/15 text-emerald-400" : r.fit >= 50 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>fit {r.fit}</span>
              )}
              <span className="shrink-0 text-[10.5px] text-zinc-600">{ago(r.created_at)}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-zinc-500">
              <span className="truncate">{r.site_host}{r.detail ? ` · ${r.detail}` : ""}</span>
              {r.job_url && (
                <a href={r.job_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sky-500 hover:text-sky-400">open ↗</a>
              )}
            </div>
          </div>
        ))}
        {!shown.length && rows.length > 0 && <div className="text-xs text-zinc-500">No rows for this filter.</div>}
      </div>
    </div>
  );
}
