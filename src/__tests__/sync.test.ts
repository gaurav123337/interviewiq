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
    /* tier + licenseKey are server-authoritative (Item 15): device value is
       forgeable, so it must never sync and clobber the server-resolved tier. */
    expect(policyFor(STORAGE_KEYS.tier)).toBe("local");
    expect(policyFor(STORAGE_KEYS.licenseKey)).toBe("local");
    /* the one canonical profile aggregate syncs as a single blob (Item 11) */
    expect(policyFor(STORAGE_KEYS.profile)).toBe("lww");
    /* Item 15 — feature-progress coverage. Accumulate-only / monotonic maps
       merge (union never resurrects a deletion); whole blobs where un-tick /
       un-bookmark is a real action are lww (predictable, never resurrect). */
    expect(policyFor(STORAGE_KEYS.codingTrack)).toBe("merge");
    expect(policyFor(STORAGE_KEYS.gapPlans)).toBe("merge");
    expect(policyFor(STORAGE_KEYS.applyKit)).toBe("merge");
    expect(policyFor(STORAGE_KEYS.sysDesignProgress)).toBe("merge");
    expect(policyFor(STORAGE_KEYS.sysDesignHistory)).toBe("merge");
    expect(policyFor(STORAGE_KEYS.sysDesignFlashcards)).toBe("merge");
    expect(policyFor(STORAGE_KEYS.counselorPlan)).toBe("lww");
    expect(policyFor(STORAGE_KEYS.counselorProgress)).toBe("lww");
    expect(policyFor(STORAGE_KEYS.sysDesignBookmarks)).toBe("lww");
    expect(policyFor(STORAGE_KEYS.sysDesignTimer)).toBe("lww");
    /* deliberately NOT synced — LWW would resurrect intentionally-cleared /
       un-set state, or the value is ephemeral / device-private. */
    expect(policyFor(STORAGE_KEYS.roadmapProg)).toBe("local");
    expect(policyFor(STORAGE_KEYS.sysDesignQuiz)).toBe("local");
    expect(policyFor(STORAGE_KEYS.lastKit)).toBe("local");
    expect(policyFor(STORAGE_KEYS.lastCompare)).toBe("local");
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

/* ─── Item 15: feature-progress merge policies ───────────────────────────────
   Each test proves A ∪ B loses nothing and the tie-break is correct. The core
   hazard being guarded: an unwired "merge" key silently degrades to remote-wins
   LWW in mergeFor() and drops entries touched only on the losing device. */
