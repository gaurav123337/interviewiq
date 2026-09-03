/* SkillDetail — full-page roadmap view for a single skill.
   Shows prerequisites, ordered learning path, curated resources
   with quality scores, and Pro/Free tier gating. */

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store";import { getRoadmapBySlug,
  resolvePath,
  isAvailable,
  roadmapPrepSel,
  skillRoadmapShareText,
  type SkillRoadmap,
} from "../services/skillRoadmapService";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import { ownedSkillSlugs } from "../services/profileStore";
import { getGoal, saveGoal } from "../services/goal";
import { mergeGapKeywords } from "../services/gapPlan";
import { JD_KEYWORD_LIMIT } from "../services/roadmap/phases";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip } from "./ui";

const BAND_LABELS: Record<string, string> = {
  junior: "Foundation", mid: "Core", senior: "Senior", staff: "Staff", principal: "Principal", cto: "CTO",
};

function dots(d: number): string {
  return "●".repeat(d) + "○".repeat(3 - d);
}

function qualityBadge(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "⭐ Excellent", color: "text-ok" };
  if (score >= 75) return { label: "✅ Good", color: "text-ok" };
  if (score >= 55) return { label: "⚠️ Fair", color: "text-fnt" };
  return { label: "🔴 Review", color: "text-warn" };
}

