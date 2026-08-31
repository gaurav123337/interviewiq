/* Jd scan card — paste any job description and score the saved career profile
   against it, reusing the live feed's verdict vocabulary (VERDICT_META) and the
   same matched / missing / gap-plan / Pro-lock affordances the MatchFeedCard
   uses. All logic lives in services/jobs/jdScan.ts; this is presentation. */

import { useMemo, useState } from "react";
import type { CareerProfile, JdScan, JobPosting } from "../../types";
import {
  VERDICT_META, deleteJdScan, listJdScans, matchScan, saveJdScan, scanResumeAgainstJd
} from "../../services/jobs";
import { FIELDS, LEVELS } from "../../data";
import { btnPrimary, cardCls, Chip } from "../ui";
import { toast } from "../../toast";

/* verdict tone → text color (mirrors MatchFeedCard / VERDICT_META tones) */
const verdictToneCls = (tone: string) =>
  tone === "ok" ? "text-ok" : tone === "co" ? "text-acctxt" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-mut";

interface JdScanCardProps {
  profile: CareerProfile | null;
  locked: boolean;
  onAddSkill: (s: string) => void;
  onUpgrade: (msg: string) => void;
  onGapPlan: (job: JobPosting, missing: string[]) => void;
}

export function JdScanCard({ profile, locked, onAddSkill, onUpgrade, onGapPlan }: JdScanCardProps) {
  const [jdText, setJdText] = useState("");
  const [scans, setScans] = useState<JdScan[]>(() => listJdScans());
  const [activeId, setActiveId] = useState<string | null>(() => listJdScans()[0]?.id ?? null);

  const active = useMemo(() => scans.find(s => s.id === activeId) ?? scans[0] ?? null, [scans, activeId]);
  /* recomputed live so adding a missing skill re-scores the scan, exactly like
     the feed re-scores its jobs when the profile changes */
  const match = useMemo(() => (active ? matchScan(profile, active) : null), [profile, active]);

  const run = () => {
    const text = jdText.trim();
    if (text.length < 40) { toast("Paste the full job description — a line or two isn't enough to match."); return; }
    const scan = scanResumeAgainstJd(text, Date.now());
    setScans(saveJdScan(scan));
    setActiveId(scan.id);
    setJdText("");
    toast(`🔎 Scanned against “${scan.job.title}” — ${scan.job.skills.length} skill${scan.job.skills.length === 1 ? "" : "s"} detected`);
  };

  const remove = (id: string) => {
    const next = deleteJdScan(id);
    setScans(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const fieldName = active ? (FIELDS.find(f => f.id === active.detected.fieldId)?.name ?? active.detected.fieldId) : "";
  const levelName = active ? (LEVELS.find(l => l.id === active.detected.levelId)?.name ?? "") : "";

  return (
    <div className={`${cardCls} mt-5 p-5`}>
      <div>
        <h3 className="text-[14.5px] font-extrabold">🔎 Scan a job description</h3>
        <p className="mt-0.5 text-[11.5px] text-fnt">
          Paste any posting — your resume is scored against it with the same verdict the feed uses, so you can check a specific role before you apply.
          {profile ? "" : " Add your career profile above first."}
        </p>
      </div>

      <div className="mt-3">
        <textarea
          className="inp min-h-[104px] w-full resize-y text-[13px]"
          placeholder="Paste the full job description here — responsibilities, requirements, tech stack…"
          value={jdText}
          onChange={e => setJdText(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className={btnPrimary} onClick={run} disabled={!jdText.trim()}>
            🔎 Scan against my resume
          </button>
          {jdText.trim() && <span className="text-[11px] text-mut">{jdText.trim().length.toLocaleString()} chars</span>}
        </div>
      </div>

      {active && match && (
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold transition-all ${locked ? "border-line/20 bg-wht/10 text-mut hover:text-ink" : `${verdictToneCls(VERDICT_META[match.verdict]?.tone ?? "default")} border-current/25 bg-current/10`}`}
              onClick={() => locked && onUpgrade("Match verdicts, reasons and the skill-gap roadmap are Pro features.")}
              title={locked ? "Pro feature" : VERDICT_META[match.verdict]?.label}
            >
              {locked ? "🔒 Match verdict" : `${match.score}% · ${VERDICT_META[match.verdict]?.label}`}
            </button>
            <span className="text-[14px] font-extrabold">{active.job.title}</span>
            {active.job.remote && <Chip tone="ok">REMOTE</Chip>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-mut">
            {levelName && <Chip tone="lvl">{levelName}</Chip>}
            {fieldName && <Chip tone="cat">{fieldName}</Chip>}
            {active.job.company && active.job.company !== "Pasted job description" && <span className="font-bold text-ink">{active.job.company}</span>}
          </div>

          {locked ? (
            <p className="mt-2 text-[11.5px] text-mut">Unlock Pro to see why this is or isn't a match — and get a step-by-step plan to close the gaps.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
              {match.matched.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Matched:</span>
                  {match.matched.map(s => <Chip key={s} tone="ok" title="Appears in your resume">✓ {s}</Chip>)}
                </span>
              )}
              {match.missing.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Missing:</span>
                  {match.missing.map(s => (
                    <button
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full border border-bad/30 bg-bad/10 px-2 py-0.5 text-[11.5px] font-semibold text-bad transition-all hover:bg-bad/20"
                      onClick={() => onAddSkill(s)}
                      title={`Add "${s}" to my profile skills`}
                    >
                      {s} <span className="text-[10px] opacity-60">+add</span>
                    </button>
                  ))}
                </span>
              )}
              {match.missing.length > 0 && (
                <button
                  className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
                  onClick={() => onGapPlan(active.job, match.missing)}
                >
                  📈 Gap plan
                </button>
              )}
              {match.blockers.map((b, i) => <span key={i} className="text-warn">⚠️ {b}</span>)}
              {match.matched.length === 0 && match.missing.length === 0 && (
                <span className="text-mut">No specific skills detected in this posting — the verdict is based on domain, title and seniority fit.</span>
              )}
            </div>
          )}
        </div>
      )}

      {scans.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-mut">Recent scans:</span>
          {scans.map(s => (
            <span
              key={s.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold transition-all ${s.id === active?.id ? "border-acc1/50 bg-acc1/15 text-acctxt" : "border-line/20 bg-wht/5 text-mut hover:text-ink"}`}
            >
              <button onClick={() => setActiveId(s.id)} title={s.job.title}>
                {s.job.title.length > 28 ? s.job.title.slice(0, 27) + "…" : s.job.title}
              </button>
              <button onClick={() => remove(s.id)} title="Remove scan" className="text-[10px] opacity-50 hover:opacity-100">✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
