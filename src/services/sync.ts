/* ─────────────────────────────────────────────────────────────────────────────
   Storage-sync adapter — the seam that lets the app sync to an account without
   touching the feature layer.

   How it works
   ------------
   Every feature reads/writes through storage.ts (the storage repository). This
   module sits BELOW that interface:

     feature layer  →  storageGet / storageSet / storageRemove   (unchanged)
                                    │
                          subscribeStorage (change hook)
                                    ▼
                          SyncEngine  ──►  RemoteStore  (backend-agnostic)

   The engine listens for local writes (same-tab via subscribeStorage, plus the
   browser's native "storage" event for other tabs), debounces them, and pushes
   to the remote. On sign-in and on a timer it pulls remote changes back.
   localStorage remains the source of truth while offline; the account is a
   sync/backup layer — the offline-first PWA story is preserved.

   Per-key policy (see SYNC_POLICIES):
     - "merge"  — union-merge (sessions by id, drill SRS per question).
     - "lww"    — last-write-wins by timestamp (settings, onboarding, license).
     - "local"  — never syncs (API key, metering counters, reminder state —
                  device-private by nature).
   Unknown/future keys default to "local" so nothing leaks by accident.

   Wire format
   -----------
   SyncEntry = { value, updatedAt } — a timestamped snapshot per key.
   Per-key timestamps live in iq.syncMeta (maintained only by this engine) so
   LWW is possible even though localStorage itself stores no timestamps.

   Adding a real backend (e.g. Supabase) is a ~30-line adapter:

     class SupabaseRemoteStore implements RemoteStore {
       // table: user_sync(user_id text, key text, value jsonb, updated_at bigint,
       //                   primary key (user_id, key))
       async pull() {
         const { data } = await supabase.from("user_sync")
           .select("key, value, updated_at").eq("user_id", uid);
         return Object.fromEntries(data.map(r => [r.key, { value: r.value, updatedAt: r.updated_at }]));
       }
       async push(entries) {
         const rows = Object.entries(entries).map(([key, e]) => ({
           user_id: uid, key, value: e.value, updated_at: e.updatedAt
         }));
         await supabase.from("user_sync").upsert(rows, { onConflict: "user_id,key" });
       }
       async remove(keys) {
         await supabase.from("user_sync").delete()
           .eq("user_id", uid).in("key", keys);
       }
     }

   Sign-in / sign-out and the account UI are intentionally NOT here — the engine
   is backend- and UI-agnostic. Wire it:  engine.signIn(remote); engine.startAutoSync();
   ───────────────────────────────────────────────────────────────────────────── */

import type { SavedSession } from "../types";
import { STORAGE_KEYS, storageGet, storageSet, subscribeStorage } from "./storage";

/* ---------- types & policy ---------- */

export type SyncPolicy = "lww" | "merge" | "local";

/** A timestamped snapshot of one key — the wire format between client and remote. */
export interface SyncEntry {
  value: unknown;
  updatedAt: number;
}

/** Backend-agnostic contract. Implement this once per storage backend. */
export interface RemoteStore {
  /** Fetches the user's full snapshot: key → { value, updatedAt }. */
  pull(): Promise<Record<string, SyncEntry>>;
  /** Upserts changed keys. */
  push(entries: Record<string, SyncEntry>): Promise<void>;
  /** Deletes keys removed on the client. */
  remove(keys: string[]): Promise<void>;
}

