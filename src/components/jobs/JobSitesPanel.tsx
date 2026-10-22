/* Job sites registry panel — mounted inside the AutoApplyCard (admin/platinum
   view). Shows every registered board, approves pending discoveries, disables
   misbehaving ones, and surfaces last-run stats the engine syncs. */

import { useCallback, useEffect, useState } from "react";
import { listJobSites, setJobSiteStatus, setSiteRule, summarizeSite, sessionStateOf, probationAutoActivateAt, discoveredStamp, addJobSiteUrl, requestSiteLogin, fetchLoginStatus, getApplyConfig, listApplyResults, siteTrustState, type ApplyMode, type JobSite, type LoginLifecycle, type ApplyResultRow } from "../../services/jobSites.ts";

const STATUS_STYLES: Record<JobSite["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  disabled: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
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
  closed: { text: "✓ Window closed. If you had completed the sign-in, the session is saved.", cls: "bg-emerald-500/15 text-emerald-300" },
};

/* 👁 proof-view lifecycle (same bridge, kind 'view'): statuses the engine
   reports for the "open site logged in" window. 'closed' is SUCCESS here —
   the owner closed the window after seeing the signed-in page — while for
   a sign-in a closure without a completed login is a retry prompt. */
const VIEW_STATUS_TEXT: Record<LoginLifecycle, { text: string; cls: string }> = {
  requested: { text: "👁 Proof requested — the logged-in window opens on the desktop within ~30s (the engine must be running).", cls: "bg-zinc-800/60 text-zinc-300" },
  opened: { text: "🟢 Proof window is OPEN on your desktop NOW — that page IS the signed-in session. Close it whenever.", cls: "bg-emerald-500/10 text-emerald-300" },
  closed: { text: "✓ Proof shown — window closed. Any refresh you did there refreshed the saved session.", cls: "bg-emerald-500/15 text-emerald-300" },
  crashed: { text: "✗ The proof view crashed — see the engine report; click 👁 Open site to retry.", cls: "bg-red-500/10 text-red-300" },
  verified: { text: "✅ Session verified — click 👁 Open site to see it for yourself.", cls: "bg-emerald-500/15 text-emerald-300" },
  failed: { text: "⚠️ The proof window crashed while open — click 👁 Open site to retry.", cls: "bg-amber-500/10 text-amber-300" },
};



