/* Skill Counselor — the dedicated learning-path menu (docs/skill-counselor.md).
   Pick a field → a track → a target level, and get:
     - the LEVEL-UP delta (what's new between where you are and the target),
     - the ordered skill path grouped by band, with the app's curated
       resources per skill (🔍 App suggested) and clear ⭐ Saved-by-you marks,
     - a gap-only view and a shareable plan text.
   Saving a resource routes through the SAME guard as the Resources view
   (submit-resource), so personal saves are still vetted. */

import { useEffect, useMemo, useState } from "react";
import { BAND_LABEL, BAND_ORDER, FIELDS, SKILLS, type Band } from "../data/skillCatalog";
import { applyManifestDiff, markManifestSeen, resourceQuality } from "../services/catalogMeta";
import { getCareerProfile } from "../services/jobs";
import { myResources, submitResource, type ResourceRow } from "../services/resources";
import { build90DayPlan, buildPlan, gapAnalysis, levelUpDelta, suggestTrack } from "../services/skillCounselor";
import { openSkillsReport } from "../services/skillsReport";
import { getGoal, saveGoal } from "../services/goal";
import { mergeGapKeywords } from "../services/gapPlan";
import { JD_KEYWORD_LIMIT } from "../services/roadmap/phases";
import {
  clearStudyPlan, getPlanProgress, getSavedStudyPlan, planProgressKey, saveStudyPlan, setWeekDone
} from "../services/studyPlan";
import { latestSignals, STAGE_META, type SkillSignal } from "../services/trendSignals";
import { getCloudState, subscribeCloud } from "../services/cloud";
import { useApp } from "../store";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip } from "./ui";

const BANDS: Band[] = ["junior", "mid", "senior", "staff", "principal", "cto"];

function dots(d: 1 | 2 | 3): string {
  return "●".repeat(d) + "○".repeat(3 - d);
}