export const SYNC_POLICIES: Record<string, SyncPolicy> = {
  [STORAGE_KEYS.sessions]: "merge",   // history — union by session id
  [STORAGE_KEYS.drillSrs]: "merge",   // SRS queue — union per question
  [STORAGE_KEYS.applyTrack]: "merge", // apply tracker — per-job latest wins
  [STORAGE_KEYS.onboard]: "lww",
  [STORAGE_KEYS.settings]: "lww",
  /* tier + licenseKey are SERVER-authoritative (services/entitlement.ts):
     refreshEntitlement() resolves the account's entitlement from Supabase and
     mirrors it locally, and getTier() fails closed to "free" for guests. The
     device value is forgeable, so syncing it would let a stale device clobber
     the server-resolved tier — Item 15 makes both device-private ("local"). */
  [STORAGE_KEYS.tier]: "local",
  [STORAGE_KEYS.licenseKey]: "local",
  /* The one canonical profile aggregate (roadmap Item 11) — goal + skill graph
     + career fields + resume + diagnostic in a single blob. LWW by the engine's
     per-key iq.syncMeta stamp: every mutation flows through profileStore →
     storageSet(iq.profile), which re-stamps, so the most recently saved profile
     wins. clearGoal / clearUploadedResume are canonical graph teardowns that
     restamp (see profileStore), so a cleared profile can't be resurrected by a
     stale-but-higher remote stamp. The legacy iq.skills / iq.goal / iq.career /
     iq.resume keys are RETIRED as of Item 11 PR6 (migrated into iq.profile then
     deleted); they stay "local" (absent from this map) as a regression backstop
     so that if an old build ever re-writes one, it never leaks to the cloud. */
  [STORAGE_KEYS.profile]: "lww",
  /* ---- Item 15: feature-progress coverage ----
     merge  — accumulate-only / monotonic maps; union never resurrects a deletion
              because these shapes have no deletion path. Each MUST have a branch
              in mergeFor() (an unwired "merge" key silently degrades to remote-
              wins LWW and drops entries touched only on the losing device). */
  [STORAGE_KEYS.codingTrack]: "merge",         // Record<problemId,{fails,solved}> — max fails, OR solved
  [STORAGE_KEYS.gapPlans]: "merge",            // Record<jobId,GapPlan> write-once — keep larger createdAt
  [STORAGE_KEYS.applyKit]: "merge",            // Record<jobId,ApplyKit> — keep larger updatedAt
  [STORAGE_KEYS.sysDesignProgress]: "merge",   // Record<caseId,ts> completion log — keep max ts
  [STORAGE_KEYS.sysDesignHistory]: "merge",    // QuizHistoryEntry[] append-only — union by date, cap 50
  [STORAGE_KEYS.sysDesignFlashcards]: "merge", // Record<caseId|n,FlashcardData> SRS — keep most-recently-reviewed (reviewedAt)
  /* lww — whole-blob replace; the newest write is the intended state. Chosen
           over merge where un-ticking / un-bookmarking is a real user action a
           key-union merge would dishonestly resurrect (no per-entry tombstone). */
  [STORAGE_KEYS.counselorPlan]: "lww",         // single StudyPlan blob
  /* counselorProgress is a MULTI-plan map (Record<planProgressKey, Record<week,
     boolean>>). Whole-blob lww is a CONSCIOUS trade-off: on concurrent offline
     edits to DIFFERENT plans the losing device's blob is dropped (cross-plan
     loss). We accept it because the inner week-map is pure booleans with NO
     per-plan/per-week timestamp (setWeekDone writes cur[week]=done), so a
     plan-keyed union has no honest tie-break for a plan edited on both sides —
     and an OR-union would resurrect a deliberate un-tick, the exact dishonesty
     the un-tick guard test forbids. Predictable most-recent-device-wins beats a
     dishonest merge. */
  [STORAGE_KEYS.counselorProgress]: "lww",     // weekly checkboxes — un-tick must not resurrect
  [STORAGE_KEYS.sysDesignBookmarks]: "lww",    // Record<caseId,ts> — un-bookmark deletes the key (no tombstone)
  [STORAGE_KEYS.sysDesignTimer]: "lww",        // per-case duration preset scalar
  /* roadmapProg stays "local" (absent): clearGoal hard-removes it with no
     restamp, and the fingerprint that would reject a stale copy lives INSIDE
     the blob, so LWW would resurrect intentionally-cleared progress. The goal
     itself already syncs via iq.profile. sysDesignQuiz (ephemeral in-progress
     session) and lastKit/lastCompare (device-private "last viewed" pointers)
     likewise stay local. */
  [STORAGE_KEYS.usage]: "local",      // metering belongs server-side eventually
  [STORAGE_KEYS.apiKey]: "local",     // device-private credentials
  [STORAGE_KEYS.apiBase]: "local",
  [STORAGE_KEYS.apiModel]: "local",
  [STORAGE_KEYS.notifPrefs]: "local", // notifications are per-device
  [STORAGE_KEYS.notifLast]: "local",
  [STORAGE_KEYS.syncMeta]: "local"    // engine metadata, never synced
};

