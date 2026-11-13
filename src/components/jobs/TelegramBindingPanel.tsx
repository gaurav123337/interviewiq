/* Telegram-only controls; review decisions remain in ReviewQueuePanel. */
import { useEffect, useRef, useState } from "react";
import { getCloudState, subscribeCloud } from "../../services/cloud";
import { serverAutoApply, subscribeEntitlement } from "../../services/entitlement";
import {
  defaultNotifyTimeZone, disconnectNotifyConfig, getNotifyConfig, setNotifyConfig, testNotifyConfig,
  validateNotifyBinding, type NotifyConfig,
} from "../../services/jobSites";

export default function TelegramBindingPanel() {
  const [account, setAccount] = useState(() => ({ id: getCloudState().user?.id ?? null, version: 0 }));
  useEffect(() => subscribeCloud(s => setAccount(previous => {
    const id = s.user?.id ?? null;
    return previous.id === id ? previous : { id, version: previous.version + 1 };
  })), []);
  if (!account.id) return <p className="mt-2 text-xs text-zinc-300">Sign in to manage Telegram notifications.</p>;
  return <AccountTelegramBinding key={`${account.id}:${account.version}`} userId={account.id} />;
}

function failureMessage(reason?: string): string {
  if (reason === "stale_binding" || reason === "binding_changed") return "Settings changed elsewhere. Reload Telegram settings before retrying.";
  if (reason === "not_entitled" || reason === "entitlement_required") return "Platinum or the auto-apply add-on is required to save or test. You can still disconnect.";
  if (reason === "rate_limited") return "Too many delivery tests. Wait before trying again; your previous binding was not replaced.";
  if (reason === "unauthorized") return "Sign in again to manage Telegram settings.";
  return "Delivery test failed. Your previous binding was not replaced. Start the bot and check the intended numeric chat ID and BotFather token.";
}

