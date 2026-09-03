// @vitest-environment jsdom
/* Item 13 PR2 — the Planner is the Career Roadmap's day-level VIEW.
 *
 * planFromRoadmap() explodes a real buildRoadmap() into a near-term day list.
 * These tests drive the REAL roadmap engine (not a hand-built Roadmap) so the
 * projection stays faithful to what buildRoadmap actually produces. They lock the
 * contract the rewritten Planner.tsx relies on: contiguous dates from today, no
 * leading gap, a windowed/clipped tail, phase→kind mapping, per-day topic slicing,
 * status, and the capstone.
 *
 * Wall-clock independence: buildRoadmap keys week1.start off the machine's REAL
 * today (allocation.ts), so — exactly like roadmap.test.ts's `inWeeks` helper —
 * fixture target dates are computed RELATIVE TO THE REAL CLOCK (addDays(TODAY, n)),
 * never a frozen literal that would drift out of sync with weeks[0].start on a
 * later run. Every assertion injects opts.today = weeks[0].start (= TODAY), and all
 * date math steps by CALENDAR days (DST-safe), not by adding 86.4e6 ms. */

import { describe, expect, it } from "vitest";
import type { CareerGoal } from "../types";
import { buildRoadmap } from "../services/roadmap";
import { planFromRoadmap } from "../services/planner";

/* local date helpers — mirror roadmap/types' fmtDate, but step by calendar days so a
   DST fall-back can't turn a +24h delta into a same-day duplicate (see planner.ts). */
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return fmt(new Date(y, m - 1, d + n));
};
const TODAY = fmt(new Date());   // the machine's real today — buildRoadmap keys weeks off this

/** A goal whose interview is `days` out from the real today, so the fixture stays
    consistent with buildRoadmap's clock-keyed weeks on every run (not just 2026-09-03). */
function goal(days: number, over: Partial<CareerGoal> = {}): CareerGoal {
  return {
    currentLevel: "mid", targetLevel: "staff", fieldId: "backend", companyId: "stripe",
    targetDate: addDays(TODAY, days), hoursPerWeek: 6, createdAt: 1000, ...over
  };
}

