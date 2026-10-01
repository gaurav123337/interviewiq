/* Job sites registry panel — mounted inside the AutoApplyCard (admin/platinum
   view). Shows every registered board, approves pending discoveries, disables
   misbehaving ones, and surfaces last-run stats the engine syncs. */

import { useCallback, useEffect, useState } from "react";
import { listJobSites, setJobSiteStatus, summarizeSite, sessionStateOf, addJobSiteUrl, requestSiteLogin, fetchLoginStatus, getApplyConfig, type ApplyMode, type JobSite, type LoginLifecycle } from "../../services/jobSites.ts";

const STATUS_STYLES: Record<JobSite["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  disabled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  dead: "bg-red-500/15 text-red-400 border-red-500/30",
};

/* the engine reports each sign-in transition; these are the owner-facing
   lines shown under the clicked row while the flow runs / resolves */
const SIGNIN_STATUS_TEXT: Record<LoginLifecycle, { text: string; cls: string }> = {
  requested: { text: "🔑 Sign-in requested — the engine's window opens on the desktop within ~30s; complete Google/OTP there.", cls: "bg-zinc-800/60 text-zinc-300" },
  opened: { text: "🟢 Sign-in window is OPEN on your desktop NOW — complete Google/OTP in it. This line updates when it closes.", cls: "bg-emerald-500/10 text-emerald-300" },
  crashed: { text: "✗ The sign-in run crashed — see the engine report; click 🔑 Sign in to try again.", cls: "bg-red-500/10 text-red-300" },
  verified: { text: "✅ Session verified — this site's future runs are signed-in.", cls: "bg-emerald-500/15 text-emerald-300" },
  failed: { text: "⚠️ The sign-in window closed without a completed sign-in — click 🔑 Sign in to retry.", cls: "bg-amber-500/10 text-amber-300" },
};

