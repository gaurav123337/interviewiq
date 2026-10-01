/* Apply-mode control — the owner's ON/OFF switch for the auto-apply engine,
   plus the machine choice. `off` is a PROCESS kill switch: the supervisors
   check it before every respawn and the minute watchdog kills any survivor
   (watcher, listener, run children, engine/relay browsers) within ~1 minute,
   so the machine is actually free while off. `local` = the Playwright engine
   on this machine; `cloud` = a persistent browser over CDP (see
   docs/cloud-browser-research.md).

   The panel also shows LIVE engine state: the local listener beats the DB
   every ~2 min and reports "stopped" when Off kills it — a stale beat reads
   as stopped, so a crashed engine can never look alive. 🛑 Stop engine does
   the same as Off plus an on-screen confirmation that processes really died. */

import { useEffect, useState } from "react";
import {
  getApplyConfig, setApplyConfig, fetchEngineState, engineIsRunning,
  isValidCdpEndpoint, type ApplyConfig, type ApplyMode, type EngineState,
} from "../../services/jobSites.ts";

const MODES: { id: ApplyMode; label: string; blurb: string }[] = [
  { id: "off", label: "⏸ Off", blurb: "Kill switch — stops the engine dead: the watcher, listener and any engine browser on this PC are killed within ~1 minute, and the schedulers won't respawn them until you switch back on." },
  { id: "local", label: "🖥 My machine", blurb: "Run the local Playwright engine here (watcher + watchdog as set up on this PC)." },
  { id: "cloud", label: "☁️ Cloud session", blurb: "Run against a persistent browser over CDP — your home relay (http://127.0.0.1:9222, docs/apply-relay.md) or a vendor (wss://…)." },
];

export default function ApplyModePanel() {
  const [cfg, setCfg] = useState<ApplyConfig | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [eng, setEng] = useState<EngineState | null>(null);
  const [stopMsg, setStopMsg] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  const refresh = async () => {
    try {
      setError(null);
      const c = await getApplyConfig();
      setCfg(c);
      setEndpoint(c?.cloud_endpoint ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const refreshEngine = async () => {
    try { setEng(await fetchEngineState()); } catch { /* badge is best-effort */ }
  };

  useEffect(() => { void refresh(); void refreshEngine(); }, []);
  useEffect(() => {
    const t = setInterval(() => void refreshEngine(), 30_000);
    return () => clearInterval(t);
  }, []);

  const apply = async (mode: ApplyMode) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    setStopMsg(null);
    try {
      await setApplyConfig(mode, mode === "cloud" ? "browserbase" : undefined, mode === "cloud" ? endpoint.trim() : undefined);
      await refresh();
      setSaved(mode === "off"
        ? "✓ Engine OFF — the engine processes on your machine are killed (≤1 min) and won't respawn until you switch back on."
        : `✓ Mode set to ${mode}. The engine picks it up within ~1 minute.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /* 🛑 Stop engine = Off + on-screen proof: poll the heartbeat until the
     listener itself reports "stopped" (its loop checks the switch within
     ~30s), so the owner SEES the kill confirmed instead of trusting it. */
  const stopEngine = async () => {
    setStopping(true);
    setError(null);
    setSaved(null);
    setStopMsg("🛑 Stop requested — killing the engine processes on your machine…");
    try {
      await setApplyConfig("off");
      await refresh();
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 8000));
        const s = await fetchEngineState().catch(() => null);
        if (s) setEng(s);
        if (s?.state === "stopped") {
          setStopMsg("✓ Engine stopped — every engine process on your machine was killed, and nothing respawns until you pick a mode again.");
          setStopping(false);
          return;
        }
      }
      setStopMsg("⏳ The engine went silent — all processes should be dead; the badge confirms within a minute.");
    } catch (e) {
      setStopMsg(`✗ Could not stop the engine: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setStopping(false);
    }
  };

  const mode = cfg?.mode ?? null;
  const running = engineIsRunning(eng);
  const beatAge = eng?.beat_at ? Math.max(0, Math.round((Date.now() - new Date(eng.beat_at).getTime()) / 1000)) : null;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-200">
          🎛 Apply mode {mode && (
            <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
              mode === "off" ? "bg-red-500/15 text-red-400" : mode === "local" ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"
            }`}>{mode.toUpperCase()}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {mode && mode !== "off" && (
            <button onClick={() => void stopEngine()} disabled={stopping}
              className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50">
              {stopping ? "stopping…" : "🛑 Stop engine"}
            </button>
          )}
          <button onClick={() => { void refresh(); void refreshEngine(); }} className="text-xs text-zinc-400 hover:text-zinc-200">↻ refresh</button>
        </div>
      </div>

      {eng && (
        <div className={`mt-2 rounded px-2 py-1 text-[11.5px] ${running ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {running
            ? <>🟢 Engine running on your machine — {eng.detail ?? "listener up"}{beatAge != null ? <> (last beat {beatAge < 60 ? `${beatAge}s` : `${Math.round(beatAge / 60)}m`} ago)</> : null}</>
            : <>🔴 Engine stopped — no engine processes are running on your machine{eng.detail ? ` · ${eng.detail}` : ""}</>}
        </div>
      )}

      <p className="mt-1 text-xs text-zinc-500">
        One switch controls the whole rig. <b>Off</b> kills the engine on this machine now — watcher, listener and engine
        browsers stop within a minute and stay stopped (the schedulers check this switch before every respawn).
        <b> My machine</b> runs the local Playwright engine here; <b>Cloud session</b> runs against a persistent browser over CDP.
      </p>

      {error && <div className="mt-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
      {saved && <div className="mt-2 rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">{saved}</div>}
      {stopMsg && <div className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{stopMsg}</div>}

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            disabled={busy || stopping || mode === null}
            onClick={() => void apply(m.id)}
            title={m.blurb}
            className={`rounded-md border px-2.5 py-2 text-left text-xs transition ${
              mode === m.id
                ? m.id === "off" ? "border-red-500/60 bg-red-500/10 text-red-300" : m.id === "local" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-sky-500/60 bg-sky-500/10 text-sky-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
            } ${busy || stopping ? "opacity-50" : ""}`}
          >
            <span className="font-bold">{m.label}</span>
            <span className="mt-0.5 block text-[10.5px] leading-4 text-zinc-500">{m.blurb}</span>
          </button>
        ))}
      </div>

      {mode === "cloud" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="CDP endpoint — home relay http://127.0.0.1:9222 · tailnet http://100.x.y.z:9222 · vendor wss://…"
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-500"
          />
          <button disabled={busy || !isValidCdpEndpoint(endpoint)} onClick={() => void apply("cloud")}
            className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-40">Save endpoint</button>
          {endpoint && !isValidCdpEndpoint(endpoint) && <div className="w-full text-[10.5px] text-amber-500">needs to start with wss://, ws:// or http(s)://</div>}
        </div>
      )}

      {cfg?.updated_at && <div className="mt-2 text-[10.5px] text-zinc-600">last changed {new Date(cfg.updated_at).toLocaleString()}</div>}
    </div>
  );
}