describe("sync engine — Item 15 feature-progress merges", () => {
  it("codingTrack: unions by problem; fails=max, solved latches", async () => {
    storageSet(STORAGE_KEYS.codingTrack, {
      pA: { fails: 3, solved: false },   // local-only
      pShared: { fails: 1, solved: true } // solved locally
    });
    const remote = new InMemoryRemoteStore();
    await remote.push({
      [STORAGE_KEYS.codingTrack]: {
        value: {
          pShared: { fails: 4, solved: false }, // more fails remotely, not solved there
          pB: { fails: 2, solved: false }        // remote-only
        },
        updatedAt: T0
      }
    });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const t = storageGet<Record<string, { fails: number; solved: boolean }>>(STORAGE_KEYS.codingTrack, {});
    expect(Object.keys(t).sort()).toEqual(["pA", "pB", "pShared"]);
    expect(t.pA).toEqual({ fails: 3, solved: false });
    expect(t.pB).toEqual({ fails: 2, solved: false });
    expect(t.pShared).toEqual({ fails: 4, solved: true }); // max fails, solve latched
  });

  it("gapPlans: unions by job; larger createdAt wins a same-job tie", async () => {
    storageSet(STORAGE_KEYS.gapPlans, {
      jobA: { jobId: "jobA", createdAt: 100 },        // local-only
      jobShared: { jobId: "jobShared", createdAt: 50, company: "local" }
    });
    const remote = new InMemoryRemoteStore();
    await remote.push({
      [STORAGE_KEYS.gapPlans]: {
        value: {
          jobShared: { jobId: "jobShared", createdAt: 200, company: "remote" },
          jobB: { jobId: "jobB", createdAt: 300 }      // remote-only
        },
        updatedAt: T0
      }
    });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const g = storageGet<Record<string, { company?: string }>>(STORAGE_KEYS.gapPlans, {});
    expect(Object.keys(g).sort()).toEqual(["jobA", "jobB", "jobShared"]);
    expect(g.jobShared.company).toBe("remote"); // createdAt 200 > 50
  });

  it("applyKit: unions by job; newer updatedAt wins", async () => {
    storageSet(STORAGE_KEYS.applyKit, {
      jobA: { jobId: "jobA", resume: "localA", updatedAt: 100 },        // local-only
      jobShared: { jobId: "jobShared", resume: "localEdit", updatedAt: 500 }
    });
    const remote = new InMemoryRemoteStore();
    await remote.push({
      [STORAGE_KEYS.applyKit]: {
        value: {
          jobShared: { jobId: "jobShared", resume: "remoteEdit", updatedAt: 200 }, // older edit
          jobB: { jobId: "jobB", resume: "remoteB", updatedAt: 300 }               // remote-only
        },
        updatedAt: T0
      }
    });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const k = storageGet<Record<string, { resume: string }>>(STORAGE_KEYS.applyKit, {});
    expect(Object.keys(k).sort()).toEqual(["jobA", "jobB", "jobShared"]);
    expect(k.jobShared.resume).toBe("localEdit"); // updatedAt 500 > 200
  });

  it("sysDesignProgress: unions caseId→ts, keeping the later completion", async () => {
    storageSet(STORAGE_KEYS.sysDesignProgress, { caseA: 100, caseShared: 999 });
    const remote = new InMemoryRemoteStore();
    await remote.push({
      [STORAGE_KEYS.sysDesignProgress]: { value: { caseShared: 500, caseB: 300 }, updatedAt: T0 }
    });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const p = storageGet<Record<string, number>>(STORAGE_KEYS.sysDesignProgress, {});
    expect(p).toEqual({ caseA: 100, caseB: 300, caseShared: 999 }); // max ts wins
  });

  it("sysDesignFlashcards: unions by composite key, keeping later nextReview", async () => {
    storageSet(STORAGE_KEYS.sysDesignFlashcards, {
      "caseA|1": { caseId: "caseA", number: "1", nextReview: 100 },
      "caseS|2": { caseId: "caseS", number: "2", nextReview: 900 }
    });
    const remote = new InMemoryRemoteStore();
    await remote.push({
      [STORAGE_KEYS.sysDesignFlashcards]: {
        value: {
          "caseS|2": { caseId: "caseS", number: "2", nextReview: 400 },
          "caseB|3": { caseId: "caseB", number: "3", nextReview: 300 }
        },
        updatedAt: T0
      }
    });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const f = storageGet<Record<string, { nextReview: number }>>(STORAGE_KEYS.sysDesignFlashcards, {});
    expect(Object.keys(f).sort()).toEqual(["caseA|1", "caseB|3", "caseS|2"]);
    expect(f["caseS|2"].nextReview).toBe(900); // later review wins
  });

  it("sysDesignHistory: unions by date, newest first, capped at 50", async () => {
    storageSet(STORAGE_KEYS.sysDesignHistory, [
      { date: 5, completed: 1 }, { date: 3, completed: 1 }
    ]);
    const remote = new InMemoryRemoteStore();
    await remote.push({
      [STORAGE_KEYS.sysDesignHistory]: {
        value: [{ date: 4, completed: 1 }, { date: 3, completed: 9 }], updatedAt: T0
      }
    });
    const engine = new SyncEngine(() => T0);
    await engine.signIn(remote);
    const h = storageGet<{ date: number }[]>(STORAGE_KEYS.sysDesignHistory, []);
    expect(h.map(e => e.date)).toEqual([5, 4, 3]); // union, desc, no dup date
    expect(h.length).toBe(3);
  });

  it("counselorProgress: lww whole-blob — a newer un-tick is NOT resurrected", async () => {
    /* the honesty guard: if this key ever silently became "merge", an un-ticked
       week on the newer device would be re-ticked from the stale remote blob. */
    vi.useFakeTimers();
    try {
      const remote = new InMemoryRemoteStore();
      const engine = new SyncEngine(() => T0);
      await engine.signIn(remote);
      /* user ticks two weeks, syncs, then un-ticks week 2 (newer local write) */
      storageSet(STORAGE_KEYS.counselorProgress, { planX: { 1: true, 2: true } });
      await vi.advanceTimersByTimeAsync(1000);
      storageSet(STORAGE_KEYS.counselorProgress, { planX: { 1: true, 2: false } });
      await vi.advanceTimersByTimeAsync(1000);
      /* a stale remote row still holds week 2 ticked (older stamp) */
      await remote.push({ [STORAGE_KEYS.counselorProgress]: { value: { planX: { 1: true, 2: true } }, updatedAt: T0 - 5000 } });
      await engine.pull();
      expect(storageGet(STORAGE_KEYS.counselorProgress, {})).toEqual({ planX: { 1: true, 2: false } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("cross-device honesty: two devices with disjoint data converge to the union", async () => {
    /* Device A signs in with its data, then device B (fresh local, same remote)
       signs in with disjoint data. Both must end up with the full union and
       nothing either device created may be dropped. */
    const remote = new InMemoryRemoteStore();

    // Device A
    storageSet(STORAGE_KEYS.codingTrack, { pA: { fails: 2, solved: true } });
    storageSet(STORAGE_KEYS.gapPlans, { jobA: { jobId: "jobA", createdAt: 10 } });
    storageSet(STORAGE_KEYS.sysDesignProgress, { caseA: 111 });
    const engineA = new SyncEngine(() => T0);
    await engineA.signIn(remote);
    await engineA.signOut();

    // Device B — fresh localStorage, disjoint data
    localStorage.clear();
    storageSet(STORAGE_KEYS.codingTrack, { pB: { fails: 1, solved: false } });
    storageSet(STORAGE_KEYS.gapPlans, { jobB: { jobId: "jobB", createdAt: 20 } });
    storageSet(STORAGE_KEYS.sysDesignProgress, { caseB: 222 });
    const engineB = new SyncEngine(() => T0 + 1000);
    await engineB.signIn(remote);

    // Device B now holds the union
    expect(Object.keys(storageGet(STORAGE_KEYS.codingTrack, {})).sort()).toEqual(["pA", "pB"]);
    expect(Object.keys(storageGet(STORAGE_KEYS.gapPlans, {})).sort()).toEqual(["jobA", "jobB"]);
    expect(storageGet(STORAGE_KEYS.sysDesignProgress, {})).toEqual({ caseA: 111, caseB: 222 });

    // …and so does the remote, so device A converges on its next pull
    const snap = await remote.pull();
    expect(Object.keys(snap[STORAGE_KEYS.codingTrack].value as object).sort()).toEqual(["pA", "pB"]);
    expect(Object.keys(snap[STORAGE_KEYS.gapPlans].value as object).sort()).toEqual(["jobA", "jobB"]);
    expect(snap[STORAGE_KEYS.sysDesignProgress].value).toEqual({ caseA: 111, caseB: 222 });
  });
});