describe("planFromRoadmap — the roadmap's day-level view", () => {
  it("starts today with no leading gap and emits contiguous daily dates", () => {
    const rm = buildRoadmap(goal(40), null, []);
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today });

    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].date).toBe(today);              // week1.start === today → no leading gap
    expect(plan[0].status).toBe("today");

    /* non-mock days are strictly consecutive CALENDAR days — checked by calendar
       addition (DST-safe), not a raw ms delta (which is 23h/25h across a DST boundary) */
    const nonMock = plan.filter(d => d.kind !== "mock");
    for (let i = 1; i < nonMock.length; i++) {
      expect(nonMock[i].date).toBe(addDays(nonMock[i - 1].date, 1));
    }
    /* dates are unique across the non-mock run (no dupes) */
    const nonMockDates = nonMock.map(d => d.date);
    expect(new Set(nonMockDates).size).toBe(nonMockDates.length);
  });

  it("windows a long roadmap down to maxDays (not a 182-row dump)", () => {
    const rm = buildRoadmap(goal(3650), null, []);   // 26-week roadmap (MAX_WEEKS clamp)
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today, maxDays: 28 });
    expect(plan.filter(d => d.kind !== "mock").length).toBe(28);   // windowed, not 182 rows
  });

  it("clips the tail at the interview date when the target falls inside the window", () => {
    /* target 10 days out, but the roadmap spans several weeks (MIN_WEEKS + phase count),
       so the raw explosion runs well past the interview — the window must clip at target.
       Without the `date <= targetDate` clip this would keep ~14+ days, not 11. */
    const rm = buildRoadmap(goal(10), null, []);
    const today = rm.weeks[0].start;
    expect(rm.weeks.length).toBeGreaterThanOrEqual(2);             // weeks explode past day 10
    const plan = planFromRoadmap(rm, { today, maxDays: 28 });
    const nonMock = plan.filter(d => d.kind !== "mock");
    expect(nonMock[nonMock.length - 1].date).toBe(rm.goal.targetDate);   // clipped exactly at target
    expect(nonMock.length).toBe(11);                              // today..today+10 inclusive
  });

  it("respects a smaller maxDays", () => {
    const rm = buildRoadmap(goal(3650), null, []);
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today, maxDays: 10 });
    expect(plan.filter(d => d.kind !== "mock").length).toBe(10);
  });

  it("gives every day a non-empty title and focus and a valid kind", () => {
    const rm = buildRoadmap(goal(40), null, []);
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today });
    const KINDS = new Set(["foundations", "field", "company", "design", "behavioral", "mock"]);
    for (const d of plan) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.focus.length).toBeGreaterThan(0);     // falls back to week.goal on a topicless day
      expect(KINDS.has(d.kind)).toBe(true);
    }
  });

  it("maps roadmap phases to planner kinds (staff+ → a design day; stripe → a company day)", () => {
    const rm = buildRoadmap(goal(40, { targetLevel: "staff", companyId: "stripe" }), null, []);
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today });
    /* the sysdesign phase (present for staff+) maps to kind "design"; the stripe company phase to "company" */
    expect(plan.some(d => d.kind === "design")).toBe(true);
    expect(plan.some(d => d.kind === "company")).toBe(true);
  });

  it("omits the company kind for a general-company goal", () => {
    const rm = buildRoadmap(goal(40, { companyId: "general" }), null, []);
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today });
    expect(plan.some(d => d.kind === "company")).toBe(false);
  });

  it("slices each week's topics across its days — day-topics ⊆ the week's labels", () => {
    const rm = buildRoadmap(goal(40), null, []);
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today });

    /* group non-mock days by their owning week (via date range) and check the round-robin invariant */
    for (const week of rm.weeks) {
      const end = addDays(week.start, 6);
      const weekDays = plan.filter(d => d.kind !== "mock").filter(d => d.date >= week.start && d.date <= end);
      if (!weekDays.length) continue;                // this week fell outside the window
      const weekLabels = new Set(week.topics.map(t => t.label));
      const seen = new Set<string>();
      for (const d of weekDays) {
        for (const label of d.topics ?? []) {
          expect(weekLabels.has(label)).toBe(true);  // ⊆ the week's labels
          expect(seen.has(label)).toBe(false);       // each topic appears on exactly one day
          seen.add(label);
        }
      }
      /* if the whole week is in-window, the 7-day union equals the week's topics */
      if (weekDays.length === 7) {
        expect(seen.size).toBe(weekLabels.size);
      }
    }
  });

  it("sets status by date: today / upcoming (no past days survive the window)", () => {
    const rm = buildRoadmap(goal(40), null, []);
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today });
    expect(plan[0].status).toBe("today");
    expect(plan.slice(1).every(d => d.status === "upcoming" || (d.kind === "mock" && d.status === "today"))).toBe(true);
    /* the window starts at today, so nothing is "skipped" */
    expect(plan.some(d => d.status === "skipped")).toBe(false);
  });

  it("appends a closing mock day as the last entry, dated within the target", () => {
    const rm = buildRoadmap(goal(40), null, []);
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today });
    const last = plan[plan.length - 1];
    expect(last.kind).toBe("mock");
    expect(last.title).toBe("Full mock interview");
    expect(last.date <= rm.goal.targetDate).toBe(true);
    /* exactly one mock day, and it is the last */
    expect(plan.filter(d => d.kind === "mock").length).toBe(1);
  });

  it("can omit the capstone when asked", () => {
    const rm = buildRoadmap(goal(40), null, []);
    const today = rm.weeks[0].start;
    const withCap = planFromRoadmap(rm, { today });
    const noCap = planFromRoadmap(rm, { today, capstone: false });
    expect(noCap.some(d => d.kind === "mock")).toBe(false);
    expect(noCap.length).toBe(withCap.length - 1);
  });

  it("renumbers days sequentially from 1", () => {
    const rm = buildRoadmap(goal(40), null, []);
    const today = rm.weeks[0].start;
    const plan = planFromRoadmap(rm, { today });
    plan.forEach((d, i) => expect(d.day).toBe(i + 1));
  });

  it("collapses to a single mock day dated at the target when the window is empty", () => {
    /* inject a 'today' well past every roadmap day (and past the target) so the window
       is empty on every run — this pins the capstone's empty-window branch (mockDate =
       targetDate when today > target) with exact values, independent of the wall clock. */
    const rm = buildRoadmap(goal(30), null, []);
    const plan = planFromRoadmap(rm, { today: addDays(rm.goal.targetDate, 365) });
    expect(plan.length).toBe(1);
    expect(plan[0].kind).toBe("mock");
    expect(plan[0].date).toBe(rm.goal.targetDate);
  });
});
