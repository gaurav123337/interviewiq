import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CareerGoal, LevelId, SkillRating } from "../types";
import { COMPANIES, FIELDS, GENERAL_COMPANY, LEVELS, LEVEL_INDEX, companyById, fieldById, levelById } from "../data";
import { aiAvailable } from "../ai";
import { explainTopic } from "../services/tutor";
import { clearGoal, getGoal, getProfile, markDiagnosticSkipped, saveGoal, saveProfile } from "../services/goal";
import { buildRoadmap, type RoadmapTopic } from "../services/roadmap";
import { useApp } from "../store";
import { toast } from "../toast";
import { btn, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal, Seg } from "./ui";

const fmt = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return fmt(d);
};

const HOURS_OPTIONS = [2, 5, 10, 15, 20];

/** Clamps the target strictly above the current level (a 0-gap roadmap is pointless). */
function ensureTarget(g: CareerGoal): CareerGoal {
  const tgt = LEVEL_INDEX[g.targetLevel];
  const cur = LEVEL_INDEX[g.currentLevel];
  if (tgt > cur) return g;
  const next = LEVELS[cur + 1];
  return next ? { ...g, targetLevel: next.id } : g;
}

function defaultGoal(): CareerGoal {
  const ob = { level: null, field: null, company: null };
  try {
    const raw = localStorage.getItem("iq.onboard");
    if (raw) Object.assign(ob, JSON.parse(raw));
  } catch { /* ignore */ }
  return ensureTarget({
    currentLevel: (ob.level as LevelId | null) ?? "mid",
    targetLevel: "senior",
    fieldId: ob.field ?? FIELDS[0].id,
    companyId: ob.company ?? "general",
    targetDate: addDays(56),
    hoursPerWeek: 5,
    createdAt: Date.now()
  });
}

const SELF_OPTS = [
  { value: "1", label: "Novice" },
  { value: "3", label: "Comfortable" },
  { value: "5", label: "Strong" }
];

function buildSkillList(g: CareerGoal, existing: SkillRating[] = []): SkillRating[] {
  const field = fieldById(g.fieldId);
  const company = companyById(g.companyId);
  const labels: string[] = [];
  for (const s of field?.skills ?? []) if (!labels.includes(s)) labels.push(s);
  for (const f of levelById(g.currentLevel).focus.split(",")) {
    const t = f.trim();
    if (t && !labels.includes(t)) labels.push(t);
  }
  if (company.id !== GENERAL_COMPANY.id) {
    for (const s of company.stack) if (!labels.includes(s)) labels.push(s);
  }
  const prev = new Map(existing.map(s => [s.skill, s.self]));
  return labels.map(skill => ({ skill, self: prev.get(skill) ?? 2 }));
}

