import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryRemoteStore, SyncEngine, policyFor } from "../services/sync";
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "../services/storage";

const T0 = Date.parse("2026-08-09T12:00:00Z");

/* A canonical profile aggregate (Item 11). The sync engine treats the value as
   an opaque blob; these fixtures prove an arbitrarily-shaped profile round-trips
   as a single unit under the "lww" policy. */
const profileBlob = (over: Record<string, unknown> = {}) => ({
  version: 2,
  goal: { currentLevel: "mid", targetLevel: "senior", fieldId: "frontend", companyId: "general", targetDate: "2026-12-01", hoursPerWeek: 6, createdAt: 1 },
  headline: "Senior Frontend Engineer", years: 6, location: "", remote: true,
  workAuth: "", targetTitles: ["Frontend Engineer"], summary: "",
  skills: { react: { slug: "react", display: "React", catalogId: "react", self: 4, sources: ["roadmap"], updatedAt: 1 } },
  updatedAt: 1,
  ...over
});

beforeEach(() => {
  localStorage.clear();
});

describe("sync policies", () => {
  it("classifies every key: merge / lww / local", () => {
    expect(policyFor(STORAGE_KEYS.sessions)).toBe("merge");
    expect(policyFor(STORAGE_KEYS.drillSrs)).toBe("merge");
    expect(policyFor(STORAGE_KEYS.applyTrack)).toBe("merge");
    expect(policyFor(STORAGE_KEYS.settings)).toBe("lww");
    expect(policyFor(STORAGE_KEYS.onboard)).toBe("lww");
    expect(policyFor(STORAGE_KEYS.tier)).toBe("lww");
    expect(policyFor(STORAGE_KEYS.licenseKey)).toBe("lww");
    /* the one canonical profile aggregate syncs as a single blob (Item 11) */
    expect(policyFor(STORAGE_KEYS.profile)).toBe("lww");
    /* device-private keys must never sync */
    expect(policyFor(STORAGE_KEYS.apiKey)).toBe("local");
    expect(policyFor(STORAGE_KEYS.apiBase)).toBe("local");
    expect(policyFor(STORAGE_KEYS.apiModel)).toBe("local");
    expect(policyFor(STORAGE_KEYS.usage)).toBe("local");
    expect(policyFor(STORAGE_KEYS.notifPrefs)).toBe("local");
    expect(policyFor(STORAGE_KEYS.notifLast)).toBe("local");
    expect(policyFor(STORAGE_KEYS.syncMeta)).toBe("local");
    /* the legacy shapes the canonical profile subsumes are RETIRED as of Item 11
       PR6 (migrated into iq.profile then deleted). These guards stay as a
       regression backstop: if an old build ever re-writes one, "local" ensures
       it never leaks to the cloud alongside the canonical blob. */
    expect(policyFor(STORAGE_KEYS.skills)).toBe("local");
    expect(policyFor(STORAGE_KEYS.goal)).toBe("local");
    expect(policyFor(STORAGE_KEYS.career)).toBe("local");
    expect(policyFor(STORAGE_KEYS.resume)).toBe("local");
  });

  it("defaults unknown/future keys to local (nothing leaks by accident)", () => {
    expect(policyFor("iq.futureKey")).toBe("local");
  });
});

