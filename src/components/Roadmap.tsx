import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CareerGoal, LevelId, SkillRating } from "../types";
import { COMPANIES, FIELDS, GENERAL_COMPANY, LEVELS, LEVEL_INDEX, companyById, fieldById, levelById } from "../data";
import { getDeepDive } from "../data/deepDive";
import { aiAvailable } from "../ai";
import { explainTopic, tutorChat, type TutorMsg } from "../services/tutor";
import { analyzeJd } from "../services/jd";
import { analyzeResume } from "../services/resume";
import { extractFileText } from "../services/pdf";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import {
  clearGoal, getGoal, getProfile, getProgress, markDiagnosticSkipped,
  saveGoal, saveProfile, toggleTopicProgress, type RoadmapProgress
} from "../services/goal";
import { applyProgress, buildRoadmap, downloadRoadmapMarkdown, exportRoadmapMarkdown, type Roadmap, type RoadmapTopic } from "../services/roadmap";
import { useApp } from "../store";
import { toast } from "../toast";
import { btn, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Drawer, Seg } from "./ui";
import { CODING_PROBLEMS, type CodingProblem } from "../data/coding";

/* P4 roadmap → coding wiring: match this week's topic labels to playground
   problems so "solve X problems in category Y" becomes concrete actions.
   Falls back to the daily pick when nothing matches. */
function codeFocusFor(topics: RoadmapTopic[]): CodingProblem[] {
  const text = topics.map(t => t.label.toLowerCase()).join(" ");
  const match = (re: RegExp): boolean => re.test(text);
  const picks: CodingProblem[] = [];
  if (match(/async|promise|timer|event|debounce|throttle/i))
    picks.push(...CODING_PROBLEMS.filter(p => p.kind === "fn" && /async|timing/i.test(p.category)));
  if (match(/dom|component|html|css|ui|frontend/i))
    picks.push(...CODING_PROBLEMS.filter(p => p.kind === "ui"));
  if (match(/array|string|hash|two.?pointer|sliding|stack|queue|recurs|dp|dynamic|binary|search|sort|graph|tree|linked/i))
    picks.push(...CODING_PROBLEMS.filter(p => p.kind === "cli" && p.difficulty <= 2));
  const seen = new Set<string>();
  const out: CodingProblem[] = [];
  for (const p of picks) { if (!seen.has(p.id)) { seen.add(p.id); out.push(p); } if (out.length >= 3) break; }
  if (out.length === 0) {
    const day = Math.floor(Date.now() / 86_400_000);
    out.push(CODING_PROBLEMS[day % CODING_PROBLEMS.length]);
  }
  return out;
}

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
      const reply = await explainTopic(learn.label, goal);
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
      const reply = await tutorChat(t.label, goal, [...history, userMsg]);
      appendChat(t.id, { role: "assistant", content: reply.text, citations: reply.citations });
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
                    📎 Upload .pdf / .txt
                    <input
                      type="file" accept=".pdf,.txt" className="hidden"
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
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function exportRoadmap(roadmap: Roadmap) {
  try {
    const md = exportRoadmapMarkdown(roadmap);
    const p = navigator.clipboard?.writeText(md);
    if (p) p.catch(() => {});
    downloadRoadmapMarkdown(roadmap);
    toast("⬇ Markdown copied & downloaded — paste it anywhere");
  } catch {
    toast("✗ Export failed — try the Print button instead");
  }
}

