import { useSettings } from "./SettingsContext";
import { btnGhost, btnSm, cardCls, Chip, Switch } from "../ui";
import { isSupported } from "../../services/notifications";
import { OptRow } from "./OptRow";

export function RemindersSection() {
  const s = useSettings();
  const permLabel = isSupported()
    ? s.perm === "granted" ? "ON" : s.perm === "denied" ? "BLOCKED" : "ASK"
    : "UNSUPPORTED";
  const permTone = s.perm === "granted" ? "ok" : s.perm === "denied" ? "bad" : "default";

  return (
    <section className={`${cardCls} p-6`}>
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-[16px] font-extrabold">🔔 Daily reminder & streaks</h2>
        <Chip tone={permTone}>{permLabel}</Chip>
      </div>
      <p className="mb-4 text-[13px] text-mut">
        A gentle nudge when you haven't practiced yet — and a streak alert when your run hits a milestone. Works best on an installed app; fires while the app is open or when you return to it.
      </p>
      <div className="space-y-3">
        <OptRow title="Daily practice reminder" sub="Pings once a day if you haven't practiced yet">
          <Switch checked={s.prefs.enabled} onChange={s.toggleReminder} />
        </OptRow>
        {s.prefs.enabled && (
          <OptRow title="Reminder time" sub="Local time for the daily nudge">
            <input type="time" value={s.prefs.time} onChange={e => s.setReminderTime(e.target.value)} className="select-cls" />
          </OptRow>
        )}
        <OptRow title="Weekly digest" sub="A weekly summary: sessions, streak, and what's next on your roadmap">
          <Switch checked={s.prefs.weekly} onChange={s.toggleWeekly} />
        </OptRow>
        {s.prefs.weekly && (
          <OptRow title="Digest day" sub="Which day the summary fires (any = the first time you open the app in a new week)">
            <select value={s.prefs.digestDay ?? "any"} onChange={e => s.setDigestDay(e.target.value)} className="select-cls">
              <option value="any">Any day — first open of the week</option>
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
            </select>
          </OptRow>
        )}
        <div className="flex flex-wrap gap-2.5 pt-1">
          <button className={btnGhost + btnSm} onClick={s.testNotification}>🔔 Test notification</button>
          {s.prefs.weekly && <button className={btnGhost + btnSm} onClick={s.testWeeklyDigest}>📊 Test weekly digest</button>}
        </div>
      </div>
    </section>
  );
}