describe("sync engine — first sign-in", () => {
  it("pushes local-only data up", async () => {
    storageSet(STORAGE_KEYS.settings, { count: 8, mode: "standard" });
    const remote = new InMemoryRemoteStore();
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const snap = await remote.pull();
    expect(snap[STORAGE_KEYS.settings]?.value).toEqual({ count: 8, mode: "standard" });
  });

  it("pulls remote-only data down", async () => {
    const remote = new InMemoryRemoteStore();
    await remote.push({ [STORAGE_KEYS.settings]: { value: { count: 15 }, updatedAt: T0 } });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    expect(storageGet(STORAGE_KEYS.settings, {})).toEqual({ count: 15 });
  });

  it("merges session history by id in both directions", async () => {
    storageSet(STORAGE_KEYS.sessions, [{ id: "local1", date: 2, meta: {}, config: {}, agg: {}, answers: [] }]);
    const remote = new InMemoryRemoteStore();
    await remote.push({
      [STORAGE_KEYS.sessions]: { value: [{ id: "remote1", date: 1, meta: {}, config: {}, agg: {}, answers: [] }], updatedAt: T0 }
    });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);

    const local = storageGet(STORAGE_KEYS.sessions, []) as { id: string }[];
    expect(local.map(s => s.id).sort()).toEqual(["local1", "remote1"]);
    const snap = await remote.pull();
    expect((snap[STORAGE_KEYS.sessions].value as { id: string }[]).map(s => s.id).sort()).toEqual(["local1", "remote1"]);
  });

  it("merges drill SRS per question, keeping the most recently reviewed entry", async () => {
    storageSet(STORAGE_KEYS.drillSrs, { q1: { due: 1, lvl: 1 } });
    const remote = new InMemoryRemoteStore();
    await remote.push({
      [STORAGE_KEYS.drillSrs]: { value: { q1: { due: 5, lvl: 2 }, q2: { due: 3, lvl: 0 } }, updatedAt: T0 }
    });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const srs = storageGet(STORAGE_KEYS.drillSrs, {}) as Record<string, { due: number; lvl: number }>;
    expect(srs.q1).toEqual({ due: 5, lvl: 2 }); /* remote reviewed later */
    expect(srs.q2).toEqual({ due: 3, lvl: 0 }); /* remote-only */
  });

  it("resolves scalar conflicts by timestamp — remote newer wins over pre-sync local", async () => {
    storageSet(STORAGE_KEYS.settings, { count: 8 }); /* written before any account existed (meta 0) */
    const remote = new InMemoryRemoteStore();
    await remote.push({ [STORAGE_KEYS.settings]: { value: { count: 15 }, updatedAt: T0 + 5000 } });
    const engine = new SyncEngine(() => T0 + 6000);
    await engine.signIn(remote);
    expect(storageGet(STORAGE_KEYS.settings, {})).toEqual({ count: 15 });
  });
});