export default function JobSitesPanel() {
  const [sites, setSites] = useState<JobSite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlNote, setUrlNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setSites(await listJobSites());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSites([]);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /* apply mode mirrors the kill switch: while Off, a 🔑 request still queues
     (it is fulfilled the moment the engine returns) — but the UI must say
     "waiting", not "opens within ~30s", or the owner thinks it is broken. */
  const [applyMode, setApplyMode] = useState<ApplyMode | null>(null);
  useEffect(() => {
    let dead = false;
    const load = () => { getApplyConfig().then((c) => { if (!dead) setApplyMode(c?.mode ?? null); }).catch(() => {}); };
    load();
    const t = setInterval(load, 60_000);
    return () => { dead = true; clearInterval(t); };
  }, []);
  const engineOff = applyMode === "off";

  /* 🔑 app-triggered sign-in: the desktop listener opens the engine's own
     window for this host within ~30s — the owner completes Google/OTP there
     (typed automation is blocked by Google; the session then persists).
     After the click, poll the engine-reported lifecycle so the row shows
     window-open / crashed / verified / failed instead of going dark. */
  const [signinStatus, setSigninStatus] = useState<{ host: string; status: LoginLifecycle } | null>(null);
  const signIn = async (s: JobSite) => {
    setBusy(s.id);
    setSigninStatus({ host: s.host, status: "requested" });
    try {
      await requestSiteLogin(s.host);
      const deadline = Date.now() + 30 * 60_000; // a sign-in can take a while — poll 30 min
      for (;;) {
        await new Promise((r) => setTimeout(r, 5_000));
        if (Date.now() > deadline) { setSigninStatus({ host: s.host, status: "failed" }); return; }
        const st = await fetchLoginStatus(s.host).catch(() => null);
        if (!st || st === "requested") continue; // listener hasn't picked it up yet
        setSigninStatus({ host: s.host, status: st });
        if (st === "opened") { void refresh(); continue; } // window open — keep watching for the outcome
        return; // crashed / verified / failed = terminal
      }
    } catch (e) {
      setSigninStatus(null);
      setUrlNote(`✗ ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const flip = async (s: JobSite, status: JobSite["status"]) => {
    setBusy(s.id);
    try {
      await setJobSiteStatus(s.id, status);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const addUrl = async () => {
    if (!/^https?:\/\//.test(url.trim())) { setUrlNote("Paste a full URL starting with https://"); return; }
    setBusy("url");
    try {
      const res = await addJobSiteUrl(url.trim());
      setUrlNote(`✓ ${res}`);
      setUrl("");
      await refresh();
    } catch (e) { setUrlNote((e as Error).message); }
    finally { setBusy(null); }
  };

  if (sites === null) return <div className="text-xs text-zinc-500">Loading job sites…</div>;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
          🌐 Job sites registry
          {sites && sites.length > 0 && (
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">
              {sites.filter((s) => s.status === "active").length}/{sites.length} active
            </span>
          )}
          <span className="text-xs text-zinc-500">{open ? "▴" : "▾"}</span>
        </button>
        <button onClick={() => void refresh()} className="text-xs text-zinc-400 hover:text-zinc-200">↻ refresh</button>
      </div>
      {open && (<>
      <div className="mb-2 text-xs text-zinc-500">
        The discovery engine registers promising boards as <b>pending</b>; approve them to add the board to
        <code className="mx-1 rounded bg-zinc-800 px-1">--all</code> runs. Only active sites are auto-applied.
      </div>
      {engineOff && (
        <div className="mb-2 rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
          🛑 Engine is Off — sign-in windows can't open right now. A request you make here waits and is picked up
          automatically when you switch Apply mode to <b>🖥 My machine</b>.
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="+ add a job-board URL (https://…/jobs)"
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500" />
        <button onClick={() => void addUrl()} disabled={busy === "url"} className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50">Add</button>
      </div>
      {urlNote && <div className="mb-2 text-[11px] text-zinc-400">{urlNote}</div>}
      {error && <div className="mb-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
      {!sites.length && <div className="text-xs text-zinc-500">No sites registered yet — run <code className="rounded bg-zinc-800 px-1">node scripts/auto-apply-jobs.js --discover</code>.</div>}
      <div className="space-y-2">
        {sites.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[s.status]}`}>{s.status}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-zinc-200">
                {s.label} <span className="text-zinc-500">· {s.host}</span>
                {s.source === "discovered" && <span className="ml-1 text-[10px] uppercase tracking-wide text-sky-400">discovered</span>}
              </div>
              <div className="flex items-center gap-1.5 truncate text-xs text-zinc-500">
                {summarizeSite(s)}
                {(() => {
                  const st = sessionStateOf(s);
                  return (
                    <span title={st.title} className={`rounded px-1 py-0.5 text-[10px] font-bold ${st.cls}`}>
                      {st.key === "verified" ? "✓" : st.key === "expired" ? "✗" : "?"} {st.label}
                    </span>
                  );
                })()}
              </div>
            </div>
            {busy === s.id ? (
              <span className="text-xs text-zinc-500">…</span>
            ) : (
              <>
                <button onClick={() => void signIn(s)} title="Open the engine's sign-in window for this site — complete Google/OTP there once; the session persists for every future run"
                  className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500">🔑 Sign in</button>
            {s.status === "pending" ? (
              <>
                <button onClick={() => void flip(s, "active")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">Approve</button>
                <button onClick={() => void flip(s, "dead")} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200">Reject</button>
              </>
            ) : s.status === "active" ? (
                <button onClick={() => void flip(s, "disabled")} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200">Disable</button>
              ) : s.status === "disabled" ? (
                <button onClick={() => void flip(s, "active")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">Re-enable</button>
              ) : null}
              </>
            )}
            {signinStatus?.host === s.host && (
              <div className={`w-full rounded px-2 py-1 text-[11px] ${SIGNIN_STATUS_TEXT[signinStatus.status].cls}`}>
                {signinStatus.status === "requested" && engineOff
                  ? "🔑 Sign-in requested — WAITING: the engine is Off, so the window opens only after you switch Apply mode to 🖥 My machine."
                  : SIGNIN_STATUS_TEXT[signinStatus.status].text}
              </div>
            )}
          </div>
        ))}
      </div>
      </>)}
    </div>
  );
}
