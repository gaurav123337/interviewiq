import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../store";
import { avgScore, cardsDueToday, categoryMastery, scoresOverTime, streaks } from "../services/progress";
import { computeStats, xpLevel, ACHIEVEMENTS, loadXp, saveXp, claimAchievement, type XpData } from "../services/xp";
import { fetchLeaderboard, uploadMyLeaderboardRow, removeMyLeaderboardRow, type LeaderboardEntry, type LeaderboardSnapshot } from "../services/leaderboard";
import { roadmapCompletion, counselorCompletion } from "../services/completion";
import { getCloudState, subscribeCloud } from "../services/cloud";
import { cardCls, Chip, ProgressBar } from "./ui";
import { toast } from "../toast";

const DAY = 86_400_000;
const dayOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function Progress() {
  const { t } = useTranslation();
  const { state, nav } = useApp();
  const sessions = state.sessions;
  const [showPrintView, setShowPrintView] = useState(false);

  /* achievement-claim + opt-in leaderboard state (item 17) */
  const [xpData, setXpData] = useState<XpData>(() => loadXp());
  const [cloud, setCloud] = useState(() => getCloudState());
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [nameInput, setNameInput] = useState(() => loadXp().leaderboardName ?? "");
  const [lbBusy, setLbBusy] = useState(false);
  useEffect(() => subscribeCloud(setCloud), []);

  const uid = cloud.user?.id ?? null;
  const optedIn = xpData.leaderboardOptIn;
  /* fetch the real board only in the opted-in state; clear it otherwise */
  useEffect(() => {
    if (!uid || !optedIn) { setBoard([]); setLbLoading(false); return; }
    let alive = true;
    setLbLoading(true);
    void fetchLeaderboard(10)
      .then(rows => { if (alive) setBoard(rows); })
      .catch(() => { if (alive) setBoard([]); })
      .finally(() => { if (alive) setLbLoading(false); });
    return () => { alive = false; };
  }, [uid, optedIn]);

  const stats = useMemo(() => {
    const st = streaks(sessions);
    const cats = categoryMastery(sessions).slice(0, 6);
    const trend = scoresOverTime(sessions, 12);
    /* weak topics = key points missed most often across history */
    const misses = new Map<string, number>();
    for (const s of sessions) {
      for (const a of s.answers) {
        for (const m of a.missed ?? []) misses.set(m, (misses.get(m) ?? 0) + 1);
      }
    }
    const weak = [...misses.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    /* days with a session for the calendar */
    const activeDays = new Set(sessions.map(s => dayOf(s.date)));
    const xpStats = computeStats(sessions);
    const rmComplete = roadmapCompletion(sessions);
    const cnComplete = counselorCompletion();
    return { st, cats, trend, weak, activeDays, due: cardsDueToday(), xpStats, rmComplete, cnComplete };
  }, [sessions]);

  if (!sessions.length) {
    return (
      <div className="anim-view mx-auto max-w-[860px] pt-14 text-center">
        <div className="mb-3 text-[44px]">📈</div>
        <h1 className="text-2xl font-extrabold">{t("progress.empty")}</h1>
        <p className="mx-auto mt-2 max-w-[420px] text-[14.5px] text-mut">
          {t("progress.emptyDesc")}
        </p>
        <button className="mt-5 rounded-xl grad-bg px-6 py-3 text-[15px] font-extrabold text-white" onClick={() => nav("onboard")}>
          {t("progress.takeInterview")}
        </button>
      </div>
    );
  }

  const { st, cats, trend, weak, activeDays, due, xpStats, rmComplete, cnComplete } = stats;
  const best = cats[0];
  const lv = xpLevel(xpStats.totalXP);

  /* ---- achievement-claim + leaderboard handlers (item 17) ---- */
  const persistXp = (next: XpData) => { saveXp(next); setXpData(next); };
  const claim = (id: string) => setXpData(claimAchievement(id));
  const joinLeaderboard = async () => {
    const name = nameInput.trim().slice(0, 24);
    if (!name) { toast("Enter a display name first"); return; }
    setLbBusy(true);
    try {
      const snap: LeaderboardSnapshot = { name, xp: xpStats.totalXP, level: lv.level, streak: xpStats.currentStreak, sessions: xpStats.totalSessions };
      const res = await uploadMyLeaderboardRow(snap);
      if (!res.ok) { toast("✗ " + (res.error ?? "Couldn't join the leaderboard")); return; }
      persistXp({ ...xpData, leaderboardOptIn: true, leaderboardName: name });
      setBoard(await fetchLeaderboard(10));
      toast("🏅 You're on the leaderboard");
    } finally { setLbBusy(false); }
  };
  const leaveLeaderboard = async () => {
    setLbBusy(true);
    try {
      const res = await removeMyLeaderboardRow();
      if (!res.ok) { toast("✗ " + (res.error ?? "Couldn't leave the leaderboard")); return; }
      persistXp({ ...xpData, leaderboardOptIn: false });
      setBoard([]);
      toast("Left the leaderboard");
    } finally { setLbBusy(false); }
  };

  /* build streak badge SVG */
  const badgeSvg = makeStreakBadge(st.current, st.longest, sessions.length, avgScore(sessions), best?.label ?? "");

  const copyBadge = async () => {
    try {
      await navigator.clipboard.writeText(badgeSvg);
      toast("📋 Streak badge SVG copied — paste it anywhere");
    } catch { toast("Could not copy — select and copy manually"); }
  };

  /* print-friendly view overlays the whole page */
  if (showPrintView) {
    return (
      <div className="mx-auto max-w-[860px] px-4 py-8">
        <div className="flex items-center justify-between no-print">
          <h1 className="text-lg font-extrabold">📈 Progress report</h1>
          <div className="flex gap-2">
            <button className="rounded-xl grad-bg px-5 py-2 text-[13px] font-extrabold text-white" onClick={() => window.print()}>🖨 Print / PDF</button>
            <button className="rounded-xl border border-line/20 px-5 py-2 text-[13px] font-bold text-mut hover:bg-wht/10" onClick={() => setShowPrintView(false)}>Close</button>
          </div>
        </div>
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-line/10 p-5">
            <h2 className="mb-1 text-[16px] font-extrabold">📊 Summary</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-xl border border-line/10 bg-wht/5 px-3 py-2.5"><div className="text-[20px] font-extrabold">{sessions.length}</div><div className="text-[11.5px] text-mut">Sessions</div></div>
              <div className="rounded-xl border border-line/10 bg-wht/5 px-3 py-2.5"><div className="text-[20px] font-extrabold">{avgScore(sessions).toFixed(1)}/5</div><div className="text-[11.5px] text-mut">Avg score</div></div>
              <div className="rounded-xl border border-line/10 bg-wht/5 px-3 py-2.5"><div className="text-[20px] font-extrabold">{st.current} 🔥</div><div className="text-[11.5px] text-mut">Streak (longest {st.longest})</div></div>
              <div className="rounded-xl border border-line/10 bg-wht/5 px-3 py-2.5"><div className="text-[20px] font-extrabold">{due}</div><div className="text-[11.5px] text-mut">Drill due</div></div>
              <div className="rounded-xl border border-line/10 bg-wht/5 px-3 py-2.5"><div className="text-[20px] font-extrabold">{best?.label ?? "—"}</div><div className="text-[11.5px] text-mut">Top category</div></div>
              <div className="rounded-xl border border-line/10 bg-wht/5 px-3 py-2.5"><div className="text-[20px] font-extrabold">Lv.{xpLevel(computeStats(sessions).totalXP).level}</div><div className="text-[11.5px] text-mut">{computeStats(sessions).totalXP} XP</div></div>
            </div>
          </div>
          {cats.length >= 3 && <div className="rounded-2xl border border-line/10 p-5"><h2 className="mb-2 text-[15px] font-extrabold">🧭 Skill radar</h2><Radar data={cats} /></div>}
          <div className="rounded-2xl border border-line/10 p-5"><h2 className="mb-2 text-[15px] font-extrabold">📉 Trend (last {trend.length})</h2><Trend bars={trend} /></div>
          <div className="rounded-2xl border border-line/10 p-5"><h2 className="mb-2 text-[15px] font-extrabold">📅 Calendar (8 weeks)</h2><Calendar activeDays={activeDays} /></div>
          {weak.length > 0 && <div className="rounded-2xl border border-line/10 p-5"><h2 className="mb-2 text-[15px] font-extrabold">🎯 Weak topics</h2><div className="space-y-1.5">{weak.map(([t, n]) => <div key={t} className="flex items-center gap-2 text-[13px]"><Chip tone="bad">{n}×</Chip><span className="font-bold">{t}</span></div>)}</div></div>}
        </div>
        <p className="mt-6 text-center text-[11.5px] text-mut">Generated by InterviewIQ · {new Date().toISOString().slice(0, 10)}</p>
      </div>
    );
  }

  return (
    <div className="anim-view mx-auto max-w-[980px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">📈 Progress</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Your <span className="grad-text">momentum</span>.</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">Scores, streaks and weak spots across all your sessions — practice what's actually missing.</p>
      </div>

      {/* stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <Stat label="Sessions" value={sessions.length} icon="🎯" />
        <Stat label="Avg score" value={avgScore(sessions).toFixed(1) + "/5"} icon="⭐" />
        <Stat label="Current streak" value={st.current + " 🔥"} icon="🔥" sub={`longest ${st.longest}`} />
        <Stat label="Drill due" value={due} icon="🎴" sub={due ? "cards to review" : "all caught up"} />
        <Stat label="Top category" value={best?.label ?? "—"} icon="🏆" sub={best ? `${Math.round(best.pct * 100)}% mastered` : ""} />
        <div className={`${cardCls} p-4`}>
          <div className="flex items-center justify-between text-[11.5px] font-extrabold uppercase tracking-wider text-mut">
            <span>Level</span><span>⚡</span>
          </div>
          <div className="mt-1 text-[22px] font-extrabold tabular-nums leading-tight">{lv.level}</div>
          <ProgressBar widthPct={Math.round(lv.progress * 100)} height="h-1.5" className="mt-1 bg-deep/60" />
          <div className="mt-0.5 text-[10.5px] text-fnt">{lv.currentXP}/{lv.nextXP} XP</div>
        </div>
      </div>

      {/* XP + Achievements */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* XP level */}
        <div className={`${cardCls} p-5`}>
          <h2 className="mb-1 text-[15px] font-extrabold">⚡ Experience</h2>
          <p className="mb-3 text-[12.5px] text-mut">{xpStats.totalXP} total XP earned across {xpStats.totalSessions} sessions.</p>
          <div className="space-y-1.5">
            {ACHIEVEMENTS.map(a => {
              const unlocked = xpStats.unlockedAchievements.includes(a.id);
              const claimed = xpData.claimedAchievements.includes(a.id);
              return (
                <div key={a.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${unlocked ? "border-ok/30 bg-ok/10" : "border-line/10 bg-wht/[.03] opacity-50"}`}>
                  <span className="text-[18px]">{a.icon}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[13px] font-bold">{a.label}</span>
                    <span className="ml-2 text-[11px] text-fnt">{a.description}</span>
                  </div>
                  {unlocked && !claimed && (
                    <button
                      onClick={() => claim(a.id)}
                      className="flex-none rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10.5px] font-extrabold text-amber-300 hover:bg-amber-400/25"
                      title="New achievement — click to dismiss"
                    >
                      🎉 New
                    </button>
                  )}
                  {unlocked && claimed && <span className="flex-none text-[11px] font-bold text-ok">✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard — real, opt-in, Supabase-backed (item 17) */}
        <div className={`${cardCls} p-5`}>
          <h2 className="mb-1 text-[15px] font-extrabold">🏅 Leaderboard</h2>
          <p className="mb-3 text-[12.5px] text-mut">Opt-in · self-reported XP.</p>
          {!uid ? (
            <p className="rounded-lg border border-line/10 bg-wht/[.03] px-3 py-4 text-center text-[12.5px] text-mut">
              Sign in with cloud sync (Settings) to join the leaderboard.
            </p>
          ) : !optedIn ? (
            <div className="rounded-lg border border-line/10 bg-wht/[.03] p-3">
              <p className="mb-2 text-[12.5px] text-mut">Publish your display name + stats to the public board. You can leave anytime.</p>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value.slice(0, 24))}
                maxLength={24}
                placeholder="Display name"
                className="mb-2 w-full rounded-lg border border-line/20 bg-deep/40 px-3 py-2 text-[13px] outline-none focus:border-acc1/50"
              />
              <button
                onClick={joinLeaderboard}
                disabled={lbBusy}
                className="w-full rounded-lg grad-bg px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-50"
              >
                {lbBusy ? "Joining…" : "Show me on the leaderboard"}
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {lbLoading ? (
                  <p className="px-3 py-2 text-[12.5px] text-mut">Loading the leaderboard…</p>
                ) : board.length === 0 ? (
                  <p className="px-3 py-2 text-[12.5px] text-mut">Couldn't load the leaderboard right now — check your connection and try again.</p>
                ) : board.map(e => {
                  const podium = !e.appended && e.rank <= 3;
                  return (
                    <div key={e.user_id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${e.isYou ? "border border-acc1/30 bg-acc1/10" : "border border-transparent bg-wht/[.03]"}`}>
                      <span className={`w-6 flex-none text-center text-[13px] font-extrabold ${podium ? "text-amber-400" : "text-mut"}`}>{podium ? ["🥇", "🥈", "🥉"][e.rank - 1] : e.rank}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{e.name}{e.isYou ? " (you)" : ""}</span>
                      <span className="text-[11px] font-bold text-fnt">Lv.{e.level}</span>
                      <span className="text-[12px] font-extrabold tabular-nums text-acctxt">{e.xp.toLocaleString()} XP</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={leaveLeaderboard}
                disabled={lbBusy}
                className="mt-2 text-[11.5px] font-bold text-mut underline hover:text-fnt disabled:opacity-50"
              >
                {lbBusy ? "…" : "Leave the leaderboard"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Learning plans — real Roadmap + Counselor completion (item 17) */}
      <div className="mt-5">
        <div className={`${cardCls} p-5`}>
          <h2 className="mb-1 text-[15px] font-extrabold">🧭 Learning plans</h2>
          <p className="mb-3 text-[12.5px] text-mut">Your progress across the roadmap and the counselor's 90-day plan.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={() => nav("roadmap")} className="rounded-lg border border-line/10 bg-wht/[.03] p-3 text-left hover:bg-wht/[.06]">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[13px] font-extrabold">📍 Roadmap</span>
                <span className="text-[11px] font-bold text-acctxt">Open →</span>
              </div>
              {rmComplete ? (
                <>
                  <p className="text-[12px] font-bold text-fnt">{rmComplete.topicsDone}/{rmComplete.topicsTotal} topics · {rmComplete.weeksDone}/{rmComplete.weeksTotal} weeks</p>
                  <ProgressBar widthPct={rmComplete.topicsTotal ? Math.round((rmComplete.topicsDone / rmComplete.topicsTotal) * 100) : 0} height="h-1.5" className="mt-1.5 bg-deep/60" />
                </>
              ) : (
                <p className="text-[12px] text-mut">No roadmap yet — build one.</p>
              )}
            </button>
            <button onClick={() => nav("counselor")} className="rounded-lg border border-line/10 bg-wht/[.03] p-3 text-left hover:bg-wht/[.06]">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[13px] font-extrabold">🧑‍🏫 Skill counselor</span>
                <span className="text-[11px] font-bold text-acctxt">Open →</span>
              </div>
              {cnComplete ? (
                <>
                  <p className="text-[12px] font-bold text-fnt">{cnComplete.weeksDone}/{cnComplete.weeksTotal} weeks done</p>
                  <ProgressBar widthPct={cnComplete.weeksTotal ? Math.round((cnComplete.weeksDone / cnComplete.weeksTotal) * 100) : 0} height="h-1.5" className="mt-1.5 bg-deep/60" />
                </>
              ) : (
                <p className="text-[12px] text-mut">No study plan yet.</p>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* skill radar */}
        <div className={`${cardCls} p-5`}>
          <h2 className="mb-1 text-[15px] font-extrabold">🧭 Skill radar</h2>
          <p className="mb-3 text-[12.5px] text-mut">Average coverage per category across all history.</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button className="rounded-lg border border-line/20 px-2.5 py-1 text-[11.5px] font-bold text-mut hover:bg-wht/10 no-print" onClick={copyBadge} title="Copy SVG badge for your profile">📋 Copy streak badge</button>
            <button className="rounded-lg border border-line/20 px-2.5 py-1 text-[11.5px] font-bold text-mut hover:bg-wht/10 no-print" onClick={() => setShowPrintView(true)}>🖨 Print report</button>
          </div>
          {cats.length < 3 ? (
            <p className="text-[13px] text-mut">Answer questions in more categories to fill the radar.</p>
          ) : (
            <Radar data={cats} />
          )}
        </div>

        {/* score trend */}
        <div className={`${cardCls} p-5`}>
          <h2 className="mb-1 text-[15px] font-extrabold">📉 Score trend</h2>
          <p className="mb-3 text-[12.5px] text-mut">Overall score per session (last {trend.length}).</p>
          <Trend bars={trend} />
        </div>

        {/* streak calendar */}
        <div className={`${cardCls} p-5`}>
          <h2 className="mb-1 text-[15px] font-extrabold">📅 Practice calendar</h2>
          <p className="mb-3 text-[12.5px] text-mut">Last 8 weeks — every day you completed a session.</p>
          <Calendar activeDays={activeDays} />
        </div>

        {/* weak topics */}
        <div className={`${cardCls} p-5`}>
          <h2 className="mb-1 text-[15px] font-extrabold">🎯 Weak topics</h2>
          <p className="mb-3 text-[12.5px] text-mut">Key points you've missed most — the highest-leverage things to study next.</p>
          {weak.length === 0 ? (
            <p className="text-[13px] text-mut">Nothing missed yet — impressive! Keep drilling to stay sharp.</p>
          ) : (
            <div className="space-y-1.5">
              {weak.map(([topic, n]) => (
                <div key={topic} className="flex items-center gap-2 rounded-lg border border-line/10 bg-wht/5 px-3 py-2">
                  <Chip tone="bad">{n}×</Chip>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{topic}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, sub }: { label: string; value: string | number; icon: string; sub?: string }) {
  return (
    <div className={`${cardCls} p-4`}>
      <div className="flex items-center justify-between text-[11.5px] font-extrabold uppercase tracking-wider text-mut">
        <span>{label}</span><span>{icon}</span>
      </div>
      <div className="mt-1 truncate text-[22px] font-extrabold tabular-nums leading-tight">{value}</div>
      {sub && <div className="truncate text-[11.5px] text-fnt">{sub}</div>}
    </div>
  );
}

/* SVG radar for category mastery */
function Radar({ data }: { data: { label: string; pct: number }[] }) {
  const n = data.length;
  const W = 220, H = 224;
  const cx = W / 2, cy = H / 2;
  const R = 58;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (r: number) => data.map((_, i) => pt(i, r).join(",")).join(" ");
  const shape = data.map((d, i) => pt(i, Math.max(8, R * d.pct)).join(",")).join(" ");
  const linesFor = (label: string) => {
    const words = label.split(" ");
    if (words.length > 1 && label.length > 10) {
      const mid = Math.ceil(words.length / 2);
      return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    }
    return label.length > 16 ? [label.slice(0, 15) + "…"] : [label];
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[320px]">
      {[0.33, 0.66, 1].map(k => (
        <polygon key={k} points={poly(R * k)} fill="none" stroke="rgba(148,163,184,.25)" strokeWidth="1" />
      ))}
      <polygon points={shape} fill="rgba(99,102,241,.22)" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const [x, y] = pt(i, Math.max(10, R * d.pct));
        return <circle key={d.label} cx={x} cy={y} r="3" fill="#a5b4fc" />;
      })}
      {data.map((d, i) => {
        const [x, y] = pt(i, R + 28);
        const lines = linesFor(d.label);
        return (
          <text key={d.label} x={x} y={y} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--color-mut)">
            {lines.map((ln, li) => (
              <tspan key={li} x={x} dy={li === 0 ? 0 : 10.5}>{ln}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

/* last-12-sessions bar trend */
function Trend({ bars }: { bars: { date: string; pct: number }[] }) {
  const max = Math.max(0.2, ...bars.map(b => b.pct));
  return (
    <div className="flex h-[150px] items-end gap-1.5">
      {bars.map((b, i) => {
        const h = Math.max(6, (b.pct / max) * 130);
        const pct = Math.round(b.pct * 100);
        return (
          <div key={i} className="group flex min-w-0 flex-1 flex-col items-center justify-end self-stretch">
            <span className="mb-1 text-[10px] font-extrabold tabular-nums text-mut opacity-0 transition-opacity group-hover:opacity-100">{pct}%</span>
            <div
              className={`w-full rounded-t-md ${pct >= 70 ? "grad-bg" : pct >= 45 ? "bg-warn/70" : "bg-bad/60"}`}
              style={{ height: h + "px" }}
              title={`${b.date} — ${pct}%`}
            />
          </div>
        );
      })}
    </div>
  );
}

/* 8-week practice calendar */
function Calendar({ activeDays }: { activeDays: Set<string> }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - 7 * 8 * DAY);
  const days: { d: Date; active: boolean }[] = [];
  for (let i = 0; i < 7 * 8; i++) {
    const d = new Date(start.getTime() + i * DAY);
    days.push({ d, active: activeDays.has(dayOf(d.getTime())) });
  }
  const weeks: { d: Date; active: boolean }[][] = [];
  for (let w = 0; w < 8; w++) weeks.push(days.slice(w * 7, w * 7 + 7));
  const DOW = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <div className="space-y-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex items-center gap-1.5">
          <span className="w-3 shrink-0 text-right text-[10px] font-extrabold text-mut">{DOW[week[0].d.getDay()]}</span>
          {week.map(({ d, active }) => {
            const isToday = d.getTime() === today.getTime();
            return (
              <div
                key={d.getTime()}
                title={`${d.toDateString()}${active ? " — practiced" : ""}`}
                className={`h-5 flex-1 rounded-[5px] ${active ? "grad-bg" : "border border-line/10 bg-wht/5"} ${isToday ? "ring-2 ring-acc1/60" : ""}`}
              />
            );
          })}
        </div>
      ))}
      <p className="pt-1 text-[11.5px] text-fnt">● practiced · ring = today</p>
    </div>
  );
}

/** Generates a compact SVG streak badge embeddable in GitHub profiles, READMEs, etc. */
function makeStreakBadge(current: number, longest: number, sessions: number, avg: number, topCat: string): string {
  const encode = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = 240, h = 80, r = 8;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<rect width="' + w + '" height="' + h + '" rx="' + r + '" fill="#1e1e2e" />' +
    '<text x="16" y="24" font-family="sans-serif" font-size="12" font-weight="bold" fill="#a5b4fc">InterviewIQ</text>' +
    '<text x="' + (w - 16) + '" y="24" font-family="sans-serif" font-size="22" font-weight="bold" fill="#fbbf24" text-anchor="end">' + current + (current > 0 ? '🔥' : '') + '</text>' +
    '<text x="' + (w - 16) + '" y="42" font-family="sans-serif" font-size="9" fill="#6b7280" text-anchor="end">streak · longest ' + longest + '</text>' +
    '<text x="16" y="46" font-family="sans-serif" font-size="11" fill="#d1d5db">' + sessions + ' sessions · ' + encode(topCat) + '</text>' +
    '<text x="16" y="62" font-family="sans-serif" font-size="10" fill="#6b7280">avg ' + avg.toFixed(1) + '/5 · interviewiq.live</text>' +
    '</svg>';
}