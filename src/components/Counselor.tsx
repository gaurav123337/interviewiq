/* Skill Counselor — the dedicated learning-path menu (docs/skill-counselor.md).
   Pick a field → a track → a target level, and get:
     - the LEVEL-UP delta (what's new between where you are and the target),
     - the ordered skill path grouped by band, with the app's curated
       resources per skill (🔍 App suggested) and clear ⭐ Saved-by-you marks,
     - a gap-only view and a shareable plan text.
   Saving a resource routes through the SAME guard as the Resources view
   (submit-resource), so personal saves are still vetted. */

import { useEffect, useMemo, useState } from "react";
import { BAND_LABEL, BAND_ORDER, FIELDS, type Band } from "../data/skillCatalog";
import { applyManifestDiff, markManifestSeen, qualityBand, resourceFreshness, resourceQuality } from "../services/catalogMeta";
import { getCareerProfile } from "../services/jobs";
import { myResources, submitResource, type ResourceRow } from "../services/resources";
import { buildPlan, gapAnalysis, levelUpDelta } from "../services/skillCounselor";
import { latestSignals, STAGE_META, type SkillSignal } from "../services/trendSignals";
import { getCloudState, subscribeCloud } from "../services/cloud";
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
  const [signals, setSignals] = useState<Record<string, SkillSignal>>({});
  const diff = useMemo(() => applyManifestDiff(), []);
  const [showNew, setShowNew] = useState(diff.isNew);

  const field = FIELDS.find(f => f.id === fieldId)!;
  const track = field.tracks.find(t => t.id === trackId) ?? field.tracks[0];

  useEffect(() => subscribeCloud(setCloud), []);

  useEffect(() => { void myResources().then(setSaved).catch(() => {}); }, []);
  useEffect(() => { void latestSignals().then(setSignals).catch(() => {}); }, []);

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

  const bands = BANDS.filter(b => BAND_ORDER[b] <= BAND_ORDER[track.maxBand]);

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
        <h2 className="text-[16px] font-extrabold">🚀 Level up: {BAND_LABEL[delta.currentBand]} → {BAND_LABEL[delta.targetBand]}</h2>
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
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-fnt">🔍 App suggested:</span>
                          {s.resources.map(r => {
                            const fres = resourceFreshness(r);
                            const q = resourceQuality(r);
                            return (
                              <span key={r.url} className="inline-flex items-center gap-1 rounded-full border border-line/15 px-2.5 py-1 text-[11.5px]">
                                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-acctxt hover:underline">{r.title}</a>
                                <span className="text-fnt">{r.kind}</span>
                                {r.free ? <span className="text-ok">free</span> : <span className="text-warn">paid</span>}
                                <span className={fres.status === "current" ? "text-fnt" : "text-warn"} title={fres.label}>{fres.status === "current" ? `'${String(r.publishedYear).slice(2)}` : "⚠️"}</span>
                                <span title={`quality score ${q}/100`} className={q >= 85 ? "text-ok" : q >= 55 ? "text-fnt" : "text-warn"}>{q} {qualityBand(q)}</span>
                                {isSaved(r.url) ? (
                                  <span title="Already in your saved resources" className="text-ok">✓</span>
                                ) : (
                                  <button
                                    className="text-acctxt hover:opacity-70 disabled:opacity-40"
                                    title="Save to my resources (guard-checked)"
                                    disabled={saving === r.url}
                                    onClick={e => { e.preventDefault(); void saveResource(r, s.why); }}
                                  >⭐</button>
                                )}
                              </span>
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
