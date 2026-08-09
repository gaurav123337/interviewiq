import { useState } from "react";
import type { ReactNode } from "react";
import type { LevelId } from "../types";
import { COMPANIES, FIELDS, GENERAL_COMPANY, LEVELS } from "../data";
import { adaptPlan, buildPlan, type PlanDay } from "../services/planner";
import { useApp } from "../store";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip } from "./ui";

const fmt = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const defaultTarget = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return fmt(d);
};

export function Planner() {
  const { state, startPlannedSession, startWeakSession, nav } = useApp();
  const [levelId, setLevelId] = useState<LevelId>(state.ob.level ?? "mid");
  const [fieldId, setFieldId] = useState(state.ob.field ?? FIELDS[0].id);
  const [companyId, setCompanyId] = useState(state.ob.company ?? "general");
  const [targetDate, setTargetDate] = useState(defaultTarget());
  const [adapt, setAdapt] = useState(true);
  const [plan, setPlan] = useState<PlanDay[] | null>(null);

  const generate = () => {
    const input = { levelId, fieldId, companyId, targetDate };
    setPlan(adapt ? adaptPlan({ ...input, sessions: state.sessions }) : buildPlan(input));
  };

  const runDay = (d: PlanDay) => {
    const sel = { level: levelId, field: fieldId, company: companyId };
    const config = { count: 6, mode: "standard" as const, timing: "relaxed" as const, voice: state.config.voice };
    if (d.kind === "mock") {
      startPlannedSession(sel, { count: 10, mode: "mock", timing: "strict", voice: false });
    } else if (d.weak && d.topics?.length) {
      startWeakSession(fieldId, levelId, d.topics, config);
    } else {
      /* keywords focus the session on this phase's topic */
      const keywords = d.kind === "company"
        ? (COMPANIES.find(c => c.id === companyId)?.stack ?? [])
        : d.kind === "foundations" || d.kind === "field"
          ? (FIELDS.find(f => f.id === fieldId)?.skills ?? [])
          : [];
      startPlannedSession(sel, config, keywords);
    }
  };

  const daysLeft = plan
    ? Math.max(0, new Date(targetDate + "T00:00:00").getTime() - Date.now()) / 86_400_000
    : 0;

  const counts = plan
    ? {
        done: plan.filter(d => d.status === "done").length,
        skipped: plan.filter(d => d.status === "skipped").length,
        weak: plan.filter(d => d.weak).length
      }
    : null;

  return (
    <div className="anim-view mx-auto max-w-[860px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🗓️ Study Planner</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">A plan that ends with you <span className="grad-text">ready</span>.</h1>
        <p className="mx-auto mt-2 max-w-[540px] text-[14.5px] text-mut">
          Pick your target and interview date — we'll lay out a day-by-day prep plan from foundations to full mock interviews, and adapt it to the progress you've already made.
        </p>
      </div>

      {/* inputs */}
      <div className={`${cardCls} mt-6 flex flex-wrap items-end gap-3 p-5`}>
        <Field label="Level">
          <select value={levelId} onChange={e => setLevelId(e.target.value as LevelId)} className="select-cls">
            {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
          </select>
        </Field>
        <Field label="Field">
          <select value={fieldId} onChange={e => setFieldId(e.target.value)} className="select-cls">
            {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>) }
          </select>
        </Field>
        <Field label="Company">
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="select-cls">
            <option value="general">{GENERAL_COMPANY.icon} {GENERAL_COMPANY.name}</option>
            {COMPANIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Interview date">
          <input type="date" value={targetDate} min={fmt(new Date())} onChange={e => setTargetDate(e.target.value)} className="select-cls" />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-[12.5px] font-bold text-mut">
          <input type="checkbox" checked={adapt} onChange={e => setAdapt(e.target.checked)} className="accent-[#22d3ee]" />
          🎯 Adapt to my progress
        </label>
        <button className={btnPrimary + btnSm} onClick={generate}>Generate plan</button>
      </div>

      {!plan && (
        <div className={`${cardCls} mt-6 flex flex-col items-center px-5 py-14 text-center`}>
          <div className="mb-3 text-[42px]">🗓️</div>
          <h3 className="mb-1 text-lg font-bold">No plan yet</h3>
          <p className="text-sm text-mut">Fill in your target and hit “Generate plan”.</p>
        </div>
      )}

      {plan && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{plan.length} days · starts {plan[0].date} · interview {targetDate}</Chip>
              {adapt && state.sessions.length > 0 && counts && (
                <Chip tone="lvl">🎯 Adapted — {counts.done} done · {counts.weak} weak-topic day{counts.weak === 1 ? "" : "s"} · {counts.skipped} skipped</Chip>
              )}
            </div>
            <span className="text-[12.5px] text-fnt">{Math.ceil(daysLeft)} day{Math.ceil(daysLeft) === 1 ? "" : "s"} to go</span>
          </div>
          <div className="space-y-2.5">
            {plan.map(d => (
              <div key={d.day} className={`${cardCls} flex flex-wrap items-center gap-3 px-5 py-4 ${d.status === "skipped" && !d.weak ? "opacity-60" : ""}`}>
                <span className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-[15px] font-extrabold ${d.kind === "mock" || d.weak ? "grad-bg text-white" : "border border-white/15 bg-white/5 text-mut"}`}>
                  {d.day}
                </span>
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-extrabold">{d.title}</span>
                    <Chip tone="lvl">{kindLabel(d.kind)}</Chip>
                    {statusChip(d)}
                  </div>
                  <div className="text-[12.5px] text-mut">{d.date} — {d.focus}</div>
                  {d.note && <div className="mt-0.5 text-[11.5px] text-mut">{d.note}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button className={btnGhost + btnSm} onClick={() => nav("drill")}>🎴 Drill</button>
                  {d.status !== "skipped" && (
                    <button className={`${d.kind === "mock" || d.weak ? btnPrimary : btnGhost} ${btnSm}`} onClick={() => runDay(d)}>
                      {d.kind === "mock" ? "▶ Run mock" : d.weak ? "▶ Drill weak topics" : "▶ Run session"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function statusChip(d: PlanDay) {
  switch (d.status) {
    case "done": return <Chip tone="ok">✅ Done</Chip>;
    case "today": return <Chip tone="warn">🔥 Today</Chip>;
    case "skipped": return d.weak ? <Chip tone="warn">🎯 Weak topics</Chip> : <Chip>⏭ Skipped</Chip>;
    default: return null;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-bold text-mut">{label}</span>
      {children}
    </label>
  );
}

function kindLabel(k: PlanDay["kind"]): string {
  return {
    foundations: "Foundations",
    field: "Field",
    company: "Company",
    design: "Design",
    behavioral: "Behavioral",
    mock: "Mock"
  }[k];
}
