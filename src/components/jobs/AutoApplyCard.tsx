/* Auto-apply access card — bridges entitled users to the LOCAL auto-apply
   engine (scripts/auto-apply-jobs.js). Personal profile export and static
   commands contain no global data; the legacy control center remains admin-
   only until every service behind it is scoped to the signed-in user. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { cardCls, btnGhost, btnOk, btnPrimary, btnSm, Chip } from "../ui";
import { APPLY_SITES, engineCommands, exportProfileJson } from "../../services/autoApply";
import { requestRunNow, fetchRunStatus, getApplyConfig, type ApplyMode, type RunLifecycle } from "../../services/jobSites";
import JobSitesPanel from "./JobSitesPanel";
import CredentialsPanel from "./CredentialsPanel";
import ApplyModePanel from "./ApplyModePanel";
import ApplyResultsPanel from "./ApplyResultsPanel";
import AppliedByUserPanel from "./AppliedByUserPanel";
import ReviewQueuePanel from "./ReviewQueuePanel";
import TelegramBindingPanel from "./TelegramBindingPanel";
import ExemplarsPanel from "./ExemplarsPanel";
import ResumeVariantsPanel from "./ResumeVariantsPanel";
import ApplyAgentPanel from "./ApplyAgentPanel";
import { personalApplyReady } from "../../services/applyAgent";
import { getCloudState, subscribeCloud } from "../../services/cloud";

export function AutoApplyCard({ locked, isAdmin, onUpgrade }: {
  locked: boolean;
  isAdmin: boolean;
  onUpgrade: () => void;
}) {
  const [openSite, setOpenSite] = useState<string | null>(null);
  const active = isAdmin || !locked;
  const [userId, setUserId] = useState(() => getCloudState().user?.id ?? null);
  const [coreReady, setCoreReady] = useState(false);
  const [coreError, setCoreError] = useState<string | null>(null);
  useEffect(() => subscribeCloud(s => setUserId(s.user?.id ?? null)), []);
  useEffect(() => {
    let live = true;
    setCoreReady(false); setCoreError(null);
    if (!active || !userId) return () => { live = false; };
    void personalApplyReady().then(() => { if (live) setCoreReady(true); })
      .catch(e => { if (live) setCoreError((e as Error).message); });
    return () => { live = false; };
  }, [active, userId]);

  /* ⚡ Run now: queue a full cycle on the desktop engine and poll the
     lifecycle (queued → running → done-with-summary / failed) so the owner
     sees progress instead of a dead button. */
  const [runState, setRunState] = useState<{ status: RunLifecycle; detail: string | null } | null>(null);
  const runNow = useCallback(async () => {
    setRunState({ status: "requested", detail: null });
    try {
      await requestRunNow();
      const deadline = Date.now() + 40 * 60_000; // a full cycle can take many minutes
      for (;;) {
        await new Promise((r) => setTimeout(r, 10_000));
        if (Date.now() > deadline) { setRunState({ status: "done", detail: "poll timed out — check the Applications report" }); return; }
        const { status, detail } = await fetchRunStatus().catch(() => ({ status: null, detail: null }));
        if (!status || status === "requested") continue; // listener hasn't picked it up yet
        setRunState({ status, detail });
        if (status === "running") continue; // keep watching until done/failed
        return;
      }
    } catch (e) {
      setRunState({ status: "failed", detail: (e as Error).message });
    }
  }, []);
  useEffect(() => { if (runState?.status === "done" || runState?.status === "failed") { const t = setTimeout(() => setRunState(null), 60_000); return () => clearTimeout(t); } }, [runState?.status]);

  /* apply mode mirrors the engine's kill switch: while Off, every engine
     process on the owner's machine is killed — a Run-now click would queue
     into the void (the listener only comes back with the switch), so the
     button is disabled with an honest hint instead. */
  const [applyMode, setApplyMode] = useState<ApplyMode | null>(null);
  useEffect(() => {
    if (!isAdmin) {
      setApplyMode(null);
      return;
    }
    let dead = false;
    const load = () => { getApplyConfig().then((c) => { if (!dead) setApplyMode(c?.mode ?? null); }).catch(() => {}); };
    load();
    const t = setInterval(load, 60_000);
    return () => { dead = true; clearInterval(t); };
  }, [isAdmin]);
  const profileJson = useMemo(() => (active ? exportProfileJson() : ""), [active, userId]);
  const missing = useMemo(() => {
    if (!active) return [];
    try {
      const p = JSON.parse(profileJson) as { name?: string; email?: string; phone?: string };
      return (["name", "email", "phone"] as const).filter(k => !p[k]);
    } catch { return ["name", "email", "phone"]; }
  }, [profileJson]);

  const download = () => {
    const blob = new Blob([profileJson], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "apply-profile.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard denied — user can select manually */ }
  };

  return (
    <div className={`${cardCls} mt-5 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/10 p-5">
        <div>
          <h3 className="text-[14.5px] font-extrabold">🤖 Auto-apply engine {active ? "" : "· Platinum or add-on"}</h3>
          <p className="mt-0.5 max-w-[720px] text-[11.5px] text-fnt">
            A local browser fills applications using your profile facts. This first paired-agent release uses deterministic
            resume templates; AI tailoring and automated discovery are not enabled for customer agents yet.
            Unknown forms and unanswered required questions stay in your review queue.
          </p>
        </div>
        <Chip tone={active ? "ok" : "co"}>{active ? "Auto-apply active" : "🔒 Platinum or add-on"}</Chip>
      </div>

      {!active ? (
        <div className="p-5">
          <ul className="mb-4 space-y-1 text-[12.5px] text-fnt">
            <li>• Persists your job-board logins (Google OAuth / OTP — you sign in once, it never stores passwords)</li>
            <li>• Resume templates from your profile facts; AI tailoring is not enabled in this paired-agent release</li>
            <li>• Honest answers only — required questions it can't answer confidently stop the submission for your review</li>
            <li>• Run reports: submitted / needs-review / skipped, per job</li>
          </ul>
          {userId && <ApplyAgentPanel key={`agent:${userId}`} canPair={false} />}
          {userId && <TelegramBindingPanel key={`telegram:${userId}`} />}
          <button className={btnPrimary + btnSm} onClick={onUpgrade}>Unlock with Platinum or add-on</button>
        </div>
      ) : (
        <div className="p-5">
          {missing.length > 0 && (
            <p className="mb-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[12px] text-ink">
              ⚠️ Your profile is missing <b>{missing.join(", ")}</b> — the engine fail-closes on required fields, so fill
              them in your career profile / resume first.
            </p>
          )}
          {isAdmin && applyMode === "off" && (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
              🛑 Engine is <b>Off</b> — every engine process on your machine is stopped. Switch Apply mode to
              <b> 🖥 My machine</b> below to start it (the listener returns within ~1 minute).
            </p>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button className={btnPrimary + btnSm} disabled={runState?.status === "requested" || runState?.status === "running" || applyMode === "off"} onClick={() => void runNow()}>
                {runState?.status === "requested" ? "⏳ queued…" : runState?.status === "running" ? "⚙️ running — cycling active sites…" : "⚡ Run now"}
              </button>
            )}
            <button className={btnOk + btnSm} onClick={download}>⬇️ Download apply-profile.json</button>
            <button className={btnGhost + btnSm} onClick={() => void copy(profileJson)}>📋 Copy JSON</button>
            <span className="text-[11px] text-mut">save it to the repo root (next to package.json)</span>
          </div>
          {isAdmin && runState && (
            <p className={`mb-3 rounded-lg px-3 py-2 text-[12px] ${runState.status === "failed" ? "border border-red-500/30 bg-red-500/10 text-red-300" : "border border-ok/30 bg-ok/10 text-ink"}`}>
              {runState.status === "requested" && "⏳ Run queued — the desktop engine picks it up within ~30s, then cycles every ACTIVE site."}
              {runState.status === "running" && "⚙️ Engine is running a full cycle now — this updates when it finishes."}
              {runState.status === "done" && (runState.detail ?? "Run finished — see the Applications report below.")}
              {runState.status === "failed" && (runState.detail ?? "Run failed — check the engine logs.")}
            </p>
          )}

          <div className="space-y-2">
            {APPLY_SITES.map(s => (
              <div key={s.id} className="rounded-xl border border-line/10 bg-deep/40">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  onClick={() => setOpenSite(openSite === s.id ? null : s.id)}
                >
                  <span className="text-[13px] font-bold text-fnt">
                    {s.label} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${s.submit === "auto" ? "bg-ok/15 text-ok" : "bg-warn/15 text-ink"}`}>{s.submit === "auto" ? "AUTO-SUBMIT" : "REVIEW GATE"}</span>
                  </span>
                  <span className="text-mut">{openSite === s.id ? "▴" : "▾"}</span>
                </button>
                {openSite === s.id && (
                  <div className="space-y-2 px-4 pb-4">
                    {engineCommands(s.id).map(c => (
                      <div key={c.command} className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line/10 bg-deep/80 px-3 py-2 font-mono text-[11.5px] text-fnt">{c.command}</code>
                        <button className={btnGhost + btnSm} title={c.label} onClick={() => void copy(c.command)}>📋</button>
                      </div>
                    ))}
                    <p className="text-[11px] text-mut">
                      Requires one-time setup on your machine: <code className="font-mono">npm i -D playwright &amp;&amp; npx playwright install chromium</code>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-mut">
            Paired browser sessions and reports stay in your OS user-data directory, partitioned by binding.
            The project service key is never part of customer setup.
          </p>

          {userId && <ApplyAgentPanel key={`agent:${userId}`} canPair={active} />}
          {coreError && <p role="alert" className="mt-3 text-[12px] text-amber-400">{coreError}</p>}
          {coreReady && userId && (
            <div key={`core:${userId}`}>
              <ApplyResultsPanel />
              <AppliedByUserPanel />
              <ResumeVariantsPanel />
              <ReviewQueuePanel />
              <ExemplarsPanel />
            </div>
          )}
          {isAdmin ? (
            <section className="mt-4 border-t border-line/10 pt-3" aria-label="Legacy administrator controls">
              <h4 className="text-[12px] font-bold text-mut">Legacy owner engine — administrator controls</h4>
              <ApplyModePanel />
              <JobSitesPanel />
              <CredentialsPanel />
            </section>
          ) : (
            <p className="mt-3 text-[12px] text-mut">Run the paired agent locally. Platform-wide registry, credentials, and remote start/stop controls are administrator-only.</p>
          )}

          {isAdmin && <div className="mt-3 rounded-lg border border-line/10 bg-deep/40 p-3">
            <div className="text-[12.5px] font-bold text-fnt">♻️ Legacy owner watch mode</div>
            <p className="mt-1 text-[11px] text-mut">
              One command runs forever on your machine: discovers new candidate boards every cycle, applies across every
              <b> active</b> registered site, and never re-applies the same job. Review-gate forms it can't auto-submit stay
              pending for review. Leave it in an open terminal:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line/10 bg-deep/80 px-3 py-2 font-mono text-[11.5px] text-fnt">node scripts/auto-apply-jobs.js --legacy-owner --watch --max 5 --every 6 --unattended</code>
              <button className={btnGhost + btnSm} onClick={() => void copy("node scripts/auto-apply-jobs.js --legacy-owner --watch --max 5 --every 6 --unattended")}>📋</button>
            </div>
          </div>}
        </div>
      )}
    </div>
  );
}