export default function JobSitesPanel() {
  const [sites, setSites] = useState<JobSite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [urlNote, setUrlNote] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  /* 🎖 per-host auto-submit trust latch — the SAME evidence verdict the
     engine recomputes at every run start (autoSubmitTrustVerdict over the
     host's latest apply_results rows; the lib's reasons are the tooltip).
     Newest-500 admin rows are enough to cover every active board's
     40-row window most days; a host with zero rows gets no chip at all
     ("no history yet" is different information from "not trusted"). */
  const [resultRows, setResultRows] = useState<ApplyResultRow[] | null>(null);
  useEffect(() => { listApplyResults(500).then(setResultRows).catch(() => setResultRows([])); }, []);

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

  const hostRows = new Map<string, Pick<ApplyResultRow, "result" | "detail">[]>();
  for (const r of resultRows ?? []) {
    const arr = hostRows.get(r.site_host);
    if (arr) { if (arr.length < 40) arr.push({ result: r.result, detail: r.detail }); }
    else hostRows.set(r.site_host, [{ result: r.result, detail: r.detail }]);
  }

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

  /* 👁 proof view (sites whose session_state is 'verified'): queues a 'view'
     login request — the engine opens THE SITE LOGGED IN in a headed window
     over its own saved profile. This is the only real proof of the badge:
     the probe that produced "verified" runs over freebuff-apply-profile,
     which shares no cookies with this app's browser. Polling mirrors the
     sign-in flow; the 2h window cap beats the sign-in's 30min (a proof
     window is meant to be stared at, not a short transaction). */
  const [proofStatus, setProofStatus] = useState<{ host: string; status: LoginLifecycle } | null>(null);
  const openProof = async (s: JobSite) => {
    setBusy(s.id);
    setProofStatus({ host: s.host, status: "requested" });
    try {
      await requestSiteLogin(s.host, "view");
      const deadline = Date.now() + 120 * 60_000; // proof windows open like sign-ins but live much longer — poll 2h
      for (;;) {
        await new Promise((r) => setTimeout(r, 5_000));
        if (Date.now() > deadline) { setProofStatus({ host: s.host, status: "closed" }); return; }
        const st = await fetchLoginStatus(s.host).catch(() => null);
        if (!st || st === "requested") continue; // listener hasn't picked it up yet
        setProofStatus({ host: s.host, status: st });
        if (st === "opened") continue; // window open — keep watching until the owner closes it
        return; // closed / crashed / failed = terminal
      }
    } catch (e) {
      setProofStatus(null);
      setUrlNote(`✗ 👁 ${(e as Error).message}`);
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

  /* Board-match pre-filter toggle (registry rules.boardMatch): the engine
     reads this each run — CURRENTLY the engine only parses badges on
     instahyre/naukri cards + LinkedIn detail page, so the toggle ADMITS a
     new board only if/when a parser exists for it; false turns the skip
     off for a builtin site. Fail-open legacy: absent = builtin behavior. */
  const boardMatchOf = (s: JobSite): boolean | null => {
    const v = s.rules?.boardMatch;
    return v === true ? true : v === false ? false : null;
  };
  const flipBoardMatch = async (s: JobSite) => {
    setBusy(s.id);
    try {
      const cur = boardMatchOf(s);
      /* cycle: null → true → false → null (absent restores builtin behavior) */
      const next = cur === null ? true : cur === true ? false : null;
      await setSiteRule(s.host, "boardMatch", next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  /* Per-board max posting age (registry rules.maxAgeDays): the engine drops
     older postings at collect time, before they consume the --max budget or
     an AI judge call. Cycle null → 7 → 14 → 30 → null (absent = any age).
     UNKNOWN-age rows are never dropped (fail-open, like boardMatch) — the
     tooltip says so because the feed's age filter hides them (strict) and
     the two must not be confused. */
  const AGE_CYCLE = [null, 7, 14, 30] as const;
  const boardAgeOf = (s: JobSite): number | null => {
    const v: unknown = s.rules?.maxAgeDays;
    return typeof v === "number" && Number.isFinite(v) && v >= 0 && Number.isInteger(v) ? v : null;
  };
  const flipBoardAge = async (s: JobSite) => {
    setBusy(s.id);
    try {
      const i = AGE_CYCLE.findIndex(v => v === boardAgeOf(s));
      const next = AGE_CYCLE[(i + 1) % AGE_CYCLE.length];
      await setSiteRule(s.host, "maxAgeDays", next);
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

  if (sites === null) return <div className="text-xs text-zinc-300">Loading job sites…</div>;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
          🌐 Job sites registry
          {sites && sites.length > 0 && (
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
              {sites.filter((s) => s.status === "active").length}/{sites.length} active
            </span>
          )}
          <span className="text-xs text-zinc-300">{open ? "▴" : "▾"}</span>
        </button>
        <button onClick={() => void refresh()} className="text-xs text-zinc-300 hover:text-zinc-100">↻ refresh</button>
      </div>
      {open && (<>
      <div className="mb-2 text-xs text-zinc-300">
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
      {urlNote && <div className="mb-2 text-[11px] text-zinc-300">{urlNote}</div>}
      {error && <div className="mb-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
      {!sites.length && <div className="text-xs text-zinc-300">No sites registered yet — run <code className="rounded bg-zinc-800 px-1">node scripts/auto-apply-jobs.js --discover</code>.</div>}
      <div className="space-y-2">
        {sites.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2">
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLES[s.status]}`}>{s.status}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-zinc-200">
                {s.label} <span className="text-zinc-400">· {s.host}</span>
                {(() => {
                  const ds = discoveredStamp(s);
                  if (!ds) return null;
                  return (
                    <span title={ds.long} className="ml-1 rounded bg-sky-500/10 px-1 py-0.5 text-[10px] font-semibold text-sky-300">
                      {ds.text}
                    </span>
                  );
                })()}
                {s.source === "discovered" && <span className="ml-1 text-[10px] uppercase tracking-wide text-sky-400">discovered</span>}
                {s.source === "ats" && <span className="ml-1 text-[10px] uppercase tracking-wide text-violet-400">ats board</span>}
              </div>
              <div className="flex items-center gap-1.5 truncate text-xs text-zinc-300">
                {summarizeSite(s)}
                {(() => {
                  const st = sessionStateOf(s);
                  return (
                    <>
                      <span title={st.title} className={`rounded px-1 py-0.5 text-[10px] font-bold ${st.cls}`}>
                        {st.key === "verified" ? "✓" : st.key === "expired" ? "✗" : "?"} {st.label}
                      </span>
                      {st.key === "verified" && (
                        <button type="button" onClick={() => void openProof(s)}
                          title="Open this site in the engine's browser — logged in. The verified verdict comes from the engine's own profile, which shares no cookies with this app's browser; this window shows the real signed-in page."
                          className="rounded bg-sky-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-sky-500">
                          👁 open site
                        </button>
                      )}
                    </>
                  );
                })()}
                {(() => {
                  /* 🎖 the same verdict the engine computes at its own run
                     start — note explains WHY this host is/ isn't trusted.
                     No rows = no chip: no history is not "not trusted". */
                  const rowsH = hostRows.get(s.host);
                  if (!rowsH?.length) return null;
                  const t = siteTrustState(s.host, rowsH, s.rules);
                  if (t.blocked)
                    return <span title={t.note || "platform policy: never auto-submit (ToS prohibits automation)"} className="rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-bold text-red-300">🔒 never auto-submit</span>;
                  if (t.verdict === "trust")
                    return <span title={t.note} className="rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] font-bold text-emerald-300">🏅 auto-submit earned</span>;
                  return <span title={t.note} className="rounded bg-amber-500/10 px-1 py-0.5 text-[10px] font-bold text-amber-300">🪫 review gate</span>;
                })()}
                {(() => {
                  const at = probationAutoActivateAt(s);
                  if (!at) return null;
                  const days = Math.max(0, Math.ceil((new Date(at).getTime() - Date.now()) / 86_400_000));
                  return (
                    <span title={`Pending sites auto-activate after a 7-day probation window (oldest first, max 3 per sweep). Approve early to skip the wait, or Reject to keep it out.`}
                      className="rounded bg-sky-500/10 px-1 py-0.5 text-[10px] font-semibold text-sky-300">
                      🌱 probation · auto-activates {days === 0 ? "today" : `in ${days}d`}
                    </span>
                  );
                })()}
              </div>
            </div>
            {busy === s.id ? (
              <span className="text-xs text-zinc-300">…</span>
            ) : (
              <>
                {(() => {
                  const bm = boardMatchOf(s);
                  const age = boardAgeOf(s);
                  return (
                    <>
                      <button onClick={() => void flipBoardMatch(s)}
                        title={`Board match pre-filter (rules.boardMatch): the engine skips LOW match signals before spending AI tokens. Now: ${bm === true ? "on" : bm === false ? "off" : "builtin default"}. Click to cycle on → off → default.`}
                        className={`rounded px-2 py-1 text-xs font-medium ${bm === true ? "bg-emerald-600 text-white hover:bg-emerald-500" : bm === false ? "border border-zinc-700 text-zinc-300 hover:text-zinc-100" : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>
                        🎯 {bm === true ? "match: on" : bm === false ? "match: off" : "match: default"}
                      </button>
                      <button onClick={() => void flipBoardAge(s)}
                        title={`Max job age (rules.maxAgeDays): the engine drops postings older than this at collect time — before they consume the collect budget or an AI judge. Unlike the feed's age filter, postings with an UNKNOWN age are always collected (fail-open). Now: ${age === null ? "any age" : `≤ ${age} days`}. Click to cycle any → 7d → 14d → 30d → any.`}
                        className={`rounded px-2 py-1 text-xs font-medium ${age !== null ? "bg-sky-600 text-white hover:bg-sky-500" : "border border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>
                        ⏱ {age === null ? "any age" : `≤ ${age}d`}
                      </button>
                    </>
                  );
                })()}
                <button onClick={() => void signIn(s)} title="Open the engine's sign-in window for this site — complete Google/OTP there once; the session persists for every future run"
                  className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500">🔑 Sign in</button>
            {s.status === "pending" ? (
              <>
                <button onClick={() => void flip(s, "active")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">Approve</button>
                <button onClick={() => void flip(s, "dead")} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:text-zinc-100">Reject</button>
              </>
            ) : s.status === "active" ? (
                <button onClick={() => void flip(s, "disabled")} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:text-zinc-100">Disable</button>
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
            {proofStatus?.host === s.host && (
              <div className={`w-full rounded px-2 py-1 text-[11px] ${VIEW_STATUS_TEXT[proofStatus.status].cls}`}>
                {proofStatus.status === "requested" && engineOff
                  ? "👁 Proof requested — WAITING: the engine is Off, so the window opens only after you switch Apply mode to 🖥 My machine."
                  : VIEW_STATUS_TEXT[proofStatus.status].text}
              </div>
            )}
          </div>
        ))}
      </div>
      </>)}
    </div>
  );
}
