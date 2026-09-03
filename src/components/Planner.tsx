import { getGoal, getProfile } from "../services/goal";
import { planFromRoadmap, type PlanDay } from "../services/planner";
import { buildRoadmap } from "../services/roadmap";
import { useApp } from "../store";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip } from "./ui";

export function Planner() {
  const { state, startPlannedSession, nav } = useApp();
  const goal = getGoal();
  const profile = getProfile();

  /* the Planner is a day-level projection of the canonical roadmap — no goal, no plan */
  if (!goal) {
    return (
      <div className="anim-view mx-auto max-w-[860px]">
        <PlannerHeader />
        <div className={`${cardCls} mt-6 flex flex-col items-center px-5 py-14 text-center`}>
          <div className="mb-3 text-[42px]">🗺️</div>
          <h3 className="mb-1 text-lg font-bold">Set up your Career Roadmap first</h3>
          <p className="mb-4 max-w-[420px] text-sm text-mut">
            The day-by-day planner is built from your Career Roadmap. Set a goal and target date, and your daily plan appears here.
          </p>
          <button className={btnPrimary + btnSm} onClick={() => nav("roadmap")}>🗺️ Go to Career Roadmap</button>
        </div>
      </div>
    );
  }

  const roadmap = buildRoadmap(goal, profile, state.sessions);
  const plan = planFromRoadmap(roadmap);

  const runDay = (d: PlanDay) => {
    const sel = { level: goal.targetLevel, field: goal.fieldId, company: goal.companyId };
    if (d.kind === "mock") {
      startPlannedSession(sel, { count: 10, mode: "mock", timing: "strict", voice: false });
    } else {
      const config = { count: 6, mode: "standard" as const, timing: "relaxed" as const, voice: state.config.voice };
      /* the day's topics focus the session on exactly this day's slice of the week */
      startPlannedSession(sel, config, d.topics);
    }
  };

  return (
    <div className="anim-view mx-auto max-w-[860px]">
      <PlannerHeader />

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>{plan.length} days · starts {plan[0].date} · interview {goal.targetDate}</Chip>
            <Chip tone="lvl">🗺️ From your Career Roadmap</Chip>
          </div>
          <button className={btnGhost + btnSm} onClick={() => nav("roadmap")}>Open Roadmap →</button>
        </div>
        <div className="space-y-2.5">
          {plan.map(d => (
            <div key={d.day} className={`${cardCls} flex flex-wrap items-center gap-3 px-5 py-4 ${d.status === "skipped" ? "opacity-60" : ""}`}>
              <span className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-[15px] font-extrabold ${d.kind === "mock" ? "grad-bg text-white" : "border border-line/15 bg-wht/5 text-mut"}`}>
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
                  <button className={`${d.kind === "mock" ? btnPrimary : btnGhost} ${btnSm}`} onClick={() => runDay(d)}>
                    {d.kind === "mock" ? "▶ Run mock" : "▶ Run session"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlannerHeader() {
  return (
    <div className="pt-4 text-center">
      <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🗓️ Study Planner</span>
      <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">A plan that ends with you <span className="grad-text">ready</span>.</h1>
      <p className="mx-auto mt-2 max-w-[540px] text-[14.5px] text-mut">
        Your Career Roadmap, broken into a day-by-day prep plan — from foundations to a full mock interview. Practice a day and it counts toward the same roadmap.
      </p>
    </div>
  );
}

function statusChip(d: PlanDay) {
  switch (d.status) {
    case "done": return <Chip tone="ok">✅ Done</Chip>;
    case "today": return <Chip tone="warn">🔥 Today</Chip>;
    case "skipped": return <Chip>⏭ Skipped</Chip>;
    default: return null;
  }
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