export function policyFor(key: string): SyncPolicy {
  return SYNC_POLICIES[key] ?? "local";
}

/* ---------- per-key timestamps (LWW support) ---------- */

const SYNC_META = STORAGE_KEYS.syncMeta;

function getMeta(): Record<string, number> {
  return storageGet<Record<string, number>>(SYNC_META, {});
}

function stamp(key: string, now: number): void {
  const m = getMeta();
  m[key] = Math.max(m[key] ?? 0, now);
  storageSet(SYNC_META, m);
}

/* ---------- merge strategies ---------- */

/** Sessions: union by id (remote wins ties), newest first, capped like local history. */
function mergeSessions(local: unknown, remote: unknown): unknown {
  const l = Array.isArray(local) ? (local as SavedSession[]) : [];
  const r = Array.isArray(remote) ? (remote as SavedSession[]) : [];
  const byId = new Map<string, SavedSession>();
  for (const s of [...r, ...l]) if (s && typeof s.id === "string") byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => b.date - a.date).slice(0, 30);
}

/** Drill SRS: union per question; on conflict keep the entry reviewed most recently (later due). */
function mergeSrs(local: unknown, remote: unknown): unknown {
  const l = (local && typeof local === "object") ? local as Record<string, { due: number; lvl: number }> : {};
  const r = (remote && typeof remote === "object") ? remote as Record<string, { due: number; lvl: number }> : {};
  const out: Record<string, { due: number; lvl: number }> = { ...l };
  for (const [q, e] of Object.entries(r)) {
    const cur = out[q];
    if (!cur || e.due > cur.due) out[q] = e;
  }
  return out;
}

/** Apply tracker: a map keyed by jobId — per-job last-write-wins. */
function mergeTracks(local: unknown, remote: unknown): unknown {
  const l = (local && typeof local === "object") ? local as Record<string, { updatedAt?: number }> : {};
  const r = (remote && typeof remote === "object") ? remote as Record<string, { updatedAt?: number }> : {};
  const out: Record<string, unknown> = { ...l };
  for (const [jobId, e] of Object.entries(r)) {
    const cur = out[jobId] as { updatedAt?: number } | undefined;
    if (!cur || (e.updatedAt ?? 0) > (cur.updatedAt ?? 0)) out[jobId] = e;
  }
  return out;
}

/** Number-valued map (Record<string, number>): union by key, keep the larger
    value. Used by sysDesignProgress (caseId → completion ts) — both a later
    completion and a remote-only case survive; nothing is ever lowered or lost. */
function mergeMaxNumberMap(local: unknown, remote: unknown): unknown {
  const l = (local && typeof local === "object") ? local as Record<string, number> : {};
  const r = (remote && typeof remote === "object") ? remote as Record<string, number> : {};
  const out: Record<string, number> = { ...l };
  for (const [k, v] of Object.entries(r)) {
    const cur = out[k];
    if (typeof cur !== "number" || v > cur) out[k] = v;
  }
  return out;
}

/** Coding track: union by problemId — fails = max (monotonic attempt count),
    solved = OR (a solve on either device latches). No deletion path, so a
    problem touched on only one device always survives. */
