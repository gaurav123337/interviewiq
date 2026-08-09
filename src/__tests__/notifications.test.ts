import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkReminder, fire, getPrefs, savePrefs, streakMilestoneMsg } from "../services/notifications";
import type { Config, SavedSession } from "../types";

const CFG: Config = { count: 8, mode: "standard", timing: "none", voice: false };

const sess = (date: number): SavedSession => ({
  id: String(date),
  date,
  meta: { field: "Backend", fieldId: "backend", company: "Stripe", companyId: "stripe", level: "Senior", levelId: "senior", mode: "standard" },
  config: CFG,
  agg: { score: 4, pct: 0.8, grade: "B" },
  answers: []
});

beforeEach(() => {
  localStorage.clear();
  savePrefs({ enabled: true, time: "19:00" });
});

describe("daily reminder", () => {
  const due = () => checkReminder({ sessions: [], now: new Date("2026-08-09T20:00:00"), permission: "granted" });

  it("fires once per day when enabled, permitted, and not practiced", () => {
    expect(due().fired).toBe(true);
    /* second check the same day is suppressed */
    expect(checkReminder({ sessions: [], now: new Date("2026-08-09T21:00:00"), permission: "granted" })).toEqual({
      fired: false, reason: "already-notified"
    });
  });

  it("fires again on the next day", () => {
    due();
    const next = checkReminder({ sessions: [], now: new Date("2026-08-10T20:00:00"), permission: "granted" });
    expect(next.fired).toBe(true);
  });

  it("does not fire when the reminder is disabled", () => {
    savePrefs({ ...getPrefs(), enabled: false });
    expect(due().reason).toBe("disabled");
  });

  it("does not fire without notification permission", () => {
    expect(checkReminder({ sessions: [], now: new Date("2026-08-09T20:00:00"), permission: "denied" }).reason).toBe("permission:denied");
  });

  it("does not fire before the configured time", () => {
    const r = checkReminder({ sessions: [], now: new Date("2026-08-09T18:00:00"), permission: "granted" });
    expect(r).toEqual({ fired: false, reason: "too-early" });
  });

  it("does not fire when the user already practiced today", () => {
    const today = new Date("2026-08-09T12:00:00").getTime();
    const r = checkReminder({ sessions: [sess(today)], now: new Date("2026-08-09T20:00:00"), permission: "granted" });
    expect(r).toEqual({ fired: false, reason: "practiced" });
  });

  it("mentions the live streak in the reminder body", async () => {
    /* yesterday + day before = a live 2-day streak; capture delivery via the Notification stub */
    const ctor = vi.fn();
    class FakeNotification {
      static permission = "granted";
      static requestPermission = async () => "granted" as NotificationPermission;
      constructor(title: string, opts?: NotificationOptions) { ctor(title, opts); }
    }
    (globalThis as Record<string, unknown>).Notification = FakeNotification;
    const yesterday = new Date("2026-08-08T12:00:00").getTime();
    const twoAgo = new Date("2026-08-07T12:00:00").getTime();
    checkReminder({ sessions: [sess(yesterday), sess(twoAgo)], now: new Date("2026-08-09T20:00:00"), permission: "granted" });
    await new Promise(r => setTimeout(r, 0));
    expect(ctor).toHaveBeenCalledWith("🗓️ Daily reminder", expect.objectContaining({ body: expect.stringContaining("2-day streak") }));
    delete (globalThis as Record<string, unknown>).Notification;
  });
});

describe("streak milestones", () => {
  it("alerts on milestones only", () => {
    expect(streakMilestoneMsg(2)).not.toBeNull();
    expect(streakMilestoneMsg(3)).not.toBeNull();
    expect(streakMilestoneMsg(4)).toBeNull();
    expect(streakMilestoneMsg(7)).not.toBeNull();
    expect(streakMilestoneMsg(30)).not.toBeNull();
    expect(streakMilestoneMsg(31)).toBeNull();
    expect(streakMilestoneMsg(35)).not.toBeNull();
  });
});

describe("notification delivery", () => {
  it("constructs a Notification when permission is granted", async () => {
    const ctor = vi.fn();
    class FakeNotification {
      static permission = "granted";
      static requestPermission = async () => "granted" as NotificationPermission;
      constructor(title: string, opts?: NotificationOptions) { ctor(title, opts); }
    }
    (globalThis as Record<string, unknown>).Notification = FakeNotification;
    expect(await fire("t", "b")).toBe(true);
    expect(ctor).toHaveBeenCalledWith("t", expect.objectContaining({ body: "b" }));
    delete (globalThis as Record<string, unknown>).Notification;
  });

  it("does not deliver when permission is denied", async () => {
    class FakeNotification {
      static permission = "denied";
      static requestPermission = async () => "denied" as NotificationPermission;
      constructor(_title: string, _opts?: NotificationOptions) { /* noop */ }
    }
    (globalThis as Record<string, unknown>).Notification = FakeNotification;
    expect(await fire("t", "b")).toBe(false);
    delete (globalThis as Record<string, unknown>).Notification;
  });
});
