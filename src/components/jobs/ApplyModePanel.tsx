/* Apply-mode control — the owner's ON/OFF switch for the auto-apply engine,
   plus the machine choice: `off` is the kill switch (the local engine re-reads
   it every watch cycle, so turning it off stops even a running watcher within
   one poll); `local` = today's behavior on the user's machine; `cloud` =
   persistent hosted browser session (CDP endpoint required — see
   docs/cloud-browser-research.md; remote acquisition ships next, the engine
   skips honestly until then). */

import { useEffect, useState } from "react";
import { getApplyConfig, setApplyConfig, isValidCdpEndpoint, type ApplyConfig, type ApplyMode } from "../../services/jobSites.ts";

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

  useEffect(() => { void refresh(); }, []);

  const apply = async (mode: ApplyMode) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await setApplyConfig(mode, mode === "cloud" ? "browserbase" : undefined, mode === "cloud" ? endpoint.trim() : undefined);
      await refresh();
      setSaved(mode === "off"
        ? "✓ Engine OFF — the engine processes on your machine are killed (≤1 min) and won't respawn until you switch back on."
        : `✓ Mode set to ${mode}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const mode = cfg?.mode ?? null;

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
        <button onClick={() => void refresh()} className="text-xs text-zinc-400 hover:text-zinc-200">↻ refresh</button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        One switch controls the whole rig. <b>Off</b> kills the engine on this machine now — watcher, listener and engine
        browsers stop within a minute and stay stopped (the schedulers check this switch before every respawn).
        <b> My machine</b> runs the local Playwright engine here; <b>Cloud session</b> runs against a persistent browser over CDP.
      </p>

      {error && <div className="mt-2 rounded bg-red-500/10 px-2 py-1 text-xs text-red-400">{error}</div>}
      {saved && <div className="mt-2 rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">{saved}</div>}

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            disabled={busy || mode === null}
            onClick={() => void apply(m.id)}
            title={m.blurb}
            className={`rounded-md border px-2.5 py-2 text-left text-xs transition ${
              mode === m.id
                ? m.id === "off" ? "border-red-500/60 bg-red-500/10 text-red-300" : m.id === "local" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-sky-500/60 bg-sky-500/10 text-sky-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
            } ${busy ? "opacity-50" : ""}`}
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
