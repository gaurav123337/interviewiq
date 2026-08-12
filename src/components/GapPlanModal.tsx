import { useEffect, useState } from "react";
import type { JobPosting } from "../types";
import { getGoal } from "../services/goal";
import { buildGapPlan, getGapPlan, saveGapPlan, type GapPlan } from "../services/gapPlan";
import { Chip, Modal } from "./ui";

export function GapPlanModal({ job, missing, onClose }: {
  job: JobPosting;
  missing: string[];
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<GapPlan | null>(() => getGapPlan(job.id));

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
              <span className="rounded-full bg-acc1/10 px-2 py-0.5 text-[11px] font-bold text-acctxt">~{it.estHours}h</span>
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
        Practical tip: tackle #{plan.items[0]?.skill} first — it's listed first in the role's requirements. Track your
        sessions in <b>Practice</b> and the <b>Roadmap</b> so completed work shortens this estimate.
      </p>
      <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
        Done — close
      </button>
    </Modal>
  );
}