function mergeCodingTrack(local: unknown, remote: unknown): unknown {
  const l = (local && typeof local === "object") ? local as Record<string, { fails?: number; solved?: boolean }> : {};
  const r = (remote && typeof remote === "object") ? remote as Record<string, { fails?: number; solved?: boolean }> : {};
  const out: Record<string, { fails: number; solved: boolean }> = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const a = l[k] ?? {}; const b = r[k] ?? {};
    out[k] = { fails: Math.max(a.fails ?? 0, b.fails ?? 0), solved: Boolean(a.solved) || Boolean(b.solved) };
  }
  return out;
}

/** Gap plans: union by jobId, keep the entry with the larger createdAt. Plans
    are write-once (no edit path), so this only decides ties when both devices
    built a plan for the same job — the later one wins; neither job is dropped. */
function mergeGapPlans(local: unknown, remote: unknown): unknown {
  const l = (local && typeof local === "object") ? local as Record<string, { createdAt?: number }> : {};
  const r = (remote && typeof remote === "object") ? remote as Record<string, { createdAt?: number }> : {};
  const out: Record<string, unknown> = { ...l };
  for (const [jobId, e] of Object.entries(r)) {
    const cur = out[jobId] as { createdAt?: number } | undefined;
    if (!cur || (e.createdAt ?? 0) > (cur.createdAt ?? 0)) out[jobId] = e;
  }
  return out;
}

/** Apply kits: union by jobId, keep the entry with the larger updatedAt (stamped
    by saveApplyKit on every save). A kit edited on either device wins by recency;
    a kit that exists on only one device always survives. */
function mergeApplyKit(local: unknown, remote: unknown): unknown {
  const l = (local && typeof local === "object") ? local as Record<string, { updatedAt?: number }> : {};
  const r = (remote && typeof remote === "object") ? remote as Record<string, { updatedAt?: number }> : {};
  const out: Record<string, unknown> = { ...l };
  for (const [jobId, e] of Object.entries(r)) {
    const cur = out[jobId] as { updatedAt?: number } | undefined;
    if (!cur || (e.updatedAt ?? 0) > (cur.updatedAt ?? 0)) out[jobId] = e;
  }
  return out;
}

/** System-design flashcards: union by composite key (caseId|number), keep the
    MOST-RECENTLY-REVIEWED entry. The tie-break is `reviewedAt` (stamped on every
    save by FlashcardDrawer), NOT `nextReview`: nextReview is not monotonic in
    review time — a lapse ("Again") resets interval to 1, pushing nextReview
    BACKWARD, so "larger nextReview" would keep a stale success and silently drop
    the user's most recent failed review (rescheduling the very card they're
    struggling with weeks out). Cards written before `reviewedAt` existed fall
    back to nextReview as a best-effort recency proxy. No deletion path, so a
    card studied on only one device always survives. */
function mergeFlashcards(local: unknown, remote: unknown): unknown {
  const l = (local && typeof local === "object") ? local as Record<string, { reviewedAt?: number; nextReview?: number }> : {};
  const r = (remote && typeof remote === "object") ? remote as Record<string, { reviewedAt?: number; nextReview?: number }> : {};
  const recency = (e: { reviewedAt?: number; nextReview?: number } | undefined) => e?.reviewedAt ?? e?.nextReview ?? 0;
  const out: Record<string, unknown> = { ...l };
  for (const [k, e] of Object.entries(r)) {
    const cur = out[k] as { reviewedAt?: number; nextReview?: number } | undefined;
    if (!cur || recency(e) > recency(cur)) out[k] = e;
  }
  return out;
}

/** System-design quiz history: append-only QuizHistoryEntry[]. Union by `date`
    (the run timestamp, unique per run), newest first, re-capped at 50 like the
    local writer (helpers.ts saveHistoryEntry). No entry is dropped that both
    devices didn't already cap away. */
