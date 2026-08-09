import { describe, expect, it } from "vitest";
import {
  BEHAVIORAL, CEO_POOL, COMPANIES, CTO_POOL, FIELDS, GENERAL_COMPANY, LEVELS, LEVEL_INDEX, SYSTEM_DESIGN
} from "../data";
import { aggregate, buildFeedback, composeSession } from "../engine";
import type { LevelId, QA, SessionQuestion } from "../types";

const sq = (q: QA): SessionQuestion => ({
  ...q, cat: "field", catLabel: "Technical", catColor: "#22d3ee", level: "senior", src: "test"
});

describe("question bank integrity", () => {
  it("defines 8 fields, 7 levels, 12 companies + general", () => {
    expect(FIELDS).toHaveLength(8);
    expect(LEVELS).toHaveLength(7);
    expect(COMPANIES).toHaveLength(12);
    expect(GENERAL_COMPANY).toBeTruthy();
  });

  it("gives every field at least 4 questions per non-executive level", () => {
    for (const f of FIELDS) {
      for (const l of ["junior", "mid", "senior", "staff", "principal"] as LevelId[]) {
        expect((f.questions[l] ?? []).length, `${f.id}/${l}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("every question has a model answer and at least 3 key points", () => {
    let count = 0;
    for (const f of FIELDS) {
      for (const l of LEVELS) {
        for (const q of f.questions[l.id] ?? []) {
          count++;
          expect(q.a?.length, q.q).toBeGreaterThan(0);
          expect(Array.isArray(q.kp) && q.kp.length >= 3, q.q).toBe(true);
        }
      }
    }
    expect(count).toBeGreaterThan(150);
  });

  it("pools are populated", () => {
    expect(BEHAVIORAL.length).toBeGreaterThanOrEqual(10);
    expect(CTO_POOL.length).toBeGreaterThanOrEqual(10);
    expect(CEO_POOL.length).toBeGreaterThanOrEqual(10);
    for (const l of ["mid", "senior", "staff", "principal"] as const) {
      expect(SYSTEM_DESIGN[l]?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("session composition", () => {
  it("composes a session with at least 5 questions for every level", () => {
    for (const lvl of LEVELS) {
      const s = composeSession({ fieldId: "frontend", companyId: "google", levelId: lvl.id, count: 8, mode: "standard" });
      expect(s.questions.length, lvl.id).toBeGreaterThanOrEqual(5);
      expect(s.meta.company).toBe("Google");
      expect(s.meta.level).toBe(lvl.name);
    }
  });

  it("journey mode ramps difficulty from junior upward", () => {
    const journey = composeSession({ fieldId: "data", companyId: "netflix", levelId: "staff", count: 10, mode: "journey" });
    const ramp = journey.questions.every((q, i, arr) => i === 0 || LEVEL_INDEX[q.level] >= LEVEL_INDEX[arr[i - 1].level]);
    expect(ramp).toBe(true);
  });
});

describe("scoring", () => {
  const q = sq(FIELDS[0].questions.senior![0]);

  it("rewards answers that hit key points", () => {
    const good = buildFeedback(q.kp.map(k => k.split(" ")[0]).join(" "), q);
    expect(good.score).toBeGreaterThanOrEqual(4);
  });

  it("scores weak or empty answers low", () => {
    const bad = buildFeedback("not sure", q);
    expect(bad.score).toBeLessThanOrEqual(2);
    expect(buildFeedback("", q).score).toBe(0);
  });

  it("aggregates into a letter grade", () => {
    const agg = aggregate([
      { q, user: "x", fb: buildFeedback(q.kp.map(k => k.split(" ")[0]).join(" "), q) },
      { q, user: "x", fb: buildFeedback("not sure", q) }
    ]);
    expect(agg.grade).toMatch(/^[A-F]$/);
    expect(agg.cats.length).toBeGreaterThan(0);
  });
});
