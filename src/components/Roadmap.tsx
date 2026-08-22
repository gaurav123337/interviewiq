import {useMemo, useState} from "react";
import type { CareerGoal, LevelId, SkillRating } from "../types";
import { COMPANIES, FIELDS, GENERAL_COMPANY, LEVELS, LEVEL_INDEX, companyById, fieldById, levelById } from "../data";

import { explainTopic, tutorChat, type TutorMsg } from "../services/tutor";
import { isSystemDesignTopic, explainSystemDesign, systemDesignChat } from "../services/systemDesignTutor";

import { analyzeJd } from "../services/jd";
import { analyzeResume } from "../services/resume";
import { extractFileText } from "../services/pdf";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import {
  clearGoal, getGoal, getProfile, getProgress, markDiagnosticSkipped,
  saveGoal, saveProfile, toggleTopicProgress, type RoadmapProgress
} from "../services/goal";
import {applyProgress, buildRoadmap, type Roadmap, type RoadmapTopic} from "../services/roadmap";
import { useApp } from "../store";
import { toast } from "../toast";
import {btnGhost, btnOk, btnPrimary, btnSm, cardCls, Seg} from "./ui";

/* P4 roadmap → coding wiring: match this week's topic labels to playground
   problems so "solve X problems in category Y" becomes concrete actions.
   Curated per-topic links (src/data/codingMap.ts) → keyword fallback → daily pick. */

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
  const { state, nav, startDiagnostic, startPlannedSession, practice } = useApp();
  const [goal, setGoal] = useState<CareerGoal | null>(() => getGoal());
  const [profile, setProfile] = useState(() => getProfile());
  const [step, setStep] = useState<"goal" | "skills" | "assess" | "done">(() => (getGoal() ? "done" : "goal"));
  const [draft, setDraft] = useState<CareerGoal>(() => getGoal() ?? defaultGoal());
  const [skills, setSkills] = useState<SkillRating[]>(() => getProfile()?.skills ?? []);
  const [progress, setProgress] = useState<RoadmapProgress>(() => getProgress());
  const [learn, setLearn] = useState<RoadmapTopic | null>(null);
  const [, setAi] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chat, setChat] = useState<Map<string, TutorMsg[]>>(new Map());
  const [chatBusy, setChatBusy] = useState(false);
  const [jdMode, setJdMode] = useState(false);
  const [jdText, setJdText] = useState("");
  const [resumeMode, setResumeMode] = useState(false);
  const [resumePaste, setResumePaste] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  const [gapJd, setGapJd] = useState("");
  const [gapResult, setGapResult] = useState<{ field: string; level: string; missingSkills: string[]; missingKeywords: string[] } | null>(null);
  const proGated = isPaywallEnabled() && getTier() !== "pro";

  const roadmap = useMemo(
    () => (goal && profile ? buildRoadmap(goal, profile, state.sessions) : null),
    [goal, profile, state.sessions]
  );

  /* apply progress on a defensive copy (applyProgress mutates in place) */
  const adapted = useMemo(() => {
    if (!roadmap) return null;
    const copy: Roadmap = { ...roadmap, weeks: roadmap.weeks.map(w => ({ ...w, topics: w.topics.map(t => ({ ...t })) })) };
    return applyProgress(copy, progress);
  }, [roadmap, progress]);

  const saveDraft = () => {
    saveGoal(draft);
    const p = { goal: draft, skills };
    saveProfile(p);
    setGoal(draft);
    setProfile(p);
    return p;
  };

  const onLearn = (t: RoadmapTopic) => { setLearn(t); setAi(null); setAiLoading(false); };

  const appendChat = (id: string, ...msgs: TutorMsg[]) =>
    setChat(new Map(chat).set(id, [...(chat.get(id) ?? []), ...msgs]));

  const onExplain = async () => {
    if (!learn || !goal) return;
    setAiLoading(true);
    try {
      let reply: string;
      if (isSystemDesignTopic(learn.label)) {
        reply = await explainSystemDesign(learn.label, goal);
      } else {
        reply = await explainTopic(learn.label, goal);
      }
      setAi(reply);
      appendChat(learn.id, { role: "assistant", content: reply });
    } catch (e) {
      toast("✗ " + ((e as Error).message || "AI unavailable — add an API key in Settings"));
      setAi(null);
    } finally { setAiLoading(false); }
  };

  const onAsk = async (t: RoadmapTopic, text: string) => {
    if (!goal) return;
    const history = chat.get(t.id) ?? [];
    const userMsg: TutorMsg = { role: "user", content: text };
    appendChat(t.id, userMsg);
    setChatBusy(true);
    try {
      let reply;
      if (isSystemDesignTopic(t.label)) {
        reply = await systemDesignChat(t.label, goal, [...history, userMsg]);
      } else {
        reply = await tutorChat(t.label, goal, [...history, userMsg]);
      }
      appendChat(t.id, {
        role: "assistant", content: reply.text,
        citations: reply.citations, grounded: reply.grounded, checked: reply.checked
      });
    } catch (e) {
      toast("✗ " + ((e as Error).message || "AI unavailable — add an API key in Settings"));
    } finally { setChatBusy(false); }
  };

  const toggleDone = (t: RoadmapTopic) => {
    if (goal) setProgress(toggleTopicProgress(goal, t.id));
  };

  const practiceWeek = () => {
    if (!goal || !adapted) return;
    const cur = adapted.weeks.find(w => w.status === "current") ?? adapted.weeks[0];
    const labels = (cur?.topics ?? []).filter(t => !t.done).slice(0, 6).map(t => t.label);
    if (!labels.length) { toast("✅ Week complete — check the next week"); return; }
    startPlannedSession(
      { level: goal.targetLevel, field: goal.fieldId, company: goal.companyId },
      { count: 6, mode: "standard", timing: "relaxed", voice: state.config.voice },
      labels
    );
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

  const onCompany = (v: string) => {
    if (proGated && !draft.jd && v !== "general") {
      toast("🔒 Company-specific roadmaps are a Pro feature — upgrade in Settings");
      return;
    }
    setDraft({ ...draft, companyId: v });
  };

  const onAnalyzeJd = () => {
    if (jdText.trim().length < 20) { toast("Paste the full job description first"); return; }
    const r = analyzeJd(jdText);
    setDraft(d => ({
      ...d,
      /* the posting is the role you're preparing for — it becomes the target,
         while "you are now" stays your actual level (0-gap means same-level prep) */
      targetLevel: r.levelId,
      fieldId: r.fieldId,
      companyId: r.companyId ?? d.companyId,
      jd: jdText,
      jdKeywords: r.keywords
    }));
    setSkills([]);
    setJdMode(false);
    toast(`📋 Detected: ${levelById(r.levelId).name} · ${fieldById(r.fieldId)?.name ?? ""}${r.companyId ? " · " + companyById(r.companyId).name : ""}`);
  };

  const editGoal = () => {
    setDraft(goal ?? defaultGoal());
    setSkills(profile?.skills ?? []);
    setStep("goal");
  };

  const clearAll = () => {
    clearGoal();
    setGoal(null); setProfile(null);
    setDraft(defaultGoal()); setSkills([]); setProgress(getProgress());
    setStep("goal");
    toast("🧭 Goal cleared");
  };

  /* ---------------- wizard (no goal yet, or editing an existing goal) ---------------- */
  if (!goal || step !== "done") {
    return (
      <div className="anim-view mx-auto max-w-[860px]">
        <WizardHeader />
        {step === "goal" && (
          <div className={`${cardCls} mt-6 p-6`}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button className={`${!jdMode && !resumeMode ? btnPrimary : btnGhost} ${btnSm}`} onClick={() => { setJdMode(false); setResumeMode(false); }}>🎯 Pick a role</button>
              <button className={`${jdMode ? btnPrimary : btnGhost} ${btnSm}`} onClick={() => { setJdMode(true); setResumeMode(false); }}>📋 Paste a job description</button>
              <button className={`${resumeMode ? btnPrimary : btnGhost} ${btnSm}`} onClick={() => { setResumeMode(true); setJdMode(false); }}>📄 Import resume</button>
            </div>

            {jdMode && (
              <div className="mb-5 rounded-xl border border-acc1/30 bg-acc1/10 p-4">
                <label className="mb-1.5 block text-[12.5px] font-bold text-mut">Paste the posting — we'll detect the level, field and company</label>
                <textarea
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                  rows={4}
                  placeholder="e.g. Senior Backend Engineer at Stripe — Go, PostgreSQL, Kubernetes, distributed systems…"
                  className="w-full resize-y rounded-xl border border-line/25 bg-deep/60 p-3 text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
                />
                <button className={`${btnOk} ${btnSm} mt-2`} onClick={onAnalyzeJd}>🔍 Analyze & fill</button>
                {draft.jd && (
                  <p className="mt-2 text-[12px] text-ok">✓ Tailoring to your posting — {draft.jdKeywords?.length ?? 0} keywords will become P0 topics.</p>
                )}
              </div>
            )}

            {resumeMode && (
              <div className="mb-5 rounded-xl border border-acc1/30 bg-acc1/10 p-4">
                <label className="mb-1.5 block text-[12.5px] font-bold text-mut">Paste your resume / CV text or upload a file</label>
                <textarea
                  value={resumePaste}
                  onChange={e => setResumePaste(e.target.value)}
                  rows={4}
                  placeholder="Paste your resume text here…"
                  className="w-full resize-y rounded-xl border border-line/25 bg-deep/60 p-3 text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button className={`${btnOk} ${btnSm}`} disabled={resumeBusy || !resumePaste.trim()} onClick={() => {
                    if (!resumePaste.trim()) { toast("Paste your resume text first"); return; }
                    setResumeBusy(true);
                    try {
                      const r = analyzeResume(resumePaste);
                      setDraft(d => ({
                        ...d, currentLevel: r.levelId,
                        targetLevel: r.levelId === "ceo" ? "ceo" : LEVELS[Math.min(LEVEL_INDEX[r.levelId] + 1, LEVELS.length - 1)].id as LevelId,
                        fieldId: r.fieldId
                      }));
                      setSkills(r.skills);
                      setResumeMode(false);
                      toast(`📄 Detected: ${r.levelId} · ${FIELDS.find(f => f.id === r.fieldId)?.name ?? ""}`);
                    } finally { setResumeBusy(false); }
                  }}>
                    {resumeBusy ? <><span className="spinner" />…</> : "🔍 Analyze & prefill"}
                  </button>
                  <label className={`${btnGhost} ${btnSm} cursor-pointer`}>
                    📎 Upload .pdf / .txt / .docx
                    <input
                      type="file" accept=".pdf,.txt,.docx" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setResumeBusy(true);
                        try {
                          const text = await extractFileText(file);
                          setResumePaste(text);
                          const r = analyzeResume(text);
                          setDraft(d => ({
                            ...d, currentLevel: r.levelId,
                            targetLevel: r.levelId === "ceo" ? "ceo" : LEVELS[Math.min(LEVEL_INDEX[r.levelId] + 1, LEVELS.length - 1)].id as LevelId,
                            fieldId: r.fieldId
                          }));
                          setSkills(r.skills);
                          setResumeMode(false);
                          toast(`📄 Detected: ${r.levelId} · ${FIELDS.find(f => f.id === r.fieldId)?.name ?? ""}`);
                        } catch (err) {
                          toast("✗ Could not read file — try pasting the text");
                        } finally { setResumeBusy(false); }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* gap analysis — visible when skills are set (from resume or manual) */}
            {skills.length > 0 && !resumeMode && !jdMode && !gapResult && (
              <div className="mb-5 rounded-xl border border-warn/30 bg-warn/10 p-4">
                <div className="mb-1.5 flex items-center gap-2 text-[13.5px] font-extrabold">
                  <span>🔍 Resume gap analysis</span>
                  <span className="rounded-full border border-warn/40 bg-warn/15 px-2 py-0.5 text-[10px]">BETA</span>
                </div>
                <p className="mb-3 text-[12.5px] text-mut">Paste the job description you're targeting — we'll compare it against your detected skills and show the gaps.</p>
                <textarea value={gapJd} onChange={e => setGapJd(e.target.value)} rows={2} placeholder="Paste the target job description here…" className="w-full resize-y rounded-xl border border-line/25 bg-deep/60 p-2.5 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none" />
                <button className={`${btnOk} ${btnSm} mt-2`} disabled={!gapJd.trim()} onClick={() => {
                  if (!gapJd.trim()) { toast("Paste a job description first"); return; }
                  const fromResume = draft.fieldId;
                  const matchField = fromResume;
                  const lower = gapJd.toLowerCase();
                  /* Which of our skills does the JD mention? */
                  const missingSkills = skills.filter(s => !lower.includes(s.skill.toLowerCase().slice(0, 6))).map(s => s.skill);
                  /* JD keywords that don't match any skill */
                  const allWords = gapJd.split(/[,\s]+/).filter(w => w.length > 3 && /^[a-z]/i.test(w));
                  const skillLower = new Set(skills.map(s => s.skill.toLowerCase()));
                  const missingKeywords = [...new Set(allWords.filter(w => !skillLower.has(w.toLowerCase()) && (w.length > 5) && !["description","requirements","experience","qualifications","responsibilities"].includes(w.toLowerCase())))];
                  setGapResult({ field: matchField, level: draft.targetLevel, missingSkills: missingSkills.slice(0, 10), missingKeywords: missingKeywords.slice(0, 12) });
                }}>🔍 Analyze gap</button>
              </div>
            )}

            {gapResult && (
              <div className="mb-5 rounded-xl border border-acc1/30 bg-acc1/10 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13.5px] font-extrabold">📊 Gap analysis results</span>
                  <button className="rounded-lg border border-line/20 px-2.5 py-0.5 text-[11.5px] text-mut hover:bg-wht/10" onClick={() => setGapResult(null)}>✕ Close</button>
                </div>
                <p className="mb-3 text-[12.5px] text-mut">{gapResult.field} · {gapResult.level}</p>
                {gapResult.missingSkills.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[12px] font-bold uppercase tracking-wider text-warn">⚡ Skills not mentioned in the JD</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">{gapResult.missingSkills.map(s => <span key={s} className="rounded-lg border border-warn/30 bg-warn/15 px-2.5 py-1 text-[12px] font-bold text-warn">{s}</span>)}</div>
                  </div>
                )}
                {gapResult.missingKeywords.length > 0 && (
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-wider text-acc3">📌 JD keywords not in your skills</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">{gapResult.missingKeywords.map(k => <span key={k} className="rounded-lg border border-acc1/30 bg-acc1/15 px-2.5 py-1 text-[12px] font-bold text-acctxt">{k}</span>)}</div>
                  </div>
                )}
                {gapResult.missingSkills.length === 0 && gapResult.missingKeywords.length === 0 && <p className="text-[12px] text-ok">✓ Your resume skills cover everything mentioned in this JD — strong alignment!</p>}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <Field label={`Company ${proGated && !draft.jd ? "· 🔒 Pro" : "(optional)"}`}>
                <select value={draft.companyId} onChange={e => onCompany(e.target.value)} className="select-cls">
                  <option value="general">{GENERAL_COMPANY.icon} {GENERAL_COMPANY.name}</option>
                  {COMPANIES.map(c => (
                    <option key={c.id} value={c.id} disabled={proGated && !draft.jd}>{c.icon} {c.name}{proGated && !draft.jd ? " 🔒" : ""}</option>
                  ))}
                </select>
                {proGated && !draft.jd && (
                  <p className="mt-1 text-[11.5px] text-fnt">🔒 Company-fit weeks are a Pro feature — <button className="text-acc3 underline" onClick={() => nav("settings")}>upgrade</button> or paste a JD.</p>
                )}
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
                {draft.jdKeywords?.length ? ` · ${draft.jdKeywords.length} JD topics` : ""}
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
                <div key={s.skill} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/10 bg-deep/50 px-4 py-3">
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
        goal={goal} profile={profile} roadmap={adapted}
        onEdit={editGoal} onClear={clearAll}
        onRetake={() => startDiagnostic(goal.fieldId, goal.targetLevel)}
        onLearn={onLearn} onPractice={practiceTopic} onPracticeWeek={practiceWeek} onToggle={toggleDone}
        proGated={proGated} onUpgrade={() => nav("settings")} onCode={() => nav("playground")}
      />
      <LearnModal
        topic={learn} aiLoading={aiLoading}
        chat={learn ? (chat.get(learn.id) ?? []) : []} chatBusy={chatBusy}
        proGated={proGated} onUpgrade={() => nav("settings")}
        onClose={() => setLearn(null)} onExplain={onExplain} onAsk={onAsk}
        topics={(adapted?.weeks ?? []).flatMap(w => w.topics)} onRelated={onLearn}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Extracted sub-components                                             */
/* ------------------------------------------------------------------ */
import { Dashboard } from './roadmap/Dashboard';
import { LearnModal } from './roadmap/LearnModal';
import {WizardHeader, Field} from './roadmap/helpers';