describe("sync engine — ongoing sync", () => {
  it("debounces and pushes local writes made after sign-in", async () => {
    const remote = new InMemoryRemoteStore();
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    vi.useFakeTimers();
    try {
      storageSet(STORAGE_KEYS.settings, { count: 8 });
      let snap = await remote.pull(); /* not yet — debounce pending */
      expect(snap[STORAGE_KEYS.settings]).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1000);
      snap = await remote.pull();
      expect(snap[STORAGE_KEYS.settings]?.value).toEqual({ count: 8 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a local edit made after sign-in over an older remote value on pull", async () => {
    const remote = new InMemoryRemoteStore();
    await remote.push({ [STORAGE_KEYS.settings]: { value: { count: 15 }, updatedAt: T0 - 1000 } });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote); /* remote is older than nothing local... local empty → pulled? */
    expect(storageGet(STORAGE_KEYS.settings, {})).toEqual({ count: 15 });

    /* now edit locally (stamped T0, newer than remote T0-1000) and pull */
    storageSet(STORAGE_KEYS.settings, { count: 9 });
    vi.useFakeTimers();
    try {
      await vi.advanceTimersByTimeAsync(1000); /* flushed with updatedAt T0 */
      await engine.pull();
      expect(storageGet(STORAGE_KEYS.settings, {})).toEqual({ count: 9 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies remote-only keys on pull without echoing them back", async () => {
    const remote = new InMemoryRemoteStore();
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    await remote.push({ [STORAGE_KEYS.settings]: { value: { count: 15 }, updatedAt: T0 + 1000 } });
    await engine.pull();
    expect(storageGet(STORAGE_KEYS.settings, {})).toEqual({ count: 15 });
    /* remote unchanged (no echo) */
    const snap = await remote.pull();
    expect(snap[STORAGE_KEYS.settings]?.updatedAt).toBe(T0 + 1000);
  });

  it("propagates local removals to the remote", async () => {
    const remote = new InMemoryRemoteStore();
    const engine = new SyncEngine(() => T0);
    storageSet(STORAGE_KEYS.settings, { count: 8 });
    await engine.signIn(remote);
    vi.useFakeTimers();
    try {
      storageRemove(STORAGE_KEYS.settings);
      await vi.advanceTimersByTimeAsync(1000);
      const snap = await remote.pull();
      expect(snap[STORAGE_KEYS.settings]).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops syncing after sign-out", async () => {
    const remote = new InMemoryRemoteStore();
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    await engine.signOut();
    storageSet(STORAGE_KEYS.settings, { count: 8 });
    const snap = await remote.pull();
    expect(snap[STORAGE_KEYS.settings]).toBeUndefined();
  });
});

describe("sync engine — apply tracker per-job merge", () => {
  it("unions local + remote trackers by job, latest write wins per job", async () => {
    storageSet(STORAGE_KEYS.applyTrack, {
      jobA: { jobId: "jobA", status: "applied", appliedAt: 1, followUpAt: null, followUpNotified: false, notes: "", updatedAt: 100 },
      jobB: { jobId: "jobB", status: "applied", appliedAt: 2, followUpAt: null, followUpNotified: false, notes: "local", updatedAt: 50 }
    });
    const remote = new InMemoryRemoteStore();
    await remote.push({
      [STORAGE_KEYS.applyTrack]: {
        value: {
          jobB: { jobId: "jobB", status: "interview", appliedAt: 2, followUpAt: null, followUpNotified: false, notes: "remote", updatedAt: 200 },
          jobC: { jobId: "jobC", status: "offer", appliedAt: 3, followUpAt: null, followUpNotified: false, notes: "", updatedAt: 300 }
        },
        updatedAt: T0
      }
    });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const merged = storageGet<Record<string, { updatedAt: number; status: string; notes: string }>>(STORAGE_KEYS.applyTrack, {});
    /* jobA: local-only survives; jobB: remote newer wins; jobC: remote-only pulled */
    expect(Object.keys(merged).sort()).toEqual(["jobA", "jobB", "jobC"]);
    expect(merged.jobA.status).toBe("applied");
    expect(merged.jobB.status).toBe("interview");
    expect(merged.jobB.notes).toBe("remote");
    expect(merged.jobC.status).toBe("offer");
    /* merged result pushed back up so both sides converge */
    const snap = await remote.pull();
    const pushed = snap[STORAGE_KEYS.applyTrack]?.value as Record<string, { status: string }>;
    expect(Object.keys(pushed).sort()).toEqual(["jobA", "jobB", "jobC"]);
  });
});

describe("sync engine — canonical profile (Item 11)", () => {
  it("pushes the one canonical profile up on first sign-in", async () => {
    const profile = profileBlob();
    storageSet(STORAGE_KEYS.profile, profile);
    const remote = new InMemoryRemoteStore();
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const snap = await remote.pull();
    /* the whole aggregate (goal + skill graph + career fields) travels as one blob */
    expect(snap[STORAGE_KEYS.profile]?.value).toEqual(profile);
  });

  it("pulls the canonical profile down onto a fresh device", async () => {
    const profile = profileBlob();
    const remote = new InMemoryRemoteStore();
    await remote.push({ [STORAGE_KEYS.profile]: { value: profile, updatedAt: T0 } });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote); /* fresh device: no local profile → pulled */
    expect(storageGet(STORAGE_KEYS.profile, null)).toEqual(profile);
  });

  it("last-write-wins: a newer remote profile replaces an older pre-sync local one", async () => {
    storageSet(STORAGE_KEYS.profile, profileBlob({ headline: "Old", updatedAt: 1 }));
    /* "pre-sync" = written before any account existed, so it carries no sync
       stamp (meta 0). Clear iq.syncMeta to model that exactly — and to shield
       the assertion from engines left subscribed by earlier tests in this file,
       which would otherwise re-stamp this key on the write above. */
    storageRemove(STORAGE_KEYS.syncMeta);
    const remote = new InMemoryRemoteStore();
    const newer = profileBlob({ headline: "New", updatedAt: T0 + 5000 });
    await remote.push({ [STORAGE_KEYS.profile]: { value: newer, updatedAt: T0 + 5000 } });
    const engine = new SyncEngine(() => T0 + 6000);
    await engine.signIn(remote);
    expect(storageGet(STORAGE_KEYS.profile, {})).toEqual(newer);
  });

  it("a cleared profile is not resurrected by a stale remote copy on pull", async () => {
    /* This locks the PR4 rebuild-and-restamp leak-fix under the PR5 lww policy:
       clearGoal / clearUploadedResume rewrite iq.profile with a FRESH stamp, so a
       stale-but-present remote row (older stamp) can never re-apply on a pull. */
    vi.useFakeTimers();
    try {
      const remote = new InMemoryRemoteStore();
      const engine = new SyncEngine(() => T0);
      await engine.signIn(remote);
      /* the user clears their goal/resume → the store rewrites a minimal profile
         (this local write stamps iq.syncMeta[profile] = T0) */
      const cleared = profileBlob({ goal: null, skills: {}, headline: "", updatedAt: T0 });
      storageSet(STORAGE_KEYS.profile, cleared);
      await vi.advanceTimersByTimeAsync(1000); /* debounced flush pushes the cleared profile up */
      /* a stale rich copy (older stamp) is what a lagging device/table still holds */
      await remote.push({ [STORAGE_KEYS.profile]: { value: profileBlob({ headline: "Rich" }), updatedAt: T0 - 5000 } });
      await engine.pull();
      /* local stamp (T0) ≥ stale remote stamp (T0−5000) → cleared profile stands */
      expect(storageGet(STORAGE_KEYS.profile, null)).toEqual(cleared);
    } finally {
      vi.useRealTimers();
    }
  });
});
