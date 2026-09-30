/* Job sites registry panel — mounted inside the AutoApplyCard (admin/platinum
   view). Shows every registered board, approves pending discoveries, disables
   misbehaving ones, and surfaces last-run stats the engine syncs. */

import { useCallback, useEffect, useState } from "react";
import { listJobSites, setJobSiteStatus, summarizeSite, addJobSiteUrl, requestSiteLogin, type JobSite } from "../../services/jobSites.ts";

const STATUS_STYLES: Record<JobSite["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  disabled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  dead: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function JobSitesPanel() {
  const [sites, setSites] = useState<JobSite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlNote, setUrlNote] = useState<string | null>(null);

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

  /* 🔑 app-triggered sign-in: the desktop listener opens the engine's own
     window for this host within ~30s — the owner completes Google/OTP there
     (typed automation is blocked by Google; the session then persists) */
  const signIn = async (s: JobSite) => {
    setBusy(s.id);
    try {
      const res = await requestSiteLogin(s.host);
      setUrlNote(`🔑 ${res} — the engine's sign-in window opens on your desktop within ~30s; complete Google/OTP there.`);
    } catch (e) {
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
        <div className="text-sm font-semibold text-zinc-200">🌐 Job sites registry</div>
        <button onClick={() => void refresh()} className="text-xs text-zinc-400 hover:text-zinc-200">↻ refresh</button>
      </div>
      <div className="mb-2 text-xs text-zinc-500">
        The discovery engine registers promising boards as <b>pending</b>; approve them to add the board to
        <code className="mx-1 rounded bg-zinc-800 px-1">--all</code> runs. Only active sites are auto-applied.
      </div>
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
              <div className="truncate text-xs text-zinc-500">{summarizeSite(s)}{s.session_ok ? " · session ✓" : ""}</div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
