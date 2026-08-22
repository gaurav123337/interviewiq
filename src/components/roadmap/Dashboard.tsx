import type { CareerGoal } from '../../types';
import { getProfile } from '../../services/goal';
import { codingForTopicLabels } from '../../data/codingMap';
import { freqForProblem } from '../../data/codingCompanies';
import type { CodingProblem } from '../../data/coding';
import {companyById, fieldById, levelById} from '../../data';

import { type Roadmap, type RoadmapTopic } from '../../services/roadmap';
import {btn, btnGhost, btnPrimary, btnSm, cardCls, Chip} from '../ui';
import { WizardHeader, Stat, weekChip, exportRoadmap } from './helpers';

function codeFocusFor(topics: RoadmapTopic[]): CodingProblem[] {
  return codingForTopicLabels(topics.map(t => t.label));
}

export function Dashboard({ goal, profile, roadmap, onEdit, onClear, onRetake, onLearn, onPractice, onPracticeWeek, onToggle, proGated, onUpgrade, onCode }: {
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
                {codeFocusFor((roadmap.weeks.find(w => w.status === "current") ?? roadmap.weeks[0])?.topics ?? []).map(p => {
                  const heat = goal.companyId !== "general" ? freqForProblem(goal.companyId, p.id) : null;
                  return (
                    <button
                      key={p.id}
                      onClick={onCode}
                      className="flex items-center gap-2 rounded-xl border border-line/10 bg-wht/5 px-3 py-2 text-left text-[12.5px] font-bold transition-all hover:border-acc1/40"
                    >
                      <span>{p.kind === "fn" ? "🧩" : p.kind === "ui" ? "🎨" : "⚙️"}</span>
                      {p.title}
                      {heat && <span className="text-[10px] font-bold text-acctxt">🔥{heat}</span>}
                      <span className={`text-[10.5px] font-extrabold uppercase ${p.difficulty === 1 ? "text-ok" : p.difficulty === 2 ? "text-warn" : "text-bad"}`}>
                        {["Easy", "Medium", "Hard"][p.difficulty - 1]}
                      </span>
                    </button>
                  );
                })}
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