export function SkillDetail() {
  const { nav, state, startWeakSession } = useApp();
  const slug = localStorage.getItem("iq.learnSlug") ?? "";
  const [roadmap, setRoadmap] = useState<SkillRoadmap | null>(null);
  const [loading, setLoading] = useState(true);
  /* Owned skills come from the ONE canonical graph (Item 11). Its keys are
     catalog slugs, which is exactly what resolvePath() compares roadmap
     prerequisites against. (Previously this read localStorage["iq.skills"] and
     tested Array.isArray on a SkillProfile object, so it was always empty.) */
  const [knownSkills] = useState<string[]>(() => ownedSkillSlugs());
  const [showAllResources, setShowAllResources] = useState(false);

  useEffect(() => {
    if (!slug) return;
    void getRoadmapBySlug(slug).then(r => { setRoadmap(r); setLoading(false); });
  }, [slug]);

  const resolved = useMemo(() => {
    if (!roadmap) return null;
    return resolvePath(roadmap, knownSkills);
  }, [roadmap, knownSkills]);

  const userTier = isPaywallEnabled() ? (getTier() === "pro" ? "pro" as const : "free" as const) : "pro" as const;

  if (loading) {
    return (
      <div className="anim-view mx-auto max-w-[860px] pt-16 text-center text-mut">
        <span className="spinner inline-block" /> Loading roadmap…
      </div>
    );
  }

  if (!roadmap || !resolved) {
    return (
      <div className="anim-view mx-auto max-w-[860px] pt-16 text-center">
        <div className="mb-3 text-[42px]">🔍</div>
        <p className="text-[14px] text-mut">Skill roadmap not found</p>
        <button className={btnPrimary + btnSm + " mt-4"} onClick={() => nav("learn")}>← Back to Skills</button>
      </div>
    );
  }

  const locked = !isAvailable(roadmap, userTier);
  const visibleResources = showAllResources ? roadmap.resources : roadmap.resources.slice(0, 3);
  const hiddenResources = roadmap.resources.length - visibleResources.length;

  /* Add to Roadmap — single-skill version of GapPlanModal.addToRoadmap. Files the
     skill under goal.jdKeywords, which buildPhases renders as a P0 "Job description
     fit" topic. Never touches the skill graph (the Item 12 invariant), so the skill
     stays a gap in the Counselor until genuinely earned. */
  const addToRoadmap = () => {
    const g = getGoal();
    if (!g) {
      toast("Set up your Roadmap goal first, then add this skill to it.");
      nav("roadmap");
      return;
    }
    const { next, added, dropped } = mergeGapKeywords(g.jdKeywords ?? [], [roadmap.name]);
    if (added.length) {
      saveGoal({ ...g, jdKeywords: next });
      toast(`🗺️ Added ${roadmap.name} to your Roadmap — now P0 in “Job description fit”`);
    } else if (dropped.length) {
      toast(`Your Roadmap already lists ${JD_KEYWORD_LIMIT} job-fit skills — remove some in Roadmap to add ${roadmap.name}`);
    } else {
      toast(`✓ ${roadmap.name} is already on your Roadmap`);
    }
  };

  /* Start Practice — the shared weak-topic seam. roadmapPrepSel resolves the
     field/level/keywords (see its docs); startWeakSession dispatches SET_SESSION,
     which navigates to the interview view. A `step` focuses the session on one
     learning-path step while staying anchored on the skill. */
  const startPractice = (step?: string) => {
    const { fieldId, levelId, keywords } = roadmapPrepSel(roadmap, getGoal(), state.ob, step);
    startWeakSession(fieldId, levelId, keywords, {
      count: 6, mode: "standard", timing: "relaxed", voice: state.config.voice
    });
  };

  /* Share — the repo's navigator.share → clipboard idiom (Results/ShareView).
     There's no per-skill route, so we share a text summary. A dismissed share
     sheet rejects the promise; the catch makes that a no-op. */
  const shareRoadmap = async () => {
    const text = skillRoadmapShareText(roadmap);
    try {
      if (navigator.share) {
        await navigator.share({ title: `${roadmap.name} — learning roadmap`, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast("📋 Roadmap copied to clipboard");
      }
    } catch {
      /* user dismissed the share sheet — no-op */
    }
  };

  return (
    <div className="anim-view mx-auto max-w-[860px]">
      {/* Back link */}
      <div className="pt-4">
        <button className={btnGhost + btnSm} onClick={() => nav("learn")}>← Back to Skills</button>
      </div>

      {/* Header card */}
      <div className={`${cardCls} mt-4 overflow-hidden`}>
        <div className="flex flex-wrap items-start gap-4 p-6">
          <div className="grid h-16 w-16 flex-none place-items-center rounded-2xl bg-acc1/10 text-[30px]">{roadmap.icon}</div>
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-extrabold tracking-tight">{roadmap.name}</h1>
              <span className="text-[14px] text-fnt">{dots(roadmap.difficulty)}</span>
              {locked && <Chip tone="warn">🔒 Pro</Chip>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Chip>{BAND_LABELS[roadmap.band]}</Chip>
              <Chip>~{roadmap.estimatedHours}h estimated</Chip>
              <Chip>{resolved.weeksEstimate} weeks @ 10h/week</Chip>
              {roadmap.tags.map(t => <Chip key={t} tone="default">{t}</Chip>)}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink">{roadmap.why}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line/10 bg-wht/[.03] px-6 py-3">
          <button className={btnPrimary + btnSm} onClick={addToRoadmap}>🗺️ Add to Roadmap</button>
          <button className={btnGhost + btnSm} onClick={() => startPractice()}>▶ Start Practice</button>
          <button className={btnGhost + btnSm} onClick={shareRoadmap}>📤 Share</button>
        </div>
      </div>

      {/* Prerequisites */}
      {roadmap.prerequisites.length > 0 && (
        <div className={`${cardCls} mt-4 p-6`}>
          <h2 className="mb-3 text-[16px] font-extrabold">📋 Prerequisites</h2>
          <p className="mb-3 text-[13px] text-mut">Skills you need before starting this path:</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {resolved.prerequisitesResolved.map(p => (
              <div
                key={p.skillId}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  p.known ? "border-ok/25 bg-ok/5" : "border-warn/25 bg-warn/5"
                }`}
              >
                <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-wht/10 text-[14px]">
                  {p.known ? "✅" : "○"}
                </span>
                <div>
                  <span className={`text-[13.5px] font-bold ${p.known ? "text-mut line-through" : "text-ink"}`}>
                    {p.skillId}
                  </span>
                  <span className="ml-2 text-[11px] text-fnt">
                    {p.known ? "You know this" : "Learn first"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Path */}
      {roadmap.learningPath.length > 0 && (
        <div className={`${cardCls} mt-4 p-6`}>
          <h2 className="mb-3 text-[16px] font-extrabold">🗺️ Learning Path</h2>
          <p className="mb-4 text-[13px] text-mut">Ordered steps — follow them in sequence for the best results.</p>
          <div className="space-y-3">
            {roadmap.learningPath.map((step, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-line/10 bg-wht/5 px-4 py-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-acc1/10 text-[14px] font-extrabold text-acctxt">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[13.5px] font-bold">{step}</span>
                </div>
                <button className={btnPrimary + btnSm} onClick={() => startPractice(step)}>Start →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Curated Resources */}
      <div className={`${cardCls} mt-4 p-6`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-extrabold">📚 Curated Resources</h2>
          <span className="text-[12px] text-fnt">{roadmap.resources.length} resources</span>
        </div>

        {roadmap.resources.length === 0 ? (
          <p className="text-[13px] text-mut">No resources yet. Check back soon!</p>
        ) : (
          <>
            <div className="space-y-2">
              {visibleResources.map((r, i) => {
                const badge = qualityBadge(r.qualityScore);
                return (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-line/10 bg-wht/[.03] px-4 py-3 transition-colors hover:border-line/25 hover:bg-wht/[.06]"
                  >
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-acc1/10 text-[16px]">
                      {r.kind === "book" ? "📖" : r.kind === "course" ? "🎓" : r.kind === "video" ? "🎬" : "📄"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-acctxt group-hover:underline">{r.title}</span>
                      <span className="text-[11px] text-fnt">{r.kind} · {r.publishedYear}</span>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      {r.free ? <Chip tone="ok">free</Chip> : <Chip tone="warn">paid</Chip>}
                      <span title={`quality ${r.qualityScore}/100`} className={`text-[11px] font-bold ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>

            {hiddenResources > 0 && !showAllResources && (
              <div className="mt-3">
                {locked ? (
                  <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-center">
                    <p className="text-[13px] text-warn">🔒 {hiddenResources} more resources — Upgrade to Pro</p>
                    <button className={btnPrimary + btnSm + " mt-2"} onClick={() => nav("settings")}>Upgrade to Pro</button>
                  </div>
                ) : (
                  <button className={btnGhost + " w-full mt-2"} onClick={() => setShowAllResources(true)}>
                    Show {hiddenResources} more resources →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Also appears in */}
      <div className={`${cardCls} mt-4 p-6`}>
        <h2 className="mb-2 text-[16px] font-extrabold">🔗 Related Tracks</h2>
        <p className="text-[13px] text-mut">This skill also appears in career tracks on the Skill Counselor page.</p>
        <button className={btnGhost + btnSm + " mt-3"} onClick={() => nav("counselor")}>Open Skill Counselor →</button>
      </div>

      {/* Footer */}
      <div className="pb-8 pt-4 text-center text-[12px] text-fnt">
        Resources quality-checked by our team · Updated regularly
      </div>
    </div>
  );
}
