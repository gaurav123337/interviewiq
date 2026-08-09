import { useMemo } from "react";
import { useApp } from "../store";
import { avgScore, cardsDueToday, categoryMastery, scoresOverTime, streaks } from "../services/progress";
import { cardCls, Chip } from "./ui";

const DAY = 86_400_000;
const dayOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function Progress() {
  const { state, nav } = useApp();
  const sessions = state.sessions;

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
    return { st, cats, trend, weak, activeDays, due: cardsDueToday() };
  }, [sessions]);

  if (!sessions.length) {
    return (
      <div className="anim-view mx-auto max-w-[860px] pt-14 text-center">
        <div className="mb-3 text-[44px]">📈</div>
        <h1 className="text-2xl font-extrabold">No progress yet</h1>
        <p className="mx-auto mt-2 max-w-[420px] text-[14.5px] text-mut">
          Complete an interview and your stats — skill radar, score trend and streak — show up here.
        </p>
        <button className="mt-5 rounded-xl grad-bg px-6 py-3 text-[15px] font-extrabold text-white" onClick={() => nav("onboard")}>
          🎯 Take an interview
        </button>
      </div>
    );
  }

  const { st, cats, trend, weak, activeDays, due } = stats;
  const best = cats[0];

  return (
    <div className="anim-view mx-auto max-w-[980px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">📈 Progress</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Your <span className="grad-text">momentum</span>.</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">Scores, streaks and weak spots across all your sessions — practice what's actually missing.</p>
      </div>

      {/* stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Sessions" value={sessions.length} icon="🎯" />
        <Stat label="Avg score" value={avgScore(sessions).toFixed(1) + "/5"} icon="⭐" />
        <Stat label="Current streak" value={st.current + " 🔥"} icon="🔥" sub={`longest ${st.longest}`} />
        <Stat label="Drill due" value={due} icon="🎴" sub={due ? "cards to review" : "all caught up"} />
        <Stat label="Top category" value={best?.label ?? "—"} icon="🏆" sub={best ? `${Math.round(best.pct * 100)}% mastered` : ""} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* skill radar */}
        <div className={`${cardCls} p-5`}>
          <h2 className="mb-1 text-[15px] font-extrabold">🧭 Skill radar</h2>
          <p className="mb-3 text-[12.5px] text-mut">Average coverage per category across all history.</p>
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
  /* generous viewBox so axis labels never clip at the edges */
  const W = 220, H = 224;
  const cx = W / 2, cy = H / 2;
  const R = 58;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (r: number) => data.map((_, i) => pt(i, r).join(",")).join(" ");
  const shape = data.map((d, i) => pt(i, Math.max(8, R * d.pct)).join(",")).join(" ");
  /* wrap long labels onto two lines instead of mid-word truncation */
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