function mergeSysDesignHistory(local: unknown, remote: unknown): unknown {
  const l = Array.isArray(local) ? local as { date: number }[] : [];
  const r = Array.isArray(remote) ? remote as { date: number }[] : [];
  const byDate = new Map<number, { date: number }>();
  for (const e of [...r, ...l]) if (e && typeof e.date === "number") byDate.set(e.date, e);
  return [...byDate.values()].sort((a, b) => b.date - a.date).slice(0, 50);
}

function mergeFor(key: string, local: unknown, remote: unknown): unknown {
  if (key === STORAGE_KEYS.sessions) return mergeSessions(local, remote);
  if (key === STORAGE_KEYS.drillSrs) return mergeSrs(local, remote);
  if (key === STORAGE_KEYS.applyTrack) return mergeTracks(local, remote);
  if (key === STORAGE_KEYS.codingTrack) return mergeCodingTrack(local, remote);
  if (key === STORAGE_KEYS.gapPlans) return mergeGapPlans(local, remote);
  if (key === STORAGE_KEYS.applyKit) return mergeApplyKit(local, remote);
  if (key === STORAGE_KEYS.sysDesignProgress) return mergeMaxNumberMap(local, remote);
  if (key === STORAGE_KEYS.sysDesignHistory) return mergeSysDesignHistory(local, remote);
  if (key === STORAGE_KEYS.sysDesignFlashcards) return mergeFlashcards(local, remote);
  return remote; /* lww default: remote wins a tie */
}

/* ---------- engine ---------- */

/**
 * Orchestrates sync. localStorage stays the source of truth; the remote is a
 * mirror. Safe to create once and reuse across sign-in/out cycles.
 */
export class SyncEngine {
  private remote: RemoteStore | null = null;
  private unsub: (() => void) | null = null;
  private dirty = new Set<string>();
  private removed = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pullTimer: ReturnType<typeof setInterval> | null = null;
  private visCleanup: (() => void) | null = null;
  /** True while applying a remote value locally — suppresses echo pushes. */
  private applyingRemote = false;

  constructor(private readonly now: () => number = Date.now) {}

  get signedIn(): boolean {
    return this.remote !== null;
  }

  /** Sign in and run the initial bidirectional sync: pull → merge → push. */
  async signIn(remote: RemoteStore): Promise<void> {
    await this.signOut();
    this.remote = remote;
    this.unsub = subscribeStorage(k => this.onLocalChange(k));

    const remoteAll = await remote.pull();
    const pushLocal: Record<string, SyncEntry> = {};
    for (const [key, policy] of Object.entries(SYNC_POLICIES)) {
      if (policy === "local") continue;
      const localVal = storageGet(key, undefined);
      const localMeta = getMeta()[key] ?? 0;
      const remoteEntry = remoteAll[key];

      if (remoteEntry === undefined) {
        if (localVal !== undefined) pushLocal[key] = { value: localVal, updatedAt: Math.max(localMeta, 1) };
        continue;
      }
      if (localVal === undefined) {
        this.applyRemote(key, remoteEntry.value, remoteEntry.updatedAt);
        continue;
      }
      if (policy === "merge") {
        const merged = mergeFor(key, localVal, remoteEntry.value);
        if (JSON.stringify(merged) !== JSON.stringify(localVal)) {
          this.applyRemote(key, merged, remoteEntry.updatedAt);
        }
        if (JSON.stringify(merged) !== JSON.stringify(remoteEntry.value)) {
          pushLocal[key] = { value: merged, updatedAt: Math.max(localMeta, remoteEntry.updatedAt, 1) };
        }
      } else if (localMeta >= remoteEntry.updatedAt) {
        /* local same-or-newer (0 = pre-sync data, treated as oldest) → push local */
        pushLocal[key] = { value: localVal, updatedAt: Math.max(localMeta, 1) };
      } else {
        this.applyRemote(key, remoteEntry.value, remoteEntry.updatedAt);
      }
    }
    if (Object.keys(pushLocal).length) await remote.push(pushLocal);
  }

