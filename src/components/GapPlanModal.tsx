import { useEffect, useState } from "react";
import type { JobPosting, LevelId } from "../types";
import { getGoal, saveGoal } from "../services/goal";
import { buildGapPlan, getGapPlan, mergeGapKeywords, saveGapPlan, type GapPlan } from "../services/gapPlan";
import { deckForSkills, type DrillCard } from "../services/drill";
import { JD_KEYWORD_LIMIT } from "../services/roadmap/phases";
import { canonicalize } from "../data/skillVocab";
import { useApp } from "../store";
import { toast } from "../toast";
import { btnPrimary, btnSoft, Chip, Modal } from "./ui";

export function GapPlanModal({ job, missing, detected, onClose }: {
  job: JobPosting;
  missing: string[];
  /** What the JD scan detected, when the plan came from a scan — lets a practice
      session target the posting's field/level. Absent from a feed match (falls
      back to the goal / onboarding). */
  detected?: { fieldId: string; levelId: LevelId };
  onClose: () => void;
}) {
  const { state, nav, startWeakSession } = useApp();
  const [plan, setPlan] = useState<GapPlan | null>(() => getGapPlan(job.id));
  /* The goal's current "Job description fit" keywords — the modal's reactive
     mirror of goal.jdKeywords. Drives the per-item "On Roadmap ✓" markers and
     the primary button, and updates in place after a write-back. */
  const [jdKeywords, setJdKeywords] = useState<string[]>(() => getGoal()?.jdKeywords ?? []);
  /* Ephemeral quick-drill deck (Item 12 PR3) — flip-cards built from the gap
     skills, never persisted. Lives and dies with the modal. */
  const [drill, setDrill] = useState<DrillCard[] | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!plan) {
      const perWeek = getGoal()?.hoursPerWeek ?? 4;
      const built = buildGapPlan(job, missing, perWeek);
      saveGapPlan(built);
      setPlan(built);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  if (!plan) return null;

  /* Slug set for the per-item marker, plus a preview of exactly what the primary
     button would write. mergeGapKeywords is pure, so running it at render makes
     the button's count/label/enabled-state mirror the click precisely — it folds
     slug-aliased labels into one add and respects the JD_KEYWORD_LIMIT cap, so
     the button never over-promises and never dead-ends once the roadmap is full. */
  const jdSlugs = new Set(jdKeywords.map(k => canonicalize(k).slug));
  const onRoadmap = (skill: string) => jdSlugs.has(canonicalize(skill).slug);
  const preview = mergeGapKeywords(jdKeywords, plan.items.map(it => it.skill));
  const addCount = preview.added.length;
  const roadmapFull = addCount === 0 && preview.dropped.length > 0;

  /* Roadmap write-back — appends the canonical labels to goal.jdKeywords, which
     buildPhases renders as a "Job description fit" phase and prioritize forces to
     P0. It deliberately never touches the skill graph, so the skills stay gaps in
     the Skill Counselor until genuinely earned (the Item 12 invariant). */
  const addToRoadmap = () => {
    const g = getGoal();
    if (!g) {
      toast("Set up your Roadmap goal first, then add these skills to it.");
      onClose();
      nav("roadmap");
      return;
    }
    const { next, added, dropped } = mergeGapKeywords(g.jdKeywords ?? [], plan.items.map(it => it.skill));
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

  /* Targeted practice — the same weak-topic seam the Roadmap uses. Field/level
     fall back detected → goal → onboarding → sensible defaults. startWeakSession
     dispatches SET_SESSION, which navigates to the interview view, so we just
     close the (now-orphaned) modal after. */
  const startPractice = () => {
    const g = getGoal();
    const fieldId = detected?.fieldId ?? g?.fieldId ?? state.ob.field ?? "frontend";
    const levelId = detected?.levelId ?? g?.targetLevel ?? state.ob.level ?? "mid";
    startWeakSession(fieldId, levelId, plan.items.map(it => it.skill), {
      count: 6, mode: "standard", timing: "relaxed", voice: state.config.voice
    });
    onClose();
  };

  /* Inline quick-drill — turns the gap skills into flip-cards from the question
     bank (deckForSkills). Ephemeral: no store write, no navigation; the deck is
     discarded when the panel or modal closes. deckForSkills skips labels with no
     searchable token and returns [] if nothing matches (never a random deck). */
  const startDrill = () => {
    const fieldId = detected?.fieldId ?? getGoal()?.fieldId ?? state.ob.field ?? "frontend";
    const cards = deckForSkills(plan.items.map(it => it.skill), fieldId);
    if (!cards.length) { toast("No drill cards for these skills yet — try the practice session instead."); return; }
    setDrill(cards);
    setFlipped({});
  };

  return (
    <Modal onClose={onClose} title="📈 Close the gap" desc={`A study plan for ${job.title} at ${job.company} — built from the ${plan.items.length} skills this role needs that your profile doesn't list yet.`}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip tone="co">🕒 {plan.weeks} week{plan.weeks === 1 ? "" : "s"} at {plan.perWeekHours}h/week</Chip>
        <Chip tone="lvl">∑ {plan.totalHours} study hours</Chip>
        <Chip tone="ok">{plan.items.length} skills</Chip>
      </div>

      <div className="space-y-3">
        {plan.items.map(it => (
          <div key={it.skill} className="rounded-xl border border-line/15 bg-deep/30 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13.5px] font-extrabold">#{it.priority} {it.skill}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {onRoadmap(it.skill) && (
                  <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[10.5px] font-bold text-ok" title="Added to your Roadmap as a P0 job-fit topic">
                    On Roadmap ✓
                  </span>
                )}
                <span className="rounded-full bg-acc1/10 px-2 py-0.5 text-[11px] font-bold text-acctxt">~{it.estHours}h</span>
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fnt">{it.primer}</p>
            {it.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {it.links.map(l => (
                  <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                    className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-1 text-[11px] font-bold text-acctxt hover:bg-acc1/15">
                    {l.label} ↗
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11.5px] text-mut">
        Tackle <b>#{plan.items[0]?.skill}</b> first — it's listed first in the role's requirements. Adding these to your
        Roadmap files them as <b>P0</b> "Job description fit" topics, and a practice session or quick-drill starts right away.
      </p>

      {drill && (
        <div className="mt-4 rounded-xl border border-ok/25 bg-ok/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-extrabold text-ok">⚡ Quick-drill — {drill.length} card{drill.length === 1 ? "" : "s"}</p>
            <button className="text-[11.5px] font-bold text-mut hover:text-ink" onClick={() => setDrill(null)}>✕ Close</button>
          </div>
          <p className="mt-0.5 text-[11.5px] text-fnt">Flashcards pulled from the question bank for these skills — tap to reveal. Nothing is saved; this deck is just a quick warm-up.</p>
          <div className="mt-3 space-y-2">
            {drill.map(c => {
              const show = flipped[c.q];
              return (
                <div key={c.q} className="rounded-xl border border-line/15 bg-deep/30 p-3">
                  <button className="w-full text-left" onClick={() => setFlipped(f => ({ ...f, [c.q]: !f[c.q] }))}>
                    <span className="text-[12.5px] font-bold text-ink">{c.q}</span>
                    {show && (
                      <span className="mt-1.5 block whitespace-pre-wrap text-[12px] leading-relaxed text-fnt">
                        <span className="font-bold text-ok">Answer:</span> {c.a}
                        {c.kp?.length ? <span className="mt-1 block text-[11px] text-mut">Key points: {c.kp.join(" · ")}</span> : null}
                      </span>
                    )}
                  </button>
                  <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-mut">{show ? "Tap question to hide" : "Tap to reveal the answer"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <button className={`${btnPrimary} w-full`} onClick={addToRoadmap} disabled={addCount === 0}>
          {addCount > 0
            ? `🗺️ Add ${addCount} skill${addCount === 1 ? "" : "s"} to my Roadmap`
            : roadmapFull
              ? `🗺️ Roadmap is full (${JD_KEYWORD_LIMIT}) — trim it to add more`
              : `✓ All ${plan.items.length} skill${plan.items.length === 1 ? "" : "s"} on your Roadmap`}
        </button>
        <div className="flex gap-2">
          <button className={`${btnSoft} flex-1 leading-tight`} onClick={startPractice}>🎤 Practice</button>
          <button className={`${btnSoft} flex-1 leading-tight`} onClick={startDrill}>⚡ Quick-drill</button>
        </div>
        <button className="w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
          Done — close
        </button>
      </div>
    </Modal>
  );
}
