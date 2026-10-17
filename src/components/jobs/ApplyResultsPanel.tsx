/* Applications report — every per-job decision the engine recorded
   (submitted / needs review / skipped / error), newest first, with counts.
   The engine pushes one apply_results row per decision, so this is the full
   story; the review queue handles only the "you must act" subset. */

import { useCallback, useEffect, useState } from "react";
import {
  listApplyResults, applyResultCounts, sendApplyFeedback, getSkillStrikes, putJudgeExemplar,
  listFormAnswerStats, type ApplyResultRow, type FormAnswerStats,
} from "../../services/jobSites.ts";
import { extractFeedbackSkills, postedAgeChip, passesAgeFilter, cleanPostingTitle } from "../../../scripts/apply-engine-lib.js";

/** max-age filter cycle for the report (shown only when filtering): rows
    whose posting age the board never stamped are ALWAYS shown — a missing
    stamp must never hide a posting from the owner's own list. */
const MAX_AGE_OPTIONS = [null, 7, 14, 30] as const;
const MAX_AGE_LABEL = { "7": "≤ 7d", "14": "≤ 14d", "30": "≤ 30d" } as const;

/** host part of a job/form URL → source chip; falls back to the row's site_host */
function sourceOf(r: ApplyResultRow): string {
  try { return new URL(r.job_url).hostname.replace(/^www\./, ""); } catch { return r.site_host; }
}