export function Roadmap() {
  const { state, startDiagnostic, startPlannedSession, practice } = useApp();
  const [goal, setGoal] = useState<CareerGoal | null>(() => getGoal());
  const [profile, setProfile] = useState(() => getProfile());
  const [step, setStep] = useState<"goal" | "skills" | "assess" | "done">(() => (getGoal() ? "done" : "goal"));
  const [draft, setDraft] = useState<CareerGoal>(() => getGoal() ?? defaultGoal());
  const [skills, setSkills] = useState<SkillRating[]>(() => getProfile()?.skills ?? []);
  const [learn, setLearn] = useState<RoadmapTopic | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const roadmap = useMemo(
    () => (goal && profile ? buildRoadmap(goal, profile, state.sessions) : null),
    [goal, profile, state.sessions]
  );

  const saveDraft = () => {
    saveGoal(draft);
    const p = { goal: draft, skills };
    saveProfile(p);
    setGoal(draft);
    setProfile(p);
    return p;
  };

  const onLearn = (t: RoadmapTopic) => { setLearn(t); setAi(null); setAiLoading(false); };

  const onExplain = async () => {
    if (!learn || !goal) return;
    setAiLoading(true);
    try { setAi(await explainTopic(learn.label, goal)); }
    catch (e) { toast("✗ " + ((e as Error).message || "AI unavailable — add an API key in Settings")); setAi(null); }
    finally { setAiLoading(false); }
  };

  const practiceTopic = (t: RoadmapTopic) => {
    if (!goal) return;
    if (t.practice) {
      practice(goal.fieldId, { ...t.practice, lvl: goal.targetLevel });
    } else {
      startPlannedSession(
        { level: goal.targetLevel, field: goal.fieldId, company: goal.companyId },
        { count: 6, mode: "standard", timing: "relaxed", voice: state.config.voice },
        [t.label]
      );
    }
  };

  const editGoal = () => {
    setDraft(goal ?? defaultGoal());
    setSkills(profile?.skills ?? []);
    setStep("goal");
  };

  const clearAll = () => {
    clearGoal();
    setGoal(null); setProfile(null);
    setDraft(defaultGoal()); setSkills([]);
    setStep("goal");
    toast("🧭 Goal cleared");
  };

  /* ---------------- no goal → wizard ---------------- */
  if (!goal) {
    return (
      <div className="anim-view mx-auto max-w-[860px]">
        <WizardHeader />
        {step === "goal" && (
          <div className={`${cardCls} mt-6 p-6`}>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="You are now">
                <select value={draft.currentLevel} onChange={e => setDraft(ensureTarget({ ...draft, currentLevel: e.target.value as LevelId }))} className="select-cls">
                  {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                </select>
              </Field>
              <Field label="Target role">
                <select value={draft.targetLevel} onChange={e => setDraft({ ...draft, targetLevel: e.target.value as LevelId })} className="select-cls">
                  {LEVELS.filter(l => LEVEL_INDEX[l.id] > LEVEL_INDEX[draft.currentLevel]).map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                </select>
              </Field>
              <Field label="Field">
                <select value={draft.fieldId} onChange={e => { setDraft({ ...draft, fieldId: e.target.value }); setSkills([]); }} className="select-cls">
                  {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
                </select>
              </Field>
              <Field label="Company (optional)">
                <select value={draft.companyId} onChange={e => setDraft({ ...draft, companyId: e.target.value })} className="select-cls">
                  <option value="general">{GENERAL_COMPANY.icon} {GENERAL_COMPANY.name}</option>
                  {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </Field>
              <Field label="Target date">
                <input type="date" value={draft.targetDate} min={addDays(7)} onChange={e => setDraft({ ...draft, targetDate: e.target.value })} className="select-cls" />
              </Field>
              <Field label={`Study time — ${draft.hoursPerWeek} h/week`}>
                <Seg
                  options={HOURS_OPTIONS.map(h => ({ value: String(h), label: `${h}h` }))}
                  value={String(draft.hoursPerWeek)}
                  onChange={v => setDraft({ ...draft, hoursPerWeek: Number(v) })}
                />
              </Field>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="max-w-[380px] text-[12.5px] leading-snug text-mut">
                {LEVEL_INDEX[draft.targetLevel] - LEVEL_INDEX[draft.currentLevel]} level gap · from {levelById(draft.currentLevel).name} to {levelById(draft.targetLevel).name}
              </p>
              <button className={btnPrimary + btnSm} onClick={() => { setSkills(buildSkillList(draft)); setStep("skills"); }}>Next: your skills →</button>
            </div>
          </div>
        )}

        {step === "skills" && (
          <div className={`${cardCls} mt-6 p-6`}>
            <h3 className="text-[16px] font-extrabold">🛠️ How strong are you here?</h3>
            <p className="mb-4 text-[13px] text-mut">Rough is fine — the optional diagnostic will measure precisely. Unknown skills default to novice.</p>
            <div className="space-y-3">
              {skills.map(s => (
                <div key={s.skill} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#080c18]/50 px-4 py-3">
                  <span className="min-w-[200px] flex-1 text-[14px] font-bold">{s.skill}</span>
                  <Seg
                    options={SELF_OPTS}
                    value={String(s.self === 1 || s.self === 3 || s.self === 5 ? s.self : s.self < 3 ? 1 : s.self >= 5 ? 5 : 3)}
                    onChange={v => setSkills(skills.map(x => (x.skill === s.skill ? { ...x, self: Number(v) } : x)))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button className={btnGhost + btnSm} onClick={() => setStep("goal")}>← Back</button>
              <button className={btnPrimary + btnSm} onClick={() => { saveDraft(); setStep("assess"); }}>Next: check the gap →</button>
            </div>
          </div>
        )}

        {step === "assess" && (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className={`${cardCls} flex flex-col p-6`}>
              <div className="mb-2 text-[34px]">📝</div>
              <h3 className="mb-1 text-[16px] font-extrabold">Take the 10-minute diagnostic</h3>
              <p className="mb-4 flex-1 text-[13px] leading-relaxed text-mut">
                ~{Math.min(10, 2 * (LEVEL_INDEX[draft.targetLevel] + 1) + (draft.targetLevel === "ceo" ? 3 : draft.targetLevel === "cto" ? 2 : 1))} questions ramping from junior to {levelById(draft.targetLevel).name}. Measures your real level and per-skill gaps — the roadmap then targets exactly what you're missing.
              </p>
              <button className={btnOk} onClick={() => { saveDraft(); startDiagnostic(draft.fieldId, draft.targetLevel); }}>📝 Take the diagnostic</button>
            </div>
            <div className={`${cardCls} flex flex-col p-6`}>
              <div className="mb-2 text-[34px]">⏭️</div>
              <h3 className="mb-1 text-[16px] font-extrabold">Skip — start with my self-assessment</h3>
              <p className="mb-4 flex-1 text-[13px] leading-relaxed text-mut">
                We'll build your roadmap from the skills you rated. You can take the diagnostic anytime from the roadmap header to sharpen the plan.
              </p>
              <button className={btnGhost} onClick={() => { const p = saveDraft(); markDiagnosticSkipped(p); setProfile(p); setStep("done"); }}>Skip & build my roadmap</button>
            </div>
          </div>
        )}

      </div>
    );
  }

  /* ---------------- goal exists → dashboard ---------------- */
  return (
    <div className="anim-view mx-auto max-w-[860px]">
      <Dashboard
        goal={goal} profile={profile} roadmap={roadmap}
        onEdit={editGoal} onClear={clearAll} onRetake={() => startDiagnostic(goal.fieldId, goal.targetLevel)}
        onLearn={onLearn} onPractice={practiceTopic}
      />
      <LearnModal
        topic={learn} goal={goal} ai={ai} aiLoading={aiLoading}
        onClose={() => setLearn(null)} onExplain={onExplain}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function Dashboard({ goal, profile, roadmap, onEdit, onClear, onRetake, onLearn, onPractice }: {
  goal: CareerGoal;
  profile: ReturnType<typeof getProfile>;
  roadmap: ReturnType<typeof buildRoadmap> | null;
  onEdit: () => void;
  onClear: () => void;
  onRetake: () => void;
  onLearn: (t: RoadmapTopic) => void;
  onPractice: (t: RoadmapTopic) => void;
}) {
  const field = fieldById(goal.fieldId);
  const company = companyById(goal.companyId);
  const target = levelById(goal.targetLevel);
  const current = levelById(goal.currentLevel);

  const allTopics = roadmap?.weeks.flatMap(w => w.topics) ?? [];
  const mastered = allTopics.filter(t => t.progress === "mastered").length;
  const p0 = allTopics.filter(t => t.priority === "P0").length;
  const currentWeek = roadmap?.weeks.find(w => w.status === "current")?.week ?? 1;

  return (
    <>
      <WizardHeader />
      <div className={`${cardCls} mt-6 overflow-hidden`}>
        <div className="flex flex-wrap items-center gap-4 p-6">
          <div className="grid h-14 w-14 flex-none place-items-center rounded-2xl grad-bg text-[26px]">🧭</div>
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[19px] font-extrabold tracking-tight">{current.icon} {current.name} → {target.icon} {target.name}</span>
              {profile?.diagnostic
                ? <Chip tone="warn">📏 Measured: at {levelById(profile.diagnostic.level).name}</Chip>
                : <Chip>🙋 Self-assessed</Chip>}
            </div>
            <div className="mt-0.5 text-[13px] text-mut">
              {field?.icon} {field?.name} · {company.icon} {company.name} · {goal.targetDate} · {goal.hoursPerWeek}h/week
            </div>
            {roadmap && <div className="mt-1 text-[12.5px] font-semibold text-acc3">{roadmap.summary}</div>}
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <button className={btnGhost + btnSm} onClick={onRetake}>📝 Retake diagnostic</button>
            <button className={btnGhost + btnSm} onClick={onEdit}>✏️ Edit goal</button>
            <button className={`${btn} border border-white/10 px-3 py-1.5 text-[12.5px] text-fnt hover:bg-white/10`} onClick={onClear}>Clear</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-white/[.03] px-6 py-4 sm:grid-cols-4">
          <Stat label="Weeks" value={roadmap?.weeks.length ?? "—"} />
          <Stat label="Current week" value={roadmap ? `Week ${currentWeek}` : "—"} />
          <Stat label="P0 (must learn)" value={p0 || "—"} />
          <Stat label="Mastered" value={mastered || "—"} />
        </div>
      </div>

      {!roadmap && (
        <div className={`${cardCls} mt-6 flex flex-col items-center px-5 py-14 text-center`}>
          <div className="mb-3 text-[42px]">🗓️</div>
          <h3 className="mb-1 text-lg font-bold">Building your roadmap…</h3>
          <p className="text-sm text-mut">Edit the goal above to regenerate it.</p>
        </div>
      )}

      {roadmap && (
        <div className="mt-6 space-y-4">
          {roadmap.weeks.map(w => (
            <div key={w.week} className={`${cardCls} px-5 py-4 ${w.status === "passed" ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl text-[15px] font-extrabold ${w.status === "current" ? "grad-bg text-white" : "border border-white/15 bg-white/5 text-mut"}`}>
                  {w.week}
                </span>
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-extrabold">{w.phaseLabel}</span>
                    <Chip tone="lvl">{weekChip(w.status)}</Chip>
                    <Chip>~{w.totalHours}h</Chip>
                  </div>
                  <div className="text-[12.5px] text-mut">{w.start} → {w.end}</div>
                </div>
              </div>
              <div className="mt-3 text-[12.5px] leading-snug text-fnt">{w.goal}</div>
              <div className="mt-3 space-y-1.5">
                {w.topics.map(t => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#080c18]/50 px-3.5 py-2.5">
                    <Chip tone={t.priority === "P0" ? "bad" : t.priority === "P1" ? "warn" : "default"}>{t.priority}</Chip>
                    <Chip tone={t.progress === "mastered" ? "ok" : t.progress === "learning" ? "warn" : "default"}>
                      {t.progress === "mastered" ? "✓" : t.progress === "learning" ? "~" : "·"} {t.progress}
                    </Chip>
                    <span className="min-w-[160px] flex-1 text-[13.5px] font-bold leading-snug">{t.label}</span>
                    <span className="text-[12px] font-semibold text-fnt">~{t.estHours}h</span>
                    <button className={btnGhost + btnSm} onClick={() => onLearn(t)}>📖 Learn</button>
                    <button className={btnPrimary + btnSm} onClick={() => onPractice(t)}>▶ Practice</button>
                  </div>
                ))}
              </div>
              {w.topics.some(t => t.statusNote) && (
                <div className="mt-2 space-y-0.5">
                  {w.topics.filter(t => t.statusNote).map(t => (
                    <div key={t.id} className="text-[11.5px] text-acc3">💡 {t.label.slice(0, 60)}{t.label.length > 60 ? "…" : ""} — {t.statusNote}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className={`${cardCls} px-5 py-3 text-center text-[12.5px] text-mut`}>
            The roadmap adapts: take the diagnostic or finish sessions anytime, then revisit to see priorities shift.
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Learn modal                                                         */
/* ------------------------------------------------------------------ */

function LearnModal({ topic, goal, ai, aiLoading, onClose, onExplain }: {
  topic: RoadmapTopic | null;
  goal: CareerGoal;
  ai: string | null;
  aiLoading: boolean;
  onClose: () => void;
  onExplain: () => void;
}) {
  if (!topic) return null;
  return (
    <Modal onClose={onClose} title={`📖 ${topic.label}`} desc={topic.practice ? `Practice topic · ${topic.priority} priority` : `Learning topic · ${topic.priority} priority`}>
      <p className="mb-4 whitespace-pre-wrap text-[14px] leading-relaxed text-[#d7ddf0]">{topic.info.primer}</p>

      {topic.practice && (
        <div className="mb-4 rounded-xl border border-acc1/25 bg-acc1/10 p-4">
          <div className="mb-1 text-[12.5px] font-bold uppercase tracking-wider text-acc3">Practice question</div>
          <p className="mb-2 text-[13.5px] font-bold leading-snug">{topic.practice.q}</p>
          <div className="mb-1 text-[11.5px] font-bold uppercase tracking-wider text-mut">Model answer</div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#d7ddf0]">{topic.practice.a}</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {topic.info.links.map(l => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-lg border border-acc1/40 bg-acc1/15 px-3 py-1.5 text-[12.5px] font-bold text-[#c7caff] hover:bg-acc1/30">
            ↗ {l.label}
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#080c18]/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-bold uppercase tracking-wider text-mut">✨ AI tutor</span>
          {aiAvailable() && <button className={btnGhost + btnSm} onClick={onExplain} disabled={aiLoading}>Explain it to me</button>}
        </div>
        {aiLoading && <p className="text-[13.5px] text-[#d9dcf5]"><span className="spinner" />Explaining…</p>}
        {ai && <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#d9dcf5]">{ai}</p>}
        {!aiLoading && !ai && aiAvailable() && <p className="text-[12.5px] text-fnt">Get a plain-language explanation tuned to {levelById(goal.targetLevel).name} level.</p>}
        {!aiAvailable() && <p className="text-[12.5px] text-fnt">Add an AI key in Settings for a generative explanation — the primer above works fully offline.</p>}
      </div>

      <div className="mt-5 flex justify-end">
        <button className={btnGhost} onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* bits                                                                */
/* ------------------------------------------------------------------ */

function WizardHeader() {
  return (
    <div className="pt-2 text-center">
      <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🧭 Career Roadmap</span>
      <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Your target role, <span className="grad-text">broken down</span>.</h1>
      <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">
        Tell us where you're going and by when — we build a week-by-week roadmap: priority-ranked topics, resources, and an AI tutor for every one of them.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-bold text-mut">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-[20px] font-extrabold leading-tight">{value}</div>
      <div className="text-[11.5px] font-semibold text-mut">{label}</div>
    </div>
  );
}

function weekChip(s: string): string {
  switch (s) {
    case "current": return "🔥 This week";
    case "passed": return "📅 Passed";
    default: return "⏭ Upcoming";
  }
}
