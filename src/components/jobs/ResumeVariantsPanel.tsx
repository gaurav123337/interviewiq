/* ✂ Tailored resumes (Phase 2) — every LLM-tailored kit the engine builds
   lands here with a per-section diff vs the master template and the JD
   keywords that justify each change ("tailored as per JD, and I can see
   it"). Approving a variant is what unlocks auto-submit for that kit on
   the engine's next run (see tailorSubmitGate — apply-kit-lib.js): one
   variant per content hash, so a changed tailoring asks again. */

import { useCallback, useEffect, useState } from "react";
import { listResumeVariants, approveResumeVariant, type ResumeVariantRow } from "../../services/jobSites.ts";

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* per-section justification line: heading + the keywords that support it */
function SectionList({ row }: { row: ResumeVariantRow }) {
  const sections = row.diff_summary?.sections ?? [];
  const changed = sections.filter((s) => s.status === "changed");
  if (!changed.length) return <div className="text-[11px] text-zinc-400">No section-level diff recorded.</div>;
  return (
    <div className="mt-1 space-y-0.5">
      {changed.map((s, i) => (
        <div key={i} className="flex items-baseline gap-1.5 text-[11px] leading-4">
          <span className="shrink-0 font-semibold text-zinc-300">{s.heading}:</span>
          {s.matchedKeywords?.length ? (
            <span className="min-w-0 flex-1 text-zinc-400">
              justified by {s.matchedKeywords.join(", ")}
            </span>
          ) : (
            <span className="min-w-0 flex-1 italic text-zinc-500">no JD keyword support — read the full diff before trusting it</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ResumeVariantsPanel() {
  const [rows, setRows] = useState<ResumeVariantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setRows(await listResumeVariants());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  }, []);

  /* lazy load like ExemplarsPanel — the RPC errors honestly when the SQL
     isn't applied yet (degrade rule: show the error, never pretend empty) */
  useEffect(() => { if (open && rows === null) void refresh(); }, [open, rows, refresh]);

  const setApproval = async (row: ResumeVariantRow, approved: boolean) => {
    setBusy(row.id);
    try {
      await approveResumeVariant(row.id, approved);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const unapproved = rows?.filter((r) => !r.approved).length ?? 0;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen((o) => !o)} className="text-sm font-semibold text-zinc-200">
          ✂ Tailored resumes
          {rows && (unapproved !== 0 || rows.length > 0) && (
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${unapproved ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"}`}>
              {unapproved ? `${unapproved} awaiting approval` : "all approved"}
            </span>
          )}
          <span className="ml-2 text-xs text-zinc-300">{open ? "▴" : "▾"}</span>
        </button>
        {open && <button onClick={() => void refresh()} className="text-xs text-zinc-300 hover:text-zinc-100">↻ refresh</button>}
      </div>
      <div className="mt-1 text-xs text-zinc-300">
        An AI-tailored resume auto-submits ONLY after you approve it here (or set <code className="font-mono">&quot;autoTailor&quot;: true</code> in the apply profile).
        Approving a variant unlocks the gate for THAT posting on the engine's next run.
      </div>
      {open && (
        <div className="mt-2">
          {error && <div className="mb-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
          {rows === null && <div className="text-xs text-zinc-300">Loading…</div>}
          {rows?.length === 0 && (
            <div className="text-xs text-zinc-300">
              No tailored variants yet — they appear after a run builds an AI kit
              (needs <code className="font-mono">apply-resume-variants.sql</code> applied).
            </div>
          )}
          <div className="space-y-1.5">
            {rows?.map((r) => (
              <div key={r.id} className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${r.approved ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                    {r.approved ? "APPROVED" : "AWAITING"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-zinc-200" title={`${r.title ?? ""} — ${r.company ?? ""}`}>
                      {r.title || "(untitled)"}{r.company ? ` · ${r.company}` : ""}
                    </div>
                    {r.diff_summary?.changedCount === 0 && (
                      <div className="text-[11px] text-zinc-500">identical to master</div>
                    )}
                  </div>
                  <button onClick={() => setExpanded((e) => (e === r.id ? null : r.id))} className="shrink-0 text-[11px] text-zinc-400 hover:text-zinc-200" title="Show what changed and why">
                    {expanded === r.id ? "hide diff" : "diff"}
                  </button>
                  <span className="shrink-0 text-[11px] text-zinc-400">{ago(r.created_at)}</span>
                  {busy === r.id ? (
                    <span className="shrink-0 text-xs text-zinc-300">…</span>
                  ) : r.approved ? (
                    <button onClick={() => void setApproval(r, false)} title="Revert approval — auto-submit is held again"
                      className="shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-300 hover:border-red-600 hover:text-red-400">✕ revert</button>
                  ) : (
                    <button onClick={() => void setApproval(r, true)} title="Approve this tailored resume — the engine may auto-submit it next run"
                      className="shrink-0 rounded border border-emerald-700 px-1.5 py-0.5 text-[11px] text-emerald-400 hover:border-emerald-400">✓ approve</button>
                  )}
                </div>
                {expanded === r.id && (
                  <div className="mt-1.5 rounded bg-zinc-950/60 px-2 py-1.5">
                    {r.job_url && (
                      <a href={r.job_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-400 hover:text-sky-300">
                        open posting ↗
                      </a>
                    )}
                    <SectionList row={r} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