const RESULT_META: Record<ApplyResultRow["result"], { icon: string; label: string; cls: string }> = {
  submitted: { icon: "✅", label: "applied", cls: "bg-emerald-500/15 text-emerald-400" },
  needs_review: { icon: "⏸", label: "needs you", cls: "bg-amber-500/15 text-amber-400" },
  skipped: { icon: "⏭", label: "skipped", cls: "bg-zinc-500/15 text-zinc-300" },
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
  const [strikes, setStrikes] = useState<{ skill: string; strikes: number }[]>([]);
  /* 🧠 answer-memory savings: per site, how many remembered answers exist
     and how often the engine actually reused them while filling forms
     (form-answer-reuse.sql). Absent SQL = empty strip, no crash. */
  const [memory, setMemory] = useState<FormAnswerStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApplyResultRow["result"] | "all">("all");
  /* posting-age filter (the board's clock, NOT created_at): cycles any →
     ≤7d → ≤14d → ≤30d → any; UNDATED rows survive every step (fail-open). */
  const [maxAge, setMaxAge] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setRows(await listApplyResults(150));
      setStrikes(await getSkillStrikes().catch(() => []));
      setMemory(await listFormAnswerStats().catch(() => null));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /* 👎 → the row's skills gain a strike (2 = learned hard reject, decays
     after 30 days); 👍 → clears those strikes AND teaches the judge a
     positive exemplar — this finally closes the SKIP loop: skipped rows
     (the 131-skips class) can be corrected too. Skills are parsed from the
     row's detail line ("JD requires java, sql — not on the resume", "core
     skill missing: …", etc.) via the engine's shared parser. */
  const learn = async (r: ApplyResultRow, verdict: "good" | "bad") => {
    setBusyId(r.id);
    try {
      const skills = extractFeedbackSkills(r.detail ?? "");
      /* optimistic lock: the choice is final the moment it lands — no double-click
         window before the refetched rows come back with feedback set */
      setRows((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, feedback: verdict } : x)));
      await sendApplyFeedback(r.id, verdict, skills);
      if (r.result === "skipped") {
        /* skipped rows teach the JUDGE (the strike RPC already ran server-side
           inside engine_apply_feedback): 👍 = "this skip was wrong" (positive
           exemplar + strike clear), 👎 = "correct skip" (negative exemplar so
           similar postings keep getting skipped). Best-effort — verdict is
           already stored. */
        const label = `${r.title || "(untitled)"}${r.company ? ` — ${r.company}` : ""}`;
        await putJudgeExemplar(
          verdict === "good" ? "positive" : "negative",
          verdict === "good"
            ? `${label}: owner UN-skipped — this was wrongly rejected by the gates`
            : `${label}: owner confirmed the skip`,
          r.detail || undefined,
          r.job_url || undefined,
        ).catch(() => {});
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  if (rows === null) return <div className="mt-3 text-xs text-zinc-300">Loading applications report…</div>;

  const counts = applyResultCounts(rows);
  /* result filter ∩ posting-age filter (postedAgeChip/passesAgeFilter: the
     lib's own meaning of "stale" — undated rows always survive) */
  const shown = rows.filter((r) =>
    (filter === "all" || r.result === filter) &&
    passesAgeFilter(r.posted_age_h ?? null, maxAge));

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
          📊 Applications report
          {rows.length > 0 && <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">{rows.length}</span>}
          <span className="text-xs text-zinc-300">{open ? "▴" : "▾"}</span>
        </button>
        <button onClick={() => void refresh()} className="text-xs text-zinc-300 hover:text-zinc-100">↻ refresh</button>
      </div>
      {open && (<>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(["submitted", "needs_review", "skipped", "error"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(filter === k ? "all" : k)}
            className={`rounded px-2 py-0.5 text-[11px] font-bold ${RESULT_META[k].cls} ${filter === k ? "ring-1 ring-zinc-400" : "opacity-80"}`}>
            {RESULT_META[k].icon} {counts[k]} {RESULT_META[k].label}
          </button>
        ))}
        {filter !== "all" && <button onClick={() => setFilter("all")} className="rounded px-2 py-0.5 text-[11px] text-zinc-300 hover:text-zinc-100">✕ clear filter</button>}
        {/* posting-age filter: the BOARD's clock (posted_age_h), not created_at;
            undated rows always shown — a missing stamp never hides a posting */}
        <button onClick={() => setMaxAge(prev => {
          const i = MAX_AGE_OPTIONS.findIndex(v => v === prev);
          return MAX_AGE_OPTIONS[(i + 1) % MAX_AGE_OPTIONS.length] as number | null;
        })}
          title="Filter by the posting's own age (its board stamp) — cycle any → ≤7d → ≤14d → ≤30d → any. Rows the board never stamped are ALWAYS shown (fail-open)."
          className={`rounded px-2 py-0.5 text-[11px] font-bold ${maxAge !== null ? "bg-sky-600 text-white" : "bg-zinc-800 text-zinc-300 hover:text-zinc-100"}`}>
          ⏱ {maxAge === null ? "posting age: any" : `posting ${(MAX_AGE_LABEL as Record<string, string>)[String(maxAge)]}`}
        </button>
      </div>

      {error && <div className="mt-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
      {!rows.length && <div className="mt-2 text-xs text-zinc-300">No decisions recorded yet — they land here as soon as the engine runs a site.</div>}

      {memory && memory.length > 0 && (
        <div className="mt-2 rounded bg-teal-500/10 px-2 py-1.5 text-[11px] text-teal-300">
          🧠 Answer memory — the engine reuses your previously-confirmed answers instead of re-drafting or spending an AI call:
          {memory.filter((m) => m.answers > 0).map((m) => (
            <span key={m.site_host} className="ml-2 rounded bg-zinc-800/80 px-1.5 py-0.5 font-bold"
              title={`${m.answers} remembered answers · ${m.reused} reused at least once${m.last_used ? ` · last reuse ${new Date(m.last_used).toLocaleString()}` : ""}`}>
              {m.site_host}: {m.answers} stored{m.total_reuses > 0 ? ` · ↺${m.total_reuses}` : ""}
            </span>
          ))}
        </div>
      )}

      {strikes.length > 0 && (
        <div className="mt-2 rounded bg-fuchsia-500/10 px-2 py-1.5 text-[11px] text-fuchsia-300">
          🧠 Learned hard-rejects (2+ of your 👎): {strikes.map((s) => `${s.skill} ×${s.strikes}`).join(" · ")} — any JD requiring these is skipped automatically. 👍 on a new row clears a skill.
        </div>
      )}

      <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {shown.map((r) => (
          <div key={r.id} className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${RESULT_META[r.result].cls}`}>
                {RESULT_META[r.result].icon} {RESULT_META[r.result].label}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">
                {cleanPostingTitle(r.title)}{r.company ? <span className="text-zinc-400"> — {cleanPostingTitle(r.company)}</span> : null}
              </span>
              {typeof r.fit === "number" && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${r.fit >= 80 ? "bg-emerald-500/15 text-emerald-400" : r.fit >= 50 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`} title="Keyword overlap between the JD and your resume's skills — NOT an overall match. It ignores seniority, core function and core stack; the AI judge's verdict is in the detail line below.">fit {r.fit}</span>
              )}
              {/* the POSTING's own age chip (the board's clock) — rendered through
                  postedAgeChip, the same format the engine's console uses; null
                  (board never stamped) renders nothing, never "—" */}
              {r.posted_age_h != null && postedAgeChip(r.posted_age_h).trim() !== "" && (
                <span title="The posting's own age when the engine saw it (the board's card stamp) — not how long ago this decision was recorded" className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                  {postedAgeChip(r.posted_age_h).trim()}
                </span>
              )}
              <span className="shrink-0 text-[11px] text-zinc-400">{ago(r.created_at)}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-zinc-300">
              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-bold text-zinc-300">via {sourceOf(r)}</span>
              <span className="min-w-0 flex-1 truncate">{r.detail || ""}</span>
              {r.result === "needs_review" ? (
                <button onClick={() => document.getElementById("review-queue")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  title="Jump to the review queue — Open the form, submit, mark Done"
                  className="shrink-0 font-bold text-amber-400 hover:text-amber-300">needs you → review queue</button>
              ) : r.job_url ? (
                <a href={r.job_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sky-500 hover:text-sky-400">open ↗</a>
              ) : null}
              {(r.result === "submitted" || r.result === "needs_review" || r.result === "skipped") && (
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <button disabled={busyId === r.id || r.feedback === "good"} title="Good match — also clears any learned strikes on this row's missing skills (one choice per row — locked after clicking)"
                    onClick={() => void learn(r, "good")}
                    className={`rounded border px-1.5 py-0.5 ${r.feedback === "good" ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" : "border-zinc-700 text-zinc-400 hover:border-emerald-600 hover:text-emerald-400"} disabled:opacity-40 disabled:hover:border-zinc-700`}>👍</button>
                  <button disabled={busyId === r.id || r.feedback === "bad"} title="Wrong application — its missing-core skills get a strike (2 strikes = auto-reject forever; one choice per row — locked after clicking)"
                    onClick={() => void learn(r, "bad")}
                    className={`rounded border px-1.5 py-0.5 ${r.feedback === "bad" ? "border-red-500/60 bg-red-500/15 text-red-300" : "border-zinc-700 text-zinc-400 hover:border-red-600 hover:text-red-400"} disabled:opacity-40 disabled:hover:border-zinc-700`}>👎</button>
                </span>
              )}
            </div>
          </div>
        ))}
        {!shown.length && rows.length > 0 && <div className="text-xs text-zinc-300">No rows for this filter.</div>}
      </div>
      </>)}
    </div>
  );
}
