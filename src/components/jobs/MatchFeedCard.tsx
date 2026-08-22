import type { CareerProfile, JobPosting } from "../../types";
import { VERDICT_META, salaryLabel } from "../../services/jobs";
import type { MatchVerdict } from "../../types";
import { sourceLabel, trustOf } from "../../services/importJob";
import { jdKeywords } from "../../services/applyKit";
import { STATUS_META, STATUS_ORDER, type ApplyStatus, type ApplyTrack } from "../../services/applyTrack";
import { btnGhost, btnSm, Chip } from "../ui";

const verdictToneCls = (tone: string) =>
  tone === "ok" ? "text-ok" : tone === "co" ? "text-acctxt" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-mut";

interface MatchFeedCardProps {
  job: JobPosting;
  match: { score: number; verdict: string; matched: string[]; missing: string[]; blockers: string[] };
  locked: boolean;
  track: ApplyTrack | undefined;
  displayCurrency: string;
  profile: CareerProfile | null;
  onAddSkill: (s: string) => void;
  onGapPlan: (job: JobPosting, missing: string[]) => void;
  onKit: (job: JobPosting) => void;
  onApply: (job: JobPosting) => void;
  onStatusChange: (jobId: string, status: ApplyStatus) => void;
  onFollowUpDate: (jobId: string, date: string) => void;
  onDraft: (track: ApplyTrack) => void;
  onRound: (track: ApplyTrack) => void;
  onUpgrade: (msg: string) => void;
  isDue: boolean;
}

export function MatchFeedCard({
  job: j, match: m, locked, track,
  displayCurrency, profile,
  onAddSkill, onGapPlan, onKit, onApply,
  onStatusChange, onFollowUpDate, onDraft, onRound, onUpgrade, isDue,
}: MatchFeedCardProps) {
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold transition-all ${locked ? "border-line/20 bg-wht/10 text-mut hover:text-ink" : `${verdictToneCls(VERDICT_META[m.verdict as MatchVerdict]?.tone ?? "default")} border-current/25 bg-current/10`}`}
          onClick={() => locked && onUpgrade("Match verdicts, reasons and the skill-gap roadmap are Pro features.")}
          title={locked ? "Pro feature" : VERDICT_META[m.verdict as MatchVerdict]?.label}
        >
          {locked ? "🔒 Match verdict" : `${m.score}% · ${VERDICT_META[m.verdict as MatchVerdict]?.label}`}
        </button>
        <span className="text-[14px] font-extrabold">{j.title}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-mut">
        <span className="font-bold text-ink">{j.company}</span>
        {j.location && <span>📍 {j.location}</span>}
        {j.remote && <Chip tone="ok">REMOTE</Chip>}
        {j.level && <span>· {j.level}</span>}
        {j.alsoSources && j.alsoSources.length > 0 && (
          <Chip tone="default" title={`Also posted on ${j.alsoSources.join(", ")}`}>
            ＋{j.alsoSources.length} on {j.alsoSources.join(", ")}
          </Chip>
        )}
        {(() => { const s = salaryLabel(j, displayCurrency); return s ? <span className="font-bold text-ok">💰 {s}</span> : null; })()}
        <span className="inline-flex items-center gap-1 rounded-full border border-line/15 bg-wht/[.04] px-2 py-0.5 text-[10.5px] font-semibold text-fnt" title={trustOf(j.source).title}>
          <span aria-hidden>{trustOf(j.source).icon}</span> {trustOf(j.source).label}
        </span>
        {j.url && <a href={j.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-acc1/30 bg-acc1/5 px-2 py-0.5 text-[11px] font-bold text-acctxt transition-all hover:bg-acc1/15">View →</a>}
      </div>
      {!locked && (m.matched.length || m.missing.length || m.blockers.length) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
          {m.matched.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Matched:</span>
              {m.matched.map(s => (
                <Chip key={s} tone="ok" title="Appears in your resume">✓ {s}</Chip>
              ))}
            </span>
          )}
          {m.missing.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Missing:</span>
              {m.missing.map(s => (
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
          {m.missing.length > 0 && (
            <button
              className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
              onClick={() => onGapPlan(j, m.missing)}
            >
              📈 Gap plan
            </button>
          )}
          <button
            className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
            onClick={() => locked ? onUpgrade("Tailored resumes and cover letters are Pro features.") : onKit(j)}
          >
            📄 Resume & letter
          </button>
          <button
            className="rounded-full border border-ok/30 bg-ok/10 px-2.5 py-0.5 text-[11.5px] font-bold text-ok transition-all hover:bg-ok/20"
            onClick={() => onApply(j)}
            title={`Open the official application on ${sourceLabel(j.source)}`}
          >
            🔗 Apply on {sourceLabel(j.source)} ↗
          </button>
          {m.blockers.map((b, i) => (
            <span key={i} className="text-warn">⚠️ {b}</span>
          ))}
        </div>
      )}
      {!locked && m.missing.length === 0 && (() => {
        const has = new Set((profile?.skills ?? []).map(s => s.toLowerCase()));
        const skip = new Set([...m.matched, ...m.missing].map(s => s.toLowerCase()));
        const jd = jdKeywords(j, 6).filter(k => !has.has(k) && !skip.has(k));
        if (!jd.length) return null;
        return (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-mut">💡 Leans on</span>
            {jd.slice(0, 4).map(k => (
              <button
                key={k}
                className="inline-flex items-center gap-1 rounded-full border border-acc1/30 bg-acc1/10 px-2 py-0.5 text-[11.5px] font-semibold text-acctxt transition-all hover:bg-acc1/20"
                onClick={() => onAddSkill(k)}
              >
                {k} <span className="text-[10px] opacity-60">+</span>
              </button>
            ))}
          </div>
        );
      })()}
      {!locked && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line/10 pt-2.5">
          {isDue && (
            <button
              className="rounded-full border border-warn/50 bg-warn/15 px-2.5 py-1 text-[11.5px] font-extrabold text-warn transition-all hover:bg-warn/25"
              onClick={() => track && onDraft(track)}
              title="Follow-up is due"
            >
              🔔 Follow up
            </button>
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Track:</span>
          <select
            className="cursor-pointer rounded-full border border-line/20 bg-deep/40 px-2.5 py-1 text-[11.5px] font-bold text-fnt outline-none transition-all hover:text-ink"
            value={track?.status ?? "saved"}
            onChange={e => onStatusChange(j.id, e.target.value as ApplyStatus)}
          >
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
            ))}
          </select>
          <input
            type="date"
            className="cursor-pointer rounded-full border border-line/20 bg-deep/40 px-2.5 py-1 text-[11.5px] font-bold text-fnt outline-none transition-all hover:text-ink"
            value={track?.followUpAt ? new Date(track.followUpAt).toISOString().slice(0, 10) : ""}
            onChange={e => onFollowUpDate(j.id, e.target.value)}
          />
          {track && (track.status === "applied" || track.status === "interview" || track.status === "offer") && (
            <button
              className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-1 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
              onClick={() => onDraft(track)}
            >
              ✍️ Follow-up
            </button>
          )}
          {track?.status === "interview" && (
            <button
              className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-1 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
              onClick={() => onRound(track)}
            >
              🎤 Rounds {track.rounds.length > 0 ? `(${track.rounds.length})` : ""}
            </button>
          )}
        </div>
      )}
      {locked && (
        <p className="mt-2 text-[11.5px] text-mut">Unlock Pro to see why this is or isn't a match — and get a step-by-step plan to close the gaps.</p>
      )}
    </li>
  );
}