export function Counselor() {
  const profile = useMemo(() => getCareerProfile(), []);
  const [cloud, setCloud] = useState(getCloudState());
  const [fieldId, setFieldId] = useState("frontend");
  const [trackId, setTrackId] = useState("ui-engineer");
  const [target, setTarget] = useState<Band>("senior");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [saved, setSaved] = useState<ResourceRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const { nav } = useApp();
  const [signals, setSignals] = useState<Record<string, SkillSignal>>({});
  const diff = useMemo(() => applyManifestDiff(), []);
  const [showNew, setShowNew] = useState(diff.isNew);
  const suggestion = useMemo(() => suggestTrack(profile), [profile]);
  const [perWeek, setPerWeek] = useState(4);
  const [study, setStudy] = useState<ReturnType<typeof build90DayPlan>>(() => getSavedStudyPlan());
  const [progress, setProgress] = useState<Record<number, boolean>>(() => {
    const p = getSavedStudyPlan();
    return p ? getPlanProgress(planProgressKey(p)) : {};
  });
  /* Live mirror of goal.jdKeywords — drives the "Add to Roadmap" button's count
     and disabled state, updated in place after a write-back. */
  const [jdKeywords, setJdKeywords] = useState<string[]>(() => getGoal()?.jdKeywords ?? []);

  const field = FIELDS.find(f => f.id === fieldId)!;
  const track = field.tracks.find(t => t.id === trackId) ?? field.tracks[0];

  useEffect(() => subscribeCloud(setCloud), []);

  useEffect(() => { void myResources().then(setSaved).catch(() => {}); }, []);
  useEffect(() => { void latestSignals().then(setSignals).catch(() => {}); }, []);

  const makePlan = () => {
    const p = build90DayPlan(profile, field.id, track.id, target, perWeek);
    if (!p) { toast("✗ Couldn't build a plan — no gaps to fill"); return; }
    saveStudyPlan(p);
    setStudy(p);
    setProgress(getPlanProgress(planProgressKey(p)));
    toast(`📅 Plan built — ${p.milestones.length} weeks, ~${p.totalHours}h`);
  };

  /* Feed the 90-day plan's skills into the Career Roadmap as P0 "Job description
     fit" topics — the same mergeGapKeywords seam the Job Gap Plan uses (Item 12).
     Appends the canonical skill labels to goal.jdKeywords only: it never touches
     the skill graph (so these stay gaps in the Counselor until genuinely earned)
     and never touches the goal's identity fields (so roadmap progress, keyed by
     the goal fingerprint, is preserved). */
  const addToRoadmap = (p: NonNullable<typeof study>) => {
    const names = p.milestones.flatMap(m => m.skillIds).map(id => SKILLS[id]?.name ?? id);
    const g = getGoal();
    if (!g) {
      toast("Set up your Roadmap goal first, then add these skills to it.");
      nav("roadmap");
      return;
    }
    const { next, added, dropped } = mergeGapKeywords(g.jdKeywords ?? [], names);
    if (added.length) {
      saveGoal({ ...g, jdKeywords: next });
      setJdKeywords(next);
      toast(dropped.length
        ? `🗺️ Added ${added.length} to your Roadmap · ${dropped.length} over the ${JD_KEYWORD_LIMIT}-skill limit — trim some in Roadmap`
        : `🗺️ Added ${added.length} skill${added.length === 1 ? "" : "s"} to your Roadmap — now P0 in “Job description fit”`);
    } else if (dropped.length) {
      toast(`Your Roadmap already lists ${JD_KEYWORD_LIMIT} job-fit skills — remove some in Roadmap to add more`);
    } else {
      toast("✓ These skills are already on your Roadmap");
    }
  };

  const toggleWeek = (p: NonNullable<typeof study>, week: number) => {
    const key = planProgressKey(p);
    const next = { ...progress, [week]: !progress[week] };
    setProgress(next);
    setWeekDone(key, week, !!next[week]);
  };

  useEffect(() => {
    /* when the field changes, snap to its first track and a sane target */
    const t = field.tracks[0];
    setTrackId(t.id);
    setTarget(t.maxBand === "cto" ? "staff" : t.maxBand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId]);

  const gap = useMemo(() => gapAnalysis(profile, field.id, track.id), [profile, field.id, track.id]);
  const delta = useMemo(() => levelUpDelta(profile, field.id, track.id, target), [profile, field.id, track.id, target]);
  const plan = useMemo(() => buildPlan(profile, field.id, track.id, target), [profile, field.id, track.id, target]);

  const saveResource = async (res: { title: string; url: string }, why: string) => {
    if (!cloud.user) { toast("✋ Sign in (Settings → Cloud sync) to save resources"); return; }
    setSaving(res.url);
    try {
      const r = await submitResource({
        url: res.url, title: res.title,
        description: `${why} — saved from the ${track.name} path.`,
        mode: "personal", category: field.id
      });
      if (!r.ok) { toast("✗ " + (r.error ?? "Couldn't save")); return; }
      toast("✅ Saved to your resources");
      setSaved(await myResources());
    } finally { setSaving(null); }
  };

  const isSaved = (url: string) => saved.some(s => s.url === url);

  if (!gap || !delta) {
    return <div className="anim-view mx-auto max-w-[860px] pt-16 text-center text-mut">Loading the catalog…</div>;
  }

  /* printable skills-to-job report — target, gaps, delta, 90-day plan, resources */
  const exportReport = () => {
    const user = getCloudState().user;
    openSkillsReport({
      candidate: user?.email ?? undefined,
      email: user?.email ?? undefined,
      fieldLabel: field.name,
      trackLabel: track.name,
      targetLabel: BAND_LABEL[target],
      currentBandLabel: BAND_LABEL[delta.currentBand],
      years: profile?.years ?? null,
      skills: profile?.skills ?? [],
      gaps: gap.missing.map(s => ({
        name: s.name,
        bandLabel: BAND_LABEL[s.band],
        difficulty: s.difficulty,
        why: s.why,
        prerequisites: s.prerequisites,
        trend: signals[s.id] ? STAGE_META[signals[s.id].stage]?.label : undefined
      })),
      deltaLines: delta.changes,
      weeks: (study?.milestones ?? []).map(m => ({
        week: m.week,
        title: m.title,
        hours: m.hours,
        skillNames: m.skillIds.map(id => SKILLS[id]?.name ?? id),
        done: !!progress[m.week]
      })),
      resources: gap.missing.flatMap(s =>
        s.resources.map(r => ({ skill: s.name, title: r.title, url: r.url, kind: r.kind, free: !!r.free }))
      )
    });
  };

  const bands = BANDS.filter(b => BAND_ORDER[b] <= BAND_ORDER[track.maxBand]);

  /* Preview of the Roadmap write-back (mergeGapKeywords is pure) so the button's
     count/disabled state mirrors the click precisely — it folds slug-aliased
     skills into one add and respects the JD_KEYWORD_LIMIT cap. Empty labels when
     no plan is built yet, so the button only renders (with study) once there is one. */
  const roadmapNames = study ? study.milestones.flatMap(m => m.skillIds).map(id => SKILLS[id]?.name ?? id) : [];
  const roadmapPreview = mergeGapKeywords(jdKeywords, roadmapNames);
  const roadmapAddCount = roadmapPreview.added.length;

  return (
    <div className="anim-view mx-auto max-w-[980px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🧑‍🏫 Skill Counselor</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Your <span className="grad-text">learning path</span>.</h1>
        <p className="mx-auto mt-2 max-w-[600px] text-[14.5px] text-mut">
          Pick where you want to go and we'll show the ordered skills to get there — with curated resources for every one,
          and only the <span className="font-bold">delta</span> between your current level and the target.
        </p>
      </div>

      {/* what's new in the catalog (manifest diff) */}
      {showNew && diff.isNew && (
        <div className="mx-auto mt-5 max-w-[680px] rounded-2xl border border-acc1/40 bg-acc1/10 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14.5px] font-extrabold text-acc2">🆕 What's new in the catalog (v{diff.version})</h2>
            <button className={btnPrimary + btnSm} onClick={() => { markManifestSeen(); setShowNew(false); }}>Got it</button>
          </div>
          <p className="mt-1 text-[12px] text-mut">Reviewed {diff.lastReviewedAt} · {diff.skillCount} skills · {diff.resourceCount} curated resources</p>
          <ul className="mt-2 space-y-1">
            {diff.changes.map((c, i) => <li key={i} className="text-[12.5px] text-ink">{c}</li>)}
          </ul>
        </div>
      )}

      {/* auto-pick — based on the user's resume skills */}
      {suggestion.reason && (
        <div className="mx-auto mt-5 flex max-w-[680px] flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/15 bg-wht/5 px-5 py-3">
          <p className="min-w-0 flex-1 text-[12.5px] text-mut">
            <span className="font-bold text-acc2">🧭 Suggested track: </span>{suggestion.reason}
          </p>
          <button
            className={btnPrimary + btnSm}
            onClick={() => {
              setFieldId(suggestion.fieldId);
              setTrackId(suggestion.trackId);
              setTarget(suggestion.track.maxBand === "cto" ? "staff" : suggestion.track.maxBand);
              toast(`Using the ${suggestion.track.name} path`);
            }}
          >Use this track</button>
        </div>
      )}

      {/* selectors */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {FIELDS.map(f => (
          <button key={f.id} className={`${btnGhost + btnSm} ${fieldId === f.id ? "ring-2 ring-acc1/50" : ""}`} onClick={() => setFieldId(f.id)}>
            {f.icon} {f.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {field.tracks.map(t => (
          <button
            key={t.id}
            className={`rounded-2xl border p-4 text-left transition-colors ${trackId === t.id ? "border-acc1/60 bg-acc1/10" : "border-line/10 bg-wht/5 hover:border-line/25"}`}
            onClick={() => { setTrackId(t.id); setTarget(t.maxBand === "cto" ? "staff" : t.maxBand); }}
          >
            <div className="text-[14px] font-extrabold">{t.name}</div>
            <div className="mt-1 text-[12px] text-mut">{t.blurb}</div>
            <div className="mt-2 text-[11px] font-bold text-fnt">🎯 {t.targetTitles.join(" · ")}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="text-[12.5px] font-bold text-mut">Target level:</span>
        {bands.map(b => (
          <button key={b} className={`${btnGhost + btnSm} ${target === b ? "ring-2 ring-acc1/50" : ""}`} onClick={() => setTarget(b)}>
            {BAND_LABEL[b]}
          </button>
        ))}
        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-[12.5px] font-bold text-mut">
          <input type="checkbox" checked={gapsOnly} onChange={e => setGapsOnly(e.target.checked)} className="accent-acc1" />
          Show only gaps
        </label>
      </div>

      {/* level-up delta */}
      <section className={`${cardCls} mt-6 p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-extrabold">🚀 Level up: {BAND_LABEL[delta.currentBand]} → {BAND_LABEL[delta.targetBand]}</h2>
          <button
            className={btnGhost + btnSm}
            onClick={exportReport}
            title="Printable skills-to-job report — gaps, plan and resources (Save as PDF)"
          >
            📄 Export PDF
          </button>
        </div>
        <p className="mt-1 text-[13px] text-mut">
          {profile?.years !== undefined
            ? `Based on your profile (${profile.years} yrs), you're at ${BAND_LABEL[delta.currentBand]}. Here's ONLY what changes on the way to ${BAND_LABEL[delta.targetBand]}.`
            : `Your profile level isn't set yet — set it in your resume/profile for an accurate gap.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone="ok">✓ {gap.owned.length} skills owned</Chip>
          <Chip tone="warn">○ {gap.missing.length} to learn</Chip>
          {delta.newSkills.length > 0 && <Chip tone="acc">📈 {delta.newSkills.length} new in the {BAND_LABEL[delta.targetBand]} jump</Chip>}
        </div>
        {delta.changes.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {delta.changes.map((c, i) => (
              <p key={i} className="text-[13px] text-ink">✨ {c}</p>
            ))}
          </div>
        )}
        {plan.length > 0 && (
          <details className="mt-3 rounded-xl border border-line/10 bg-deep/50 p-3">
            <summary className="cursor-pointer text-[13px] font-bold text-acctxt">📋 Copy plan</summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11.5px] text-fnt">{plan.join("\n")}</pre>
          </details>
        )}
      </section>

      {/* 90-day study plan */}
      <section className={`${cardCls} mt-4 p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-extrabold">📅 90-day study plan</h2>
            <p className="mt-0.5 text-[12.5px] text-mut">
              Weekly milestones from your gaps on the {track.name} path — packed to your availability, tracked offline.
            </p>
          </div>
          {study && (
            <div className="flex flex-wrap gap-2">
              <button
                className={btnPrimary + btnSm}
                disabled={roadmapAddCount === 0}
                onClick={() => addToRoadmap(study)}
                title="Add these skills to your Career Roadmap as P0 job-fit topics"
              >
                {roadmapAddCount > 0
                  ? `🗺️ Add ${roadmapAddCount} to Roadmap`
                  : roadmapPreview.dropped.length > 0
                    ? `🗺️ Roadmap full (${JD_KEYWORD_LIMIT})`
                    : "🗺️ On Roadmap ✓"}
              </button>
              <button className={btnGhost + btnSm} onClick={() => nav("planner")} title="Open the interview-date Planner">🗓️ Open Planner</button>
              <button className={btnGhost + btnSm} onClick={() => { clearStudyPlan(); setStudy(null); setProgress({}); }}>Clear</button>
            </div>
          )}
        </div>

        {!study ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-[12.5px] text-mut">Hours/week:</span>
            {[2, 4, 6, 8].map(h => (
              <button key={h} className={`${btnGhost + btnSm} ${perWeek === h ? "ring-2 ring-acc1/50" : ""}`} onClick={() => setPerWeek(h)}>{h}h</button>
            ))}
            <button className={btnPrimary + btnSm} onClick={makePlan}>
              {gap.missing.length === 0 ? "No gaps — plan not needed ✓" : `Generate plan (${gap.missing.length} skills to learn)`}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip tone="ok">✓ {Object.values(progress).filter(Boolean).length}/{study.milestones.length} weeks done</Chip>
              <Chip>{study.totalHours}h total · ~{study.perWeekHours}h/week</Chip>
              <Chip>🎯 {BAND_LABEL[study.targetBand]}</Chip>
            </div>
            <div className="mt-3 space-y-2">
              {study.milestones.map(m => {
                const done = !!progress[m.week];
                return (
                  <label key={m.week} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-2.5 ${done ? "border-ok/25 bg-ok/5" : "border-line/10 bg-wht/5"}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-acc1"
                      checked={done}
                      onChange={() => toggleWeek(study, m.week)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13.5px] font-bold ${done ? "text-mut line-through" : "text-ink"}`}>{m.title}</span>
                      <span className="text-[11.5px] text-fnt">~{m.hours}h · {m.skillIds.map(id => SKILLS[id]?.name ?? id).join(" · ")}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <button className={`${btnGhost} mt-3`} onClick={() => { saveStudyPlan(study); toast("📅 Plan saved — it reopens here anytime"); }}>Save plan</button>
          </>
        )}
      </section>

      {/* skill path grouped by band */}
      {bands.map(band => {
        const rows = gap.missing.filter(s => s.band === band);
        const owned = gap.owned.filter(s => s.band === band);
        const visible = gapsOnly ? rows : [...rows, ...owned];
        if (visible.length === 0) return null;
        return (
          <section key={band} className={`${cardCls} mt-4 p-6`}>
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold">
              {BAND_LABEL[band]} <span className="text-[11px] font-bold uppercase tracking-wider text-fnt">{band}</span>
              {!gapsOnly && owned.length > 0 && <Chip tone="ok">{owned.length} owned</Chip>}
            </h3>
            <div className="space-y-3">
              {visible.map(s => {
                const isOwned = owned.includes(s);
                return (
                  <div key={s.id} className={`rounded-xl border p-4 ${isOwned ? "border-ok/25 bg-ok/5" : "border-line/10 bg-wht/5"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-extrabold">{s.name}</span>
                          <span className="text-[12px] text-fnt">{dots(s.difficulty)}</span>
                          {isOwned ? <Chip tone="ok">✓ owned</Chip> : s.id === gap.next?.id ? <Chip tone="co">⬆ learn next</Chip> : <Chip tone="warn">○ gap</Chip>}
                          {(() => {
                            const sig = signals[s.id];
                            if (!sig) return null;
                            const m = STAGE_META[sig.stage] ?? STAGE_META.nascent;
                            return <Chip tone={sig.stage === "declining" ? "bad" : sig.stage === "growing" || sig.stage === "mainstream" ? "ok" : "default"} title={`market trend ${sig.trend_score.toFixed(0)}/100`}>{m.icon} {m.label}</Chip>;
                          })()}
                        </div>
                        <p className="mt-1 text-[12.5px] text-mut">{s.why}</p>
                        {s.prerequisites && s.prerequisites.length > 0 && (
                          <p className="mt-1 text-[11px] text-fnt">needs: {s.prerequisites.join(", ")}</p>
                        )}
                        <div className="mt-2.5 space-y-1.5">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-fnt">🔍 App suggested</span>
                          {s.resources.map(r => {
                            const q = resourceQuality(r);
                            return (
                              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 rounded-lg border border-line/10 bg-wht/[.03] px-3 py-2 text-[12px] transition-colors hover:border-line/25 hover:bg-wht/[.06]">
                                <span className="min-w-0 flex-1 truncate font-semibold text-acctxt group-hover:underline">{r.title}</span>
                                <span className="flex-none text-[11px] text-fnt">{r.kind}</span>
                                {r.free ? <Chip tone="ok">free</Chip> : <Chip tone="warn">paid</Chip>}
                                <span title={`quality ${q}/100`} className={`flex-none text-[11px] font-bold ${q >= 85 ? "text-ok" : q >= 55 ? "text-fnt" : "text-warn"}`}>{q}</span>
                                {isSaved(r.url) ? (
                                  <span title="Saved" className="flex-none text-[11px] text-ok">✓</span>
                                ) : (
                                  <button
                                    className="flex-none text-acctxt opacity-0 transition-opacity group-hover:opacity-100"
                                    title="Save to my resources"
                                    disabled={saving === r.url}
                                    onClick={e => { e.preventDefault(); e.stopPropagation(); void saveResource(r, s.why); }}
                                  >⭐</button>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="pb-4 pt-6 text-center text-[12px] text-fnt">
        The catalog is curated (docs/skill-counselor.md) — app-suggested links are reviewed, and personal saves pass the same safety guard as the Resources view.
      </div>
    </div>
  );
}
