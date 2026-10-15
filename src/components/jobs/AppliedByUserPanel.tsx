/* ✓ Applied by user — every resolved review-queue posting (Done / ✕ Not
   interested / 🚫 Closed), one row per URL-variant dedupe, newest resolve
   first. Standalone panel parallel to the Applications report / registry /
   credentials (owner's call: the history was buried inside the review
   queue and nobody found it). Same ⏱ posting-age filter semantics as the
   queue — UNDATED rows ALWAYS show, marked "no stamp" while a cap is
   active (a missing stamp must never hide your own history). Un-resolve
   sends a fat-fingered verdict back to pending (variant-wide server-side). */

import { useCallback, useEffect, useState } from "react";
import {
  listResolvedJobReviews, unresolveJobReview,
  type ResolvedReviewItem,
} from "../../services/jobSites.ts";
import { postedAgeChip, passesAgeFilter, cleanPostingTitle } from "../../../scripts/apply-engine-lib.js";

/* same cycle as the queue/report */
const MAX_AGE_OPTIONS = [null, 7, 14, 30] as const;
const MAX_AGE_LABEL = { "7": "≤ 7d", "14": "≤ 14d", "30": "≤ 30d" } as const;

const STATUS_META: Record<ResolvedReviewItem["status"], { chip: string; cls: string }> = {
  done: { chip: "✓ applied", cls: "bg-emerald-500/15 text-emerald-400" },
  dismissed: { chip: "✕ not interested", cls: "bg-red-500/15 text-red-400" },
  closed: { chip: "🚫 closed", cls: "bg-zinc-500/15 text-zinc-300" },
};

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AppliedByUserPanel() {
  const [rows, setRows] = useState<ResolvedReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /* posting-age filter (the BOARD's clock, NOT resolved_at): cycles any →
     ≤7d → ≤14d → ≤30d → any; UNDATED rows survive every step (fail-open). */
  const [maxAge, setMaxAge] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setRows(await listResolvedJobReviews());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      /* null, not []: null means "RPC not applied yet" → the panel renders
         its collapsed shell with an honest hint instead of a fake-empty list */
      setRows(null);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /* un-resolve: optimistic out + refetch; failure restores via refresh */
  const unresolve = async (r: ResolvedReviewItem) => {
    setBusyId(r.id);
    setError(null);
    try {
      await unresolveJobReview(r.id);
      setRows((prev) => (prev ?? []).filter((x) => x.id !== r.id));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (rows === null) {
    return (
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="text-sm font-semibold text-zinc-200">✓ Applied by User</div>
        <div className="mt-1 text-xs text-zinc-400">
          Resolved-history unavailable — apply <code className="rounded bg-zinc-800 px-1">supabase/review-queue-resolved.sql</code> in the
          Supabase SQL editor (it carries the <code className="rounded bg-zinc-800 px-1">admin_list_resolved_job_reviews</code> RPC).
          <button onClick={() => void refresh()} className="ml-2 text-zinc-300 underline underline-offset-2 hover:text-zinc-100">↻ retry</button>
        </div>
      </div>
    );
  }

  const shown = rows.filter((r) => passesAgeFilter(r.posted_age_h ?? null, maxAge));
  const applied = rows.filter((r) => r.status === "done").length;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
          ✓ Applied by User
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">{applied} applied</span>
          <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">{rows.length} resolved</span>
          <span className="text-xs text-zinc-300">{open ? "▴" : "▾"}</span>
        </button>
        <button onClick={() => void refresh()} className="text-xs text-zinc-300 hover:text-zinc-100">↻ refresh</button>
      </div>
      {open && (<>
      <div className="mt-1.5 text-xs text-zinc-300">
        Every review-queue posting you resolved — ✓ Applied teaches the judge this kind of job is relevant,
        ✕/🚫 teach it to stop showing similar ones. Mistake? <b className="text-zinc-200">↺ Un-resolve</b> sends the posting back to the pending queue.
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button onClick={() => setMaxAge(prev => {
          const i = MAX_AGE_OPTIONS.findIndex(v => v === prev);
          return MAX_AGE_OPTIONS[(i + 1) % MAX_AGE_OPTIONS.length] as number | null;
        })}
          title="Filter by the posting's own age (its board stamp) — cycle any → ≤7d → ≤14d → ≤30d → any. Rows the board never stamped are ALWAYS shown (fail-open)."
          className={`rounded px-2 py-0.5 text-[11px] font-bold ${maxAge !== null ? "bg-sky-600 text-white" : "bg-zinc-800 text-zinc-300 hover:text-zinc-100"}`}>
          ⏱ {maxAge === null ? "posting age: any" : `posting ${(MAX_AGE_LABEL as Record<string, string>)[String(maxAge)]}`}
        </button>
        {maxAge !== null && <span className="self-center text-[11px] text-zinc-400">{shown.length} of {rows.length} shown</span>}
      </div>
      {error && <div className="mt-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
      {!rows.length && <div className="mt-2 text-xs text-zinc-300">Nothing here yet — resolve a posting in the review queue and it lands here.</div>}
      <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {shown.map((r) => (
          <div key={r.id} className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${STATUS_META[r.status].cls}`}>
                {STATUS_META[r.status].chip}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">
                {cleanPostingTitle(r.title)}{r.company ? <span className="text-zinc-400"> — {cleanPostingTitle(r.company)}</span> : null}
              </span>
              {typeof r.fit === "number" && (
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${r.fit >= 80 ? "bg-emerald-500/15 text-emerald-400" : r.fit >= 50 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>fit {r.fit}</span>
              )}
              {r.posted_age_h != null && postedAgeChip(r.posted_age_h).trim() !== "" && (
                <span title="The posting's own age when the engine saw it (the board's card stamp)" className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                  {postedAgeChip(r.posted_age_h).trim()}
                </span>
              )}
              {maxAge !== null && r.posted_age_h == null && (
                <span title="This board never stamped the posting's age, so the ⏱ filter can't judge it — it always shows (fail-open)" className="shrink-0 rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                  ⏱ no stamp
                </span>
              )}
              <span className="shrink-0 text-[11px] text-zinc-400">{ago(r.resolved_at)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-300">
              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-bold text-zinc-300">{r.site_host}</span>
              <a href={r.job_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sky-500 hover:text-sky-400">open ↗</a>
              <button disabled={busyId === r.id}
                onClick={() => void unresolve(r)}
                title="Made a mistake? This puts the posting BACK into the pending review queue (its URL twins come too)"
                className="ml-auto shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300 hover:border-amber-600 hover:text-amber-400 disabled:opacity-40">
                ↺ Un-resolve
              </button>
            </div>
          </div>
        ))}
        {!shown.length && rows.length > 0 && <div className="text-xs text-zinc-300">No resolved rows for this filter.</div>}
      </div>
      </>)}
    </div>
  );
}