function Dashboard({ goal, profile, roadmap, onEdit, onClear, onRetake, onLearn, onPractice, onPracticeWeek, onToggle, proGated, onUpgrade, onCode }: {
  goal: CareerGoal;
  profile: ReturnType<typeof getProfile>;
  roadmap: Roadmap | null;
  onEdit: () => void;
  onClear: () => void;
  onRetake: () => void;
  onLearn: (t: RoadmapTopic) => void;
  onPractice: (t: RoadmapTopic) => void;
  onPracticeWeek: () => void;
  onToggle: (t: RoadmapTopic) => void;
  proGated: boolean;
  onUpgrade: () => void;
  onCode: () => void;
}) {
  const field = fieldById(goal.fieldId);
  const company = companyById(goal.companyId);
  const target = levelById(goal.targetLevel);
  const current = levelById(goal.currentLevel);

  const allTopics = roadmap?.weeks.flatMap(w => w.topics) ?? [];
  const doneCount = allTopics.filter(t => t.done).length;
  const p0 = allTopics.filter(t => t.priority === "P0" && !t.done).length;
  const weeksLeft = roadmap?.weeks.filter(w => w.status !== "done" && w.status !== "passed").length ?? 0;
  const totalWeeks = roadmap?.weeks.length ?? 0;
  const doneWeeks = roadmap?.weeks.filter(w => w.status === "done").length ?? 0;

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
            {goal.jd && <div className="mt-0.5 text-[11.5px] text-mut">📋 Tailored from a job description ({goal.jdKeywords?.length ?? 0} topics)</div>}
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            {roadmap && (
              <>
                <button className={btnPrimary + btnSm} onClick={onPracticeWeek} title="Launch a session from this week's topics">▶ Practice this week</button>
                <button className={btnGhost + btnSm} onClick={() => exportRoadmap(roadmap!)} title="Copy markdown + download .md">⬇ Export</button>
                <button className={btnGhost + btnSm} onClick={() => window.print()} title="Print or save as PDF (paper-friendly)">🖨 Print</button>
              </>
            )}
            <button className={btnGhost + btnSm} onClick={onRetake}>📝 Retake diagnostic</button>
            <button className={btnGhost + btnSm} onClick={onEdit}>✏️ Edit goal</button>
            <button className={`${btn} border border-line/10 px-3 py-1.5 text-[12.5px] text-fnt hover:bg-wht/10`} onClick={onClear}>Clear</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-line/10 bg-wht/[.03] px-6 py-4 sm:grid-cols-4">
          <Stat label="Weeks" value={roadmap ? `${doneWeeks}/${totalWeeks} done` : "—"} />
          <Stat label="Weeks left" value={weeksLeft || "—"} />
          <Stat label="P0 (must learn)" value={p0 || "—"} />
          <Stat label="Topics done" value={doneCount || "—"} />
        </div>
        {proGated && goal.companyId !== "general" && !goal.jd && (
          <div className="border-t border-line/10 bg-warn/10 px-6 py-3 text-[12.5px] text-warn">
            🔒 Company-fit weeks are a Pro feature — <button className="font-bold underline" onClick={onUpgrade}>upgrade to keep them</button>.
          </div>
        )}
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
            <div key={w.week} className={`${cardCls} px-5 py-4 ${w.status === "passed" || w.status === "done" ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`grid h-10 w-10 flex-none place-items-center rounded-xl text-[15px] font-extrabold ${w.status === "current" ? "grad-bg text-white" : "border border-line/15 bg-wht/5 text-mut"}`}>
                  {w.status === "done" ? "✓" : w.week}
                </span>
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-extrabold">{w.phaseLabel}</span>
                    <Chip tone="lvl">{weekChip(w.status)}</Chip>
                    <Chip>~{w.totalHours}h</Chip>
                    {w.topics.some(t => t.done) && <Chip tone="ok">{w.topics.filter(t => t.done).length}/{w.topics.length} done</Chip>}
                  </div>
                  <div className="text-[12.5px] text-mut">{w.start} → {w.end}</div>
                </div>
              </div>
              <div className="mt-3 text-[12.5px] leading-snug text-fnt">{w.goal}</div>
              <div className="mt-3 space-y-1.5">
                {w.topics.map(t => (
                  <div key={t.id} className={`flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/50 px-3.5 py-2.5 ${t.done ? "border-ok/30" : ""}`}>
                    <button
                      title={t.done ? "Mark not done" : "Mark done"}
                      onClick={() => onToggle(t)}
                      className={`grid h-7 w-7 flex-none place-items-center rounded-lg border text-[13px] font-extrabold transition-all ${t.done ? "border-ok/50 bg-ok/15 text-ok" : "border-line/20 text-fnt hover:bg-wht/10"}`}
                    >
                      {t.done ? "✓" : ""}
                    </button>
                    <Chip tone={t.priority === "P0" ? "bad" : t.priority === "P1" ? "warn" : "default"}>{t.priority}</Chip>
                    <Chip tone={t.done ? "ok" : t.progress === "mastered" ? "ok" : t.progress === "learning" ? "warn" : "default"}>
                      {t.done ? "done" : t.progress === "mastered" ? "✓" : t.progress === "learning" ? "~" : "·"} {t.done ? "" : t.progress}
                    </Chip>
                    <span className={`min-w-[160px] flex-1 text-[13.5px] font-bold leading-snug ${t.done ? "text-mut line-through" : ""}`}>{t.label}</span>
                    <span className="text-[12px] font-semibold text-fnt">~{t.estHours}h</span>
                    <button className={btnGhost + btnSm} onClick={() => onLearn(t)}>📖 Learn</button>
                    {!t.done && <button className={btnPrimary + btnSm} onClick={() => onPractice(t)}>▶ Practice</button>}
                  </div>
                ))}
              </div>
              {w.topics.some(t => t.statusNote && !t.done) && (
                <div className="mt-2 space-y-0.5">
                  {w.topics.filter(t => t.statusNote && !t.done).map(t => (
                    <div key={t.id} className="text-[11.5px] text-acc3">💡 {t.label.slice(0, 60)}{t.label.length > 60 ? "…" : ""} — {t.statusNote}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {roadmap && (
            <div className={`${cardCls} px-5 py-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[17px]">💻</span>
                <h4 className="flex-1 text-[14.5px] font-extrabold">Code focus for this week</h4>
                <button className={btnGhost + btnSm} onClick={onCode}>Open playground →</button>
              </div>
              <p className="mb-2 mt-0.5 text-[12.5px] text-mut">
                Hand-picked from the current week's topics — solving these reinforces what you're studying.
              </p>
              <div className="flex flex-wrap gap-2">
                {codeFocusFor((roadmap.weeks.find(w => w.status === "current") ?? roadmap.weeks[0])?.topics ?? []).map(p => (
                  <button
                    key={p.id}
                    onClick={onCode}
                    className="flex items-center gap-2 rounded-xl border border-line/10 bg-wht/5 px-3 py-2 text-left text-[12.5px] font-bold transition-all hover:border-acc1/40"
                  >
                    <span>{p.kind === "fn" ? "🧩" : p.kind === "ui" ? "🎨" : "⚙️"}</span>
                    {p.title}
                    <span className={`text-[10.5px] font-extrabold uppercase ${p.difficulty === 1 ? "text-ok" : p.difficulty === 2 ? "text-warn" : "text-bad"}`}>
                      {["Easy", "Medium", "Hard"][p.difficulty - 1]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={`${cardCls} px-5 py-3 text-center text-[12.5px] text-mut`}>
            Check topics off as you study — the plan re-balances: finished weeks are marked done and the current week pulls work forward.
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Learn modal                                                         */
/* ------------------------------------------------------------------ */

function LearnModal({ topic, aiLoading, chat, chatBusy, proGated, onClose, onExplain, onAsk, onUpgrade, topics, onRelated }: {
  topic: RoadmapTopic | null;
  aiLoading: boolean;
  chat: TutorMsg[];
  chatBusy: boolean;
  proGated: boolean;
  onClose: () => void;
  onExplain: () => void;
  onAsk: (t: RoadmapTopic, text: string) => void;
  onUpgrade: () => void;
  topics: RoadmapTopic[];
  onRelated: (t: RoadmapTopic) => void;
}) {
  const [ask, setAsk] = useState("");
  if (!topic) return null;
  const dd = getDeepDive(topic.label);
  const related = (dd.related ?? [])
    .map(label => topics.find(t => t.label.toLowerCase() === label.toLowerCase()))
    .filter((t): t is RoadmapTopic => !!t);
  return (
    <Drawer onClose={onClose} title={`📖 ${topic.label}`} desc={topic.practice ? `Practice topic · ${topic.priority} priority` : `Learning topic · ${topic.priority} priority`}>
      <p className="mb-4 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{topic.info.primer}</p>

      {/* curated concepts */}
      {dd.concepts.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-acc3">Core concepts</div>
          <div className="space-y-1.5">
            {dd.concepts.map(c => (
              <div key={c.name} className="rounded-lg border border-line/10 bg-wht/5 px-3 py-2">
                <div className="text-[13px] font-bold">{c.name}</div>
                <div className="text-[12.5px] leading-relaxed text-mut">{c.blurb}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* key points to mention */}
      {dd.points.length > 0 && (
        <div className="mb-4 rounded-xl border border-ok/25 bg-ok/10 p-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-ok">✅ Say this in your answer</div>
          <ul className="space-y-1.5 text-[13px] leading-relaxed">
            {dd.points.map(p => <li key={p} className="flex gap-2"><span className="flex-none text-ok">✓</span><span>{p}</span></li>)}
          </ul>
        </div>
      )}

      {/* common traps */}
      {dd.traps.length > 0 && (
        <div className="mb-4 rounded-xl border border-warn/25 bg-warn/10 p-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-warn">⚠️ Common traps</div>
          <ul className="space-y-1.5 text-[13px] leading-relaxed">
            {dd.traps.map(t => <li key={t} className="flex gap-2"><span className="flex-none text-warn">⚠</span><span>{t}</span></li>)}
          </ul>
        </div>
      )}

      {/* interview Q&A */}
      {dd.qa.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-acc3">🎯 Interview Q&A</div>
          <div className="space-y-2">
            {dd.qa.map((qa, i) => (
              <details key={i} className="group rounded-lg border border-line/15 bg-wht/5">
                <summary className="cursor-pointer px-3 py-2 text-[13px] font-bold text-acctxt">Q{i + 1}. {qa.q}</summary>
                <div className="border-t border-line/10 px-3 py-2 text-[12.5px] leading-relaxed text-mut">{qa.a}</div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* related topics */}
      {related.length > 0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-mut">🔗 Related topics</div>
          <div className="flex flex-wrap gap-2">
            {related.map(t => (
              <button key={t.id} onClick={() => onRelated(t)} className="rounded-full border border-acc1/40 bg-acc1/15 px-3 py-1 text-[12.5px] font-bold text-acctxt transition-colors hover:bg-acc1/30">
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {topic.practice && (
        <div className="mb-4 rounded-xl border border-acc1/25 bg-acc1/10 p-4">
          <div className="mb-1 text-[12.5px] font-bold uppercase tracking-wider text-acc3">Practice question</div>
          <p className="mb-2 text-[13.5px] font-bold leading-snug">{topic.practice.q}</p>
          <div className="mb-1 text-[11.5px] font-bold uppercase tracking-wider text-mut">Model answer</div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{topic.practice.a}</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {topic.info.links.map(l => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="rounded-lg border border-acc1/40 bg-acc1/15 px-3 py-1.5 text-[12.5px] font-bold text-acctxt hover:bg-acc1/30">
            ↗ {l.label}
          </a>
        ))}
      </div>

      <div className="rounded-xl border border-line/10 bg-deep/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-bold uppercase tracking-wider text-mut">✨ AI tutor</span>
          {aiAvailable() && (
            <button className={btnGhost + btnSm} onClick={onExplain} disabled={aiLoading}>Explain it to me</button>
          )}
        </div>
        {aiLoading && <p className="text-[13.5px] text-ink"><span className="spinner" />Explaining…</p>}

        {/* conversation thread */}
        {chat.length > 0 && (
          <div className="mb-3 max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
            {chat.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed ${m.role === "user" ? "grad-bg text-white" : "border border-line/10 bg-wht/10 text-ink"}`}>
                  {m.content}
                </div>
                {m.role === "assistant" && (m.citations?.length ?? 0) > 0 && (
                  <div className="mt-1 max-w-[90%] space-y-1">
                    {m.citations!.map((c, ci) => (
                      <CitationChip key={ci} title={c.title} content={c.content} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {chatBusy && <p className="text-[12.5px] text-fnt"><span className="spinner" />Thinking…</p>}
          </div>
        )}

        {proGated ? (
          <div className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-[12.5px] text-warn">
            🔒 The AI tutor chat is a Pro feature — <button className="font-bold underline" onClick={onUpgrade}>upgrade</button> to ask follow-up questions about any topic.
          </div>
        ) : aiAvailable() ? (
          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              const text = ask.trim();
              if (!text || chatBusy) return;
              onAsk(topic, text);
              setAsk("");
            }}
          >
            <input
              value={ask}
              onChange={e => setAsk(e.target.value)}
              placeholder="Ask a follow-up about this topic…"
              className="min-w-0 flex-1 rounded-xl border border-line/25 bg-deep/60 px-3 py-2 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
            />
            <button type="submit" className={btnPrimary + btnSm} disabled={chatBusy || !ask.trim()}>Send</button>
          </form>
        ) : (
          <p className="text-[12.5px] text-fnt">Add an AI key in Settings for generative explanations — the primer above works fully offline.</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button className={btnGhost} onClick={onClose}>Close</button>
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* bits                                                                */
/* ------------------------------------------------------------------ */

/* A visible citation under a grounded tutor reply — click to expand the source excerpt. */
function CitationChip({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className={`w-full rounded-lg border px-2.5 py-1.5 text-left transition-colors ${open ? "border-acc1/50 bg-acc1/10" : "border-line/15 bg-deep/60 hover:bg-wht/10"}`}
      title="Knowledge-base source"
    >
      <span className="block text-[11px] font-bold text-acc3">📚 {title}</span>
      <span className={`block text-[11.5px] leading-snug text-mut ${open ? "" : "line-clamp-1"}`}>
        {content}
      </span>
      <span className="mt-0.5 block text-[10px] font-semibold text-fnt">{open ? "▲ hide" : "▼ show source excerpt"}</span>
    </button>
  );
}

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
    case "done": return "✅ Done";
    default: return "⏭ Upcoming";
  }
}
