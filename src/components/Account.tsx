/* User dashboard — the account home for user-specific tasks: profile, plan,
   usage, cloud sync status, sign-out, and local data management. */

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../store";
import { getProfileStats } from "../services/events";
import { streaks } from "../services/progress";
import { getCodingTrack } from "../services/codingTrack";
import { coachWeekStats, getCoachDiscussions } from "./CoachChat";
import { getTier, getUsage, isPaywallEnabled } from "../services/entitlements";
import { cloudDeleteMyAccount, cloudDownloadMyData, cloudSignOut, cloudSyncNow, getCloudState, isCloudConfigured, subscribeCloud } from "../services/cloud";
import { clearServerEntitlement } from "../services/entitlement";
import { STORAGE_KEYS } from "../services/storage";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip } from "./ui";

export function Account() {
  const { state, nav, resetAll } = useApp();
  const [cloud, setCloud] = useState(getCloudState());
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const sessions = state.sessions;
  const st = useMemo(() => streaks(sessions), [sessions]);
  const stats = useMemo(getProfileStats, []);
  const track = useMemo(getCodingTrack, []);
  const usage = useMemo(getUsage, []);
  const tier = getTier();
  const proGated = isPaywallEnabled() && tier !== "pro";
  const codeSolved = Object.values(track).filter(e => e.solved).length;
  const questions = sessions.reduce((n, s) => n + s.answers.length, 0);
  /* coach usage — discussions per week, week streak, topics debated */
  const coach = useMemo(getCoachDiscussions, []);
  const coachStats = useMemo(() => coachWeekStats(coach), [coach]);

  useEffect(() => subscribeCloud(setCloud), []);

  const signOut = async () => {
    await cloudSignOut();
    clearServerEntitlement();
    toast("Signed out — your local data stays on this device");
  };

  const exportData = async () => {
    const data: Record<string, unknown> = {};
    for (const k of Object.values(STORAGE_KEYS)) {
      const raw = localStorage.getItem(k);
      if (raw !== null) data[k] = JSON.parse(raw);
    }
    /* when signed in, also pull the server-side copy (profile, resume list,
       entitlements, payments…) so the export is the user's FULL data */
    if (email) {
      const r = await cloudDownloadMyData();
      if (r.ok) data["cloud"] = r.data;
      else toast("⚠️ Cloud copy unavailable — exporting local data only (" + (r.error ?? "") + ")");
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interviewiq-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("📦 Export downloaded");
  };

  const wipe = () => {
    resetAll();
    toast("🗑️ Local data cleared");
    nav("landing");
  };

  const deleteAccount = async () => {
    setDelBusy(true);
    try {
      const r = await cloudDeleteMyAccount();
      if (!r.ok) { toast("✗ " + (r.error ?? "Couldn't delete the account")); return; }
      resetAll();
      setConfirmDelete(false);
      toast("🗑️ Account deleted — your cloud data is gone");
      nav("landing");
    } finally { setDelBusy(false); }
  };

  const email = cloud.user?.email ?? null;
  const provider = cloud.user?.app_metadata?.provider as string | undefined;
  const avatarLetter = (email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="anim-view mx-auto max-w-[860px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">👤 Account</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Your <span className="grad-text">space</span>.</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">
          Profile, plan, progress and your data — everything that belongs to you in one place.
        </p>
      </div>

      {/* profile card */}
      <section className={`${cardCls} mt-6 p-6`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-16 w-16 flex-none place-items-center rounded-2xl grad-bg text-[26px] font-extrabold text-white">
            {email ? avatarLetter : "🎙️"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-extrabold">{email ?? "Local user"}</h2>
              {email && <Chip tone="ok">SIGNED IN</Chip>}
              {!email && !isCloudConfigured() && <Chip>LOCAL ONLY</Chip>}
              {!email && isCloudConfigured() && <Chip>LOCAL — CLOUD OFF</Chip>}
            </div>
            <p className="mt-0.5 text-[13px] text-mut">
              {email
                ? provider && provider !== "email"
                  ? `Signed in with ${provider} · your progress syncs to the cloud`
                  : "Signed in · your progress syncs to the cloud"
                : "You're using InterviewIQ fully offline — nothing leaves this device unless you sign in."}
            </p>
          </div>
          {email && (
            <div className="flex flex-wrap gap-2">
              <button className={btnGhost + btnSm} onClick={async () => { await cloudSyncNow(); toast("☁️ Synced"); }} disabled={cloud.syncing}>
                {cloud.syncing ? <><span className="spinner" />Syncing…</> : "🔄 Sync now"}
              </button>
              <button className={btnDanger + btnSm} onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
        {!email && isCloudConfigured() && (
          <div className="mt-4 rounded-xl border border-acc1/30 bg-acc1/10 px-4 py-3 text-[13px] text-ink">
            Sign in to back up your sessions, streaks and drill progress across devices — or keep everything local.{" "}
            <button className="font-bold text-acctxt underline" onClick={() => nav("settings")}>Cloud settings →</button>
          </div>
        )}
      </section>

      {/* plan card */}
      <section className={`${cardCls} mt-4 p-6`}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[16px] font-extrabold">💎 Plan</h2>
          {tier === "pro" ? <Chip tone="ok">PRO</Chip> : <Chip>FREE</Chip>}
          {!proGated && <Chip tone="acc">UNLIMITED</Chip>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Sessions this month" value={String(usage.sessions)} />
          <Stat label="AI calls today" value={String(usage.aiToday)} />
          <Stat label="Questions answered" value={String(questions)} />
        </div>
        {proGated ? (
          <button className={`${btnPrimary} mt-5 w-full py-3 text-[15px]`} onClick={() => nav("settings")}>
            ✨ Upgrade to Pro — unlock hints, solutions, UI challenges & more
          </button>
        ) : (
          <p className="mt-3 text-[12.5px] text-mut">
            You have full access. Pro features (hints, reference solutions, UI component bank) are unlocked.
          </p>
        )}
      </section>

      {/* progress card */}
      <section className={`${cardCls} mt-4 p-6`}>
        <h2 className="mb-3 text-[16px] font-extrabold">📈 Progress</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Completed sessions" value={String(sessions.length)} />
          <Stat label="Current streak" value={`${st.current} 🔥`} sub={`longest ${st.longest}`} />
          <Stat label="Code problems solved" value={String(codeSolved)} />
          <Stat label="AI feedback calls" value={String(stats.aiCalls)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnGhost + btnSm} onClick={() => nav("progress")}>Full progress dashboard →</button>
          <button className={btnGhost + btnSm} onClick={() => nav("history")}>Session history →</button>
        </div>
      </section>

      {/* coach usage card */}
      <section className={`${cardCls} mt-4 p-6`}>
        <h2 className="mb-3 text-[16px] font-extrabold">🤖 AI Coach usage</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Discussions saved" value={String(coach.length)} />
          <Stat label="This week" value={String(coachStats.thisWeek)} />
          <Stat label="Coach streak" value={`${coachStats.cur} 🔥`} sub={`longest ${coachStats.longest}`} />
          <Stat label="Topics debated" value={String(coachStats.topics)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnGhost + btnSm} onClick={() => nav("history")}>Read past discussions →</button>
        </div>
      </section>

      {/* data card */}
      <section className={`${cardCls} mt-4 p-6`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🗂️ Your data</h2>
        <p className="mb-4 text-[12.5px] text-mut">
          Everything lives in your browser (IndexedDB/localStorage) and mirrors to the cloud when you're signed in.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost + btnSm} onClick={exportData}>📦 Export as JSON</button>
          {confirmWipe ? (
            <>
              <button className={btnDanger + btnSm} onClick={wipe}>Confirm — erase everything on this device</button>
              <button className={btnGhost + btnSm} onClick={() => setConfirmWipe(false)}>Cancel</button>
            </>
          ) : (
            <button className={btnGhost + btnSm} onClick={() => setConfirmWipe(true)}>🗑️ Clear local data…</button>
          )}
        </div>
        {confirmWipe && (
          <p className="mt-2 text-[12px] text-bad">
            This erases all sessions, progress and settings from this device. If you're signed in, your cloud copy survives — you can restore it by signing in again.
          </p>
        )}
      </section>

      {/* danger zone — account deletion (signed-in only) */}
      {email && (
        <section className={`${cardCls} mt-4 border-bad/30 p-6`}>
          <h2 className="mb-1 text-[16px] font-extrabold text-bad">⚠️ Danger zone</h2>
          <p className="mb-4 text-[12.5px] text-mut">
            Permanently delete your cloud account and all synced data. Payment history is kept (anonymised) for accounting; your local device copy survives unless you also clear it.
          </p>
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <button className={btnDanger + btnSm} onClick={deleteAccount} disabled={delBusy}>
                {delBusy ? <><span className="spinner" />Deleting…</> : "Yes — delete my account permanently"}
              </button>
              <button className={btnGhost + btnSm} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          ) : (
            <button className={btnDanger + btnSm} onClick={() => setConfirmDelete(true)}>🗑️ Delete account…</button>
          )}
        </section>
      )}

      <div className="pb-4 pt-6 text-center text-[12px] text-fnt">
        InterviewIQ — practice offline, sync when you want, own your data.
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line/10 bg-wht/5 px-3.5 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-fnt">{label}</div>
      <div className="mt-0.5 text-[19px] font-extrabold text-ink">{value}</div>
      {sub && <div className="text-[11px] text-mut">{sub}</div>}
    </div>
  );
}
