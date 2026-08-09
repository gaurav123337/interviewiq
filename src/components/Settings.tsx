import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Config } from "../types";
import { aiAvailable, chat, clearKey, getSettings, saveSettings } from "../ai";
import { activatePro, deactivatePro, getStoredKey } from "../services/license";
import { getTier } from "../services/entitlements";
import { fire, getPermission, getPrefs, isSupported, requestPermission, savePrefs } from "../services/notifications";
import { cloudSignIn, cloudSignOut, cloudSignUp, cloudSyncNow, getCloudState, subscribeCloud } from "../services/cloud";
import { useApp } from "../store";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip, Modal, Seg, Switch } from "./ui";

export function Settings() {
  const { state, updateConfig, clearHistory, resetAll } = useApp();
  const { config, sessions } = state;
  const [key, setKey] = useState(getSettings().key);
  const [base, setBase] = useState(getSettings().base);
  const [model, setModel] = useState(getSettings().model);
  const [testing, setTesting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [proKey, setProKey] = useState("");
  const [pro, setPro] = useState(getTier() === "pro");
  const [prefs, setPrefs] = useState(getPrefs());
  const [perm, setPerm] = useState(getPermission());
  const [cloud, setCloud] = useState(getCloudState());
  const [cloudMode, setCloudMode] = useState<"in" | "up">("in");
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPass, setCloudPass] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);

  useEffect(() => subscribeCloud(setCloud), []);

  const doCloudAuth = async () => {
    if (!cloudEmail || !cloudPass) { toast("Enter your email and password"); return; }
    setCloudBusy(true);
    try {
      const r = cloudMode === "in"
        ? await cloudSignIn(cloudEmail, cloudPass)
        : await cloudSignUp(cloudEmail, cloudPass);
      if (!r.ok) { toast("✗ " + (r.error ?? "Something went wrong")); return; }
      if ("needsConfirmation" in r && r.needsConfirmation) { toast("📬 Check your email to confirm your account"); return; }
      toast("☁️ Cloud sync on — your progress is backed up");
      setCloudEmail(""); setCloudPass("");
    } finally {
      setCloudBusy(false);
    }
  };

  const toggleReminder = async (v: boolean) => {
    if (v && getPermission() !== "granted") {
      const p = await requestPermission();
      setPerm(p);
      if (p !== "granted") { toast("🔕 Notifications blocked — allow them in your browser settings"); return; }
    }
    savePrefs({ ...getPrefs(), enabled: v });
    setPrefs(getPrefs());
    toast(v ? "🔔 Daily reminder on" : "Daily reminder off");
  };

  const setReminderTime = (time: string) => {
    savePrefs({ ...getPrefs(), time });
    setPrefs(getPrefs());
  };

  const testNotification = async () => {
    const ok = await fire("🔔 InterviewIQ", "This is how your practice reminder will look.");
    toast(ok ? "✅ Notification sent" : "🔕 Enable notifications first");
  };

  const saveKey = () => {
    saveSettings({ key, base, model });
    toast(aiAvailable() ? "✨ AI feedback enabled" : "Key saved — add a key to enable AI coaching");
  };

  const testConnection = async () => {
    saveSettings({ key, base, model });
    setTesting(true);
    try {
      await chat([{ role: "user", content: "Reply with exactly: OK" }], { maxTokens: 10 });
      setTesting(false);
      toast("✅ AI connection works");
    } catch (e) {
      setTesting(false);
      toast("✗ " + ((e as Error).message || "Connection failed"));
    }
  };

  return (
    <div className="anim-view mx-auto max-w-[760px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">⚙️ Settings</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Tune your <span className="grad-text">coach</span>.</h1>
        <p className="mx-auto mt-2 max-w-[520px] text-[14.5px] text-mut">Everything works offline out of the box. Add an API key for generative AI feedback.</p>
      </div>

      <div className="mt-7 space-y-5">
        {/* Pro section */}
        <section className={`${cardCls} p-6`}>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-[16px] font-extrabold">✨ InterviewIQ Pro</h2>
            {pro && <Chip tone="ok">ACTIVE</Chip>}
          </div>
          <p className="mb-4 text-[13px] text-mut">
            {pro
              ? `Pro is active on this device (${getStoredKey()}). Unlimited sessions and AI coaching.`
              : "Unlock unlimited sessions, all companies, and unlimited AI coaching. Enter your license key to activate."}
          </p>
          {pro ? (
            <button className={btnDanger + btnSm} onClick={() => { deactivatePro(); setPro(false); toast("Pro deactivated"); }}>
              Deactivate Pro
            </button>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              <input
                value={proKey}
                onChange={e => setProKey(e.target.value)}
                placeholder="IQPRO-XXXX-XXXX-XXXX"
                className="min-w-[240px] flex-1 rounded-xl border border-white/15 bg-[#0b1120]/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
              />
              <button
                className={btnPrimary + btnSm}
                onClick={() => {
                  const r = activatePro(proKey);
                  if (r.ok) { setPro(true); setProKey(""); toast("🎉 Pro activated!"); }
                  else toast("✗ " + (r.error ?? "Invalid key"));
                }}
              >
                Activate
              </button>
            </div>
          )}
        </section>

        {/* Cloud sync */}
        <section className={`${cardCls} p-6`}>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-[16px] font-extrabold">☁️ Cloud sync</h2>
            {cloud.user && <Chip tone="ok">SYNCED</Chip>}
            {!cloud.configured && <Chip>OFF</Chip>}
          </div>
          {cloud.user ? (
            <>
              <p className="mb-4 text-[13px] text-mut">
                Signed in as <span className="font-bold text-ink">{cloud.user.email}</span> — your sessions, streaks and drill progress back up to the cloud and restore on any device. Everything still works offline.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button className={btnGhost + btnSm} onClick={async () => { await cloudSyncNow(); toast("☁️ Synced"); }} disabled={cloud.syncing}>
                  {cloud.syncing ? <><span className="spinner" />Syncing…</> : "🔄 Sync now"}
                </button>
                <button className={btnDanger + btnSm} onClick={async () => { await cloudSignOut(); toast("Signed out — local data kept"); }}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 text-[13px] text-mut">
                {cloud.configured
                  ? "Sign in to back up your sessions, streaks and drill progress across devices. The cloud is an optional mirror — local use stays fully offline."
                  : "Back up and restore your progress across devices with optional cloud sync."}
              </p>
              {cloud.configured ? (
                <div className="space-y-3">
                  <Seg options={[{ value: "in", label: "Sign in" }, { value: "up", label: "Create account" }]} value={cloudMode} onChange={setCloudMode} />
                  <input
                    type="email" value={cloudEmail} onChange={e => setCloudEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-white/15 bg-[#0b1120]/80 px-4 py-2.5 text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
                  />
                  <input
                    type="password" value={cloudPass} onChange={e => setCloudPass(e.target.value)}
                    placeholder="Password (min 6 characters)"
                    className="w-full rounded-xl border border-white/15 bg-[#0b1120]/80 px-4 py-2.5 text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
                  />
                  <button className={btnPrimary + btnSm} onClick={doCloudAuth} disabled={cloudBusy}>
                    {cloudBusy ? <><span className="spinner" />…</> : cloudMode === "in" ? "Sign in" : "Create account"}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[12.5px] text-mut">
                  💡 To enable: create a free Supabase project → run the SQL in the README → paste your project URL + anon key into <code className="font-mono text-acc1">src/config.ts</code>.
                </div>
              )}
            </>
          )}
        </section>

        {/* AI section */}
        <section className={`${cardCls} p-6`}>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-[16px] font-extrabold">✨ AI feedback (optional)</h2>
            {aiAvailable() && <span className="rounded-full border border-ok/40 bg-ok/10 px-2.5 py-0.5 text-[11px] font-bold text-ok">ON</span>}
          </div>
          <p className="mb-4 text-[13px] text-mut">
            Works with any OpenAI-compatible endpoint — OpenAI, OpenRouter, Groq, Ollama. The key stays in your browser only.
          </p>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-bold text-mut">API key</span>
              <input
                type="password" value={key} onChange={e => setKey(e.target.value)}
                placeholder="sk-…"
                className="w-full rounded-xl border border-white/15 bg-[#0b1120]/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-bold text-mut">Base URL</span>
                <input
                  value={base} onChange={e => setBase(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#0b1120]/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-bold text-mut">Model</span>
                <input
                  value={model} onChange={e => setModel(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#0b1120]/80 px-4 py-2.5 font-mono text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button className={btnPrimary + btnSm} onClick={saveKey}>Save key</button>
              <button className={btnGhost + btnSm} onClick={testConnection} disabled={testing}>
                {testing ? <><span className="spinner" />Testing…</> : "Test connection"}
              </button>
              <button className={btnGhost + btnSm} onClick={() => { clearKey(); setKey(""); toast("AI key removed — offline engine still active"); }}>Remove key</button>
            </div>
          </div>
        </section>

        {/* reminders */}
        <section className={`${cardCls} p-6`}>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-[16px] font-extrabold">🔔 Daily reminder & streaks</h2>
            <Chip tone={perm === "granted" ? "ok" : perm === "denied" ? "bad" : "default"}>
              {isSupported() ? (perm === "granted" ? "ON" : perm === "denied" ? "BLOCKED" : "ASK") : "UNSUPPORTED"}
            </Chip>
          </div>
          <p className="mb-4 text-[13px] text-mut">
            A gentle nudge when you haven't practiced yet — and a streak alert when your run hits a milestone. Works best on an installed app; fires while the app is open or when you return to it.
          </p>
          <div className="space-y-3">
            <OptRow title="Daily practice reminder" sub="Pings once a day if you haven't practiced yet">
              <Switch checked={prefs.enabled} onChange={toggleReminder} />
            </OptRow>
            {prefs.enabled && (
              <OptRow title="Reminder time" sub="Local time for the daily nudge">
                <input type="time" value={prefs.time} onChange={e => setReminderTime(e.target.value)} className="select-cls" />
              </OptRow>
            )}
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button className={btnGhost + btnSm} onClick={testNotification}>🔔 Test notification</button>
            </div>
          </div>
        </section>

        {/* defaults */}
        <section className={`${cardCls} p-6`}>
          <h2 className="mb-1 text-[16px] font-extrabold">🎛️ Interview defaults</h2>
          <p className="mb-3 text-[13px] text-mut">Applied to every new session (you can still tweak them in the setup modal).</p>
          <OptRow title="Questions per session" sub="More questions = deeper assessment">
            <Seg options={[5, 8, 10, 15].map(c => ({ value: String(c), label: String(c) }))} value={String(config.count)} onChange={v => updateConfig({ count: Number(v) })} />
          </OptRow>
          <OptRow title="Mode" sub="Journey ramps from junior to your level">
            <Seg<Config["mode"]> options={[{ value: "standard", label: "Standard" }, { value: "journey", label: "Journey" }]} value={config.mode} onChange={v => updateConfig({ mode: v })} />
          </OptRow>
          <OptRow title="Timer" sub="Real interview pressure">
            <Seg<Config["timing"]> options={[{ value: "none", label: "Off" }, { value: "relaxed", label: "3 min" }, { value: "strict", label: "90 s" }]} value={config.timing} onChange={v => updateConfig({ timing: v })} />
          </OptRow>
          <OptRow title="Voice answers" sub="Dictate with your microphone">
            <Switch checked={config.voice} onChange={v => updateConfig({ voice: v })} />
          </OptRow>
        </section>

        {/* data */}
        <section className={`${cardCls} p-6`}>
          <h2 className="mb-1 text-[16px] font-extrabold">🗄️ Your data</h2>
          <p className="mb-4 text-[13px] text-mut">All stored locally in this browser — nothing leaves your device unless you add an API key.</p>
          <div className="flex flex-wrap gap-2.5">
            <button className={btnGhost + btnSm} onClick={() => { clearHistory(); toast("History cleared"); }} disabled={!sessions.length}>
              Clear history ({sessions.length})
            </button>
            <button className={btnDanger + btnSm} onClick={() => setConfirmReset(true)}>Reset everything</button>
          </div>
        </section>
      </div>

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)} title="Reset everything?" desc="Deletes your history, onboarding choices, defaults and API key. This cannot be undone.">
          <div className="flex gap-3">
            <button className={btnGhost} onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className={btnDanger} onClick={() => { setConfirmReset(false); resetAll(); toast("All data reset"); }}>Yes, reset</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OptRow({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-3.5 last:border-0">
      <div>
        <div className="text-[14.5px] font-bold">{title}</div>
        <div className="text-[12.5px] text-fnt">{sub}</div>
      </div>
      {children}
    </div>
  );
}