function AccountTelegramBinding({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<NotifyConfig | null | undefined>(undefined);
  const [chatId, setChatId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [timeZone, setTimeZone] = useState(defaultNotifyTimeZone);
  const [entitled, setEntitled] = useState(serverAutoApply);
  const [busy, setBusy] = useState<"load" | "save" | "test" | "unbind" | null>("load");
  const [message, setMessage] = useState<string | null>(null);
  const live = useRef(true);
  const pending = useRef(false);
  const configured = Boolean(config?.has_token && config.chat_id);
  const current = () => live.current && getCloudState().user?.id === userId;

  const load = async () => {
    if (!current() || pending.current) return;
    pending.current = true; setBusy("load"); setMessage(null); setBotToken("");
    try {
      const saved = await getNotifyConfig();
      if (!current()) return;
      setConfig(saved); setChatId(saved?.chat_id ?? ""); setTimeZone(saved?.time_zone ?? defaultNotifyTimeZone());
    } catch {
      if (current()) setMessage("Telegram configuration is unavailable. Reload settings to try again.");
    } finally {
      if (current()) { pending.current = false; setBusy(null); }
    }
  };

  useEffect(() => {
    live.current = true;
    const unsubscribeCloud = subscribeCloud(s => {
      if (s.user?.id !== userId) {
        live.current = false;
        setBotToken(""); setChatId(""); setTimeZone(defaultNotifyTimeZone()); setConfig(undefined); setMessage(null); setOpen(false);
      }
    });
    const unsubscribeEntitlement = subscribeEntitlement(() => {
      if (current()) { setEntitled(serverAutoApply()); if (!serverAutoApply()) setBotToken(""); }
    });
    void load();
    return () => { live.current = false; unsubscribeCloud(); unsubscribeEntitlement(); };
  }, [userId]);

  const act = async (operation: "save" | "test" | "unbind") => {
    if (!current() || pending.current || config === undefined) return;
    if (operation !== "unbind" && !serverAutoApply()) {
      setEntitled(false); setBotToken(""); setMessage("Platinum or the auto-apply add-on is required to save or test. You can still disconnect."); return;
    }
    if (operation === "save") {
      const invalid = validateNotifyBinding(chatId, botToken, timeZone, config?.has_token);
      if (invalid) { setMessage(invalid); return; }
    }
    pending.current = true; setBusy(operation); setMessage(null);
    try {
      const revision = config?.revision ?? null;
      const result = operation === "save" ? await setNotifyConfig(chatId, botToken, timeZone, revision)
        : operation === "test" ? await testNotifyConfig(revision) : await disconnectNotifyConfig(revision);
      if (!current()) return;
      if (operation !== "unbind" && !serverAutoApply()) { setEntitled(false); setMessage("Access changed during the request. Reload Telegram settings to check the saved binding."); return; }
      if (operation === "unbind" && result.disconnected) {
        setConfig(result.config); setChatId(""); setTimeZone(defaultNotifyTimeZone()); setMessage("Telegram disconnected.");
      } else if (operation !== "unbind" && result.sent && !result.reason && result.config?.has_token && result.config.chat_id && result.config.delivery_tested_at) {
        setConfig(result.config); setChatId(result.config.chat_id); setTimeZone(result.config.time_zone);
        setMessage(operation === "save" ? "Saved after delivery test passed. Check the test message arrived in the intended chat." : "Delivery test passed. Check the test message arrived in the intended chat.");
      } else {
        setMessage(operation === "unbind" ? "Disconnect failed. Reload settings before retrying." : failureMessage(result.reason));
      }
    } catch {
      if (current()) setMessage("Telegram request failed. Reload settings before retrying; your previous binding is retained if delivery failed.");
    } finally {
      if (current()) { setBotToken(""); pending.current = false; setBusy(null); }
    }
  };

  const testedAt = config?.delivery_tested_at;
  const status = configured ? testedAt ? "Delivery test passed" : "Configured · not delivery-tested" : config === undefined ? "Settings unavailable" : "Not configured";
  return (
    <section className="mt-2 text-xs" aria-label="Telegram binding">
      <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}
        className={`rounded px-2 py-1 font-medium ${configured ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
        Telegram · {busy === "load" ? "Loading settings…" : status}
      </button>
      {open && <div className="mt-2 space-y-2 rounded-md border border-amber-500/30 bg-zinc-900 px-2.5 py-2.5" aria-busy={busy !== null}>
        <div className="font-semibold text-zinc-300">Telegram notifications — this account</div>
        <p className="text-[11px] text-zinc-300">Create a bot with @BotFather, copy its token, and send /start to the bot in your intended chat. Enter that chat’s numeric ID, not a username. Never paste your token into a URL or share it.</p>
        <p className="text-[11px] text-zinc-300">Notifications cover per-job submitted, needs_review and error outcomes, plus a run summary. Save and test sends a generic message first; settings are saved only if delivery succeeds. A delivery test is not proof of chat ownership: check the message arrived in the intended chat.</p>
        {!entitled && <p className="text-amber-400">Platinum or the auto-apply add-on is required to save or test. Existing settings can still be disconnected.</p>}
        <div className="flex flex-wrap gap-2">
          <label className="text-zinc-300">Chat ID
            <input aria-label="Telegram chat ID" value={chatId} onChange={e => setChatId(e.target.value)} disabled={busy !== null || !entitled}
              placeholder="Numeric chat ID" autoComplete="off" className="ml-2 w-44 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200" />
          </label>
          <label className="text-zinc-300">BotFather token
            <input aria-label="BotFather token" value={botToken} onChange={e => setBotToken(e.target.value)} type="password" autoComplete="new-password" disabled={busy !== null || !entitled}
              placeholder={config?.has_token ? "Leave blank to keep saved token" : "Paste BotFather token"} className="ml-2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200" />
          </label>
          <label className="text-zinc-300">Time zone
            <input aria-label="Telegram time zone" value={timeZone} onChange={e => setTimeZone(e.target.value)} disabled={busy !== null || !entitled}
              placeholder="Europe/London or UTC" className="ml-2 w-44 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200" />
          </label>
        </div>
        {config?.has_token && <p className="text-zinc-300">Saved token is hidden. Leave the token field blank to reuse it when changing chat ID or time zone.</p>}
        {configured && <p className="text-zinc-300">Saved chat: {config?.chat_id} · Time zone: {config?.time_zone}</p>}
        <p className="text-zinc-300">Delivery tested: {testedAt ? new Date(testedAt).toLocaleString() : "Never"}{config?.updated_at ? ` · Settings updated: ${new Date(config.updated_at).toLocaleString()}` : ""}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy !== null || !entitled || config === undefined} onClick={() => void act("save")} className="rounded bg-emerald-600 px-2 py-1 font-medium text-white disabled:opacity-50">{busy === "save" ? "Saving and testing…" : "Save and test"}</button>
          <button type="button" disabled={busy !== null || !entitled || !configured} onClick={() => void act("test")} className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-50">{busy === "test" ? "Testing…" : "Test again"}</button>
          <button type="button" disabled={busy !== null || !configured} onClick={() => void act("unbind")} className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-50">{busy === "unbind" ? "Disconnecting…" : "Disconnect"}</button>
          <button type="button" disabled={busy !== null} onClick={() => void load()} className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-50">Reload Telegram settings</button>
        </div>
        {message && <p role="status" className="text-zinc-300">{message}</p>}
      </div>}
    </section>
  );
}