  async signOut(): Promise<void> {
    await this.flush().catch(() => {});
    this.stopAutoSync();
    this.unsub?.();
    this.unsub = null;
    this.remote = null;
    this.dirty.clear();
    this.removed.clear();
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
  }

  /** Pull remote changes periodically and on tab focus. */
  startAutoSync(intervalMs = 30_000): void {
    this.stopAutoSync();
    this.pullTimer = setInterval(() => { void this.pull().catch(() => {}); }, intervalMs);
    const onVis = () => { if (document.visibilityState === "visible") void this.pull().catch(() => {}); };
    document.addEventListener("visibilitychange", onVis);
    this.visCleanup = () => document.removeEventListener("visibilitychange", onVis);
  }

  stopAutoSync(): void {
    if (this.pullTimer) { clearInterval(this.pullTimer); this.pullTimer = null; }
    this.visCleanup?.();
    this.visCleanup = null;
  }

  /** Apply remote-only changes and resolve conflicts; pushes back only what's needed. */
  async pull(): Promise<void> {
    if (!this.remote) return;
    const remoteAll = await this.remote.pull();
    const pushLocal: Record<string, SyncEntry> = {};
    for (const [key, policy] of Object.entries(SYNC_POLICIES)) {
      if (policy === "local") continue;
      const r = remoteAll[key];
      if (r === undefined) continue;
      const l = storageGet(key, undefined);
      if (l === undefined) { this.applyRemote(key, r.value, r.updatedAt); continue; }
      if (policy === "merge") {
        const merged = mergeFor(key, l, r.value);
        if (JSON.stringify(merged) !== JSON.stringify(l)) this.applyRemote(key, merged, r.updatedAt);
        if (JSON.stringify(merged) !== JSON.stringify(r.value)) {
          pushLocal[key] = { value: merged, updatedAt: this.now() };
        }
      } else if ((getMeta()[key] ?? 0) < r.updatedAt) {
        this.applyRemote(key, r.value, r.updatedAt);
      }
    }
    if (Object.keys(pushLocal).length) await this.remote.push(pushLocal);
  }

  /** Debounced push of locally changed/removed keys. */
  private async flush(): Promise<void> {
    if (!this.remote) return;
    if (this.dirty.size) {
      const entries: Record<string, SyncEntry> = {};
      for (const key of this.dirty) {
        if (policyFor(key) === "local") continue;
        const val = storageGet(key, undefined);
        if (val === undefined) continue;
        entries[key] = { value: val, updatedAt: getMeta()[key] ?? this.now() };
      }
      this.dirty.clear();
      if (Object.keys(entries).length) await this.remote.push(entries);
    }
    if (this.removed.size) {
      const keys = [...this.removed].filter(k => policyFor(k) !== "local");
      this.removed.clear();
      if (keys.length) await this.remote.remove(keys);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush().catch(() => {});
    }, 800);
  }

  private onLocalChange(key: string): void {
    if (!this.remote || this.applyingRemote) return;
    if (policyFor(key) === "local") return;
    const val = storageGet(key, undefined);
    stamp(key, this.now());
    if (val === undefined) this.removed.add(key);
    else this.dirty.add(key);
    this.scheduleFlush();
  }

  private applyRemote(key: string, value: unknown, updatedAt = 0): void {
    this.applyingRemote = true;
    try { storageSet(key, value); } finally { this.applyingRemote = false; }
    stamp(key, updatedAt);
  }
}

/* ---------- test double / demo backend ---------- */

/** In-memory RemoteStore — used in tests and as a reference implementation. */
export class InMemoryRemoteStore implements RemoteStore {
  private store = new Map<string, SyncEntry>();

  async pull(): Promise<Record<string, SyncEntry>> {
    return Object.fromEntries(this.store);
  }

  async push(entries: Record<string, SyncEntry>): Promise<void> {
    for (const [k, v] of Object.entries(entries)) this.store.set(k, v);
  }

  async remove(keys: string[]): Promise<void> {
    for (const k of keys) this.store.delete(k);
  }
}
