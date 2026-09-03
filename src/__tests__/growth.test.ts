import { describe, expect, it, vi } from "vitest";
import { avgScore, cardsDueToday, categoryMastery, scoresOverTime, streaks } from "../services/progress";
import { activatePro, deactivatePro, generateProKey, isValidProKey } from "../services/license";
import { getTier } from "../services/entitlements";
import { getSrs, rate, resetSrs } from "../services/drill";
import type { Config, SavedSession, SessionQuestion } from "../types";

/* license.ts gates format-key activation behind testLicensing(), which now
   ships OFF for launch (real Pro is server-verified). These tests exercise the
   legacy format-key feature itself, so force the flag on regardless of the
   shipped config default. */
vi.mock("../services/entitlement", async () => {
  const actual = await vi.importActual<typeof import("../services/entitlement")>("../services/entitlement");
  return { ...actual, testLicensing: () => true };
});

/* getTier() now gates local Pro on a signed-in account (Pro is an account
   property; a guest's forgeable local tier is ignored). The legacy format-key
   activation test below round-trips activatePro → getTier, so stub the cloud
   session as signed-in. getSupabaseClient is stubbed too because license.ts →
   events.queueEvent reaches for it (it no-ops on a null client). */
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: { id: "u1", email: "a@b.c" }, configured: true, syncing: false, error: null, oauth: [] }),
  getSupabaseClient: () => Promise.resolve(null),
  isCloudConfigured: () => false,
}));

const CFG: Config = { count: 8, mode: "standard", timing: "none", voice: false };

const sess = (date: number, pct = 0.7): SavedSession => ({
  id: String(date),
  date,
  meta: { field: "Backend", fieldId: "backend", company: "Stripe", companyId: "stripe", level: "Senior", levelId: "senior", mode: "standard" },
  config: CFG,
  agg: { score: pct * 5, pct, grade: "B" },
  answers: []
});

describe("progress analytics", () => {
  it("computes current and longest streaks from consecutive days", () => {
    const today = new Date("2026-08-09T12:00:00");
    const d = (offset: number) => today.getTime() - offset * 86_400_000;
    const sessions = [sess(d(0)), sess(d(1)), sess(d(2)), sess(d(5)), sess(d(6))];
    const st = streaks(sessions, today);
    expect(st.current).toBe(3);
    expect(st.longest).toBe(3);
  });

  it("does not break a streak when today has no session but yesterday did", () => {
    const today = new Date("2026-08-09T12:00:00");
    const d = (offset: number) => today.getTime() - offset * 86_400_000;
    expect(streaks([sess(d(1)), sess(d(2))], today).current).toBe(2);
    expect(streaks([sess(d(3))], today).current).toBe(0);
  });

  it("returns the score trend and averages", () => {
    const sessions = [sess(1, 0.6), sess(2, 0.8), sess(3, 0.9)];
    expect(scoresOverTime(sessions, 2)).toHaveLength(2);
    expect(avgScore(sessions)).toBeCloseTo(3.83, 1);
  });

  it("aggregates category mastery across sessions", () => {
    const q = { q: "?", a: "a", kp: ["k"], cat: "field" as const, catLabel: "Technical", catColor: "#fff", level: "senior" as const, src: "x" } as SessionQuestion;
    const a = (pct: number): SavedSession => ({ ...sess(1), answers: [{ q, user: "", score: 4, pct }] });
    const mastery = categoryMastery([a(0.8), a(0.6)]);
    expect(mastery).toHaveLength(1);
    expect(mastery[0].pct).toBeCloseTo(0.7, 1);
  });

  it("counts drill cards due today from the SRS schedule", () => {
    resetSrs();
    const t0 = Date.now();
    rate("a", "again", t0); /* due in 1 min */
    rate("b", "good", t0); /* due in 1 day */
    expect(cardsDueToday(t0)).toBe(0);
    expect(cardsDueToday(t0 + 61_000)).toBe(1);
    expect(Object.keys(getSrs()).length).toBe(2);
    resetSrs();
  });
});

describe("pro license keys", () => {
  it("accepts generated keys and rejects garbage", () => {
    expect(isValidProKey(generateProKey())).toBe(true);
    expect(isValidProKey("IQPRO-ABCD-EFGH-1234")).toBe(false);
    expect(isValidProKey("hello")).toBe(false);
    expect(isValidProKey("")).toBe(false);
  });

  it("activates and deactivates the pro tier", () => {
    deactivatePro();
    expect(getTier()).toBe("free");
    const key = generateProKey();
    const r = activatePro(key);
    expect(r.ok).toBe(true);
    expect(getTier()).toBe("pro");
    const bad = activatePro("IQPRO-NOPE-NOPE-0000");
    expect(bad.ok).toBe(false);
    expect(getTier()).toBe("pro");
    deactivatePro();
    expect(getTier()).toBe("free");
  });
});
