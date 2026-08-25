import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useApp } from "../store";
import { toast } from "../toast";
import { avgScore, cardsDueToday, categoryMastery, scoresOverTime, streaks } from "../services/progress";
import { getCoachDiscussions } from "./CoachChat";
import { btnDanger, btnGhost, btnPrimary, btnSm, cardCls, Chip, EmptyState, Modal, ProgressBar } from "./ui";

export function History() {
  const { t } = useTranslation();
  const { state, openHistory, deleteHistory, clearHistory } = useApp();
  const { sessions } = state;
  const coach = getCoachDiscussions();
  const [confirmClear, setConfirmClear] = useState(false);
  const [openCoach, setOpenCoach] = useState<string | null>(null);

  if (!sessions.length && !coach.length) {
    return (
      <div className="anim-view">
        <EmptyState icon="🗂️" title={t("history.empty")}>
          <p className="text-sm text-mut">{t("history.emptyDesc")}</p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="anim-view">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🗂️ {t("history.title", { "1": "" })}</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight"><Trans i18nKey="history.title" components={{ 1: <span className="grad-text" /> }} /></h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">{t("history.desc")}</p>
      </div>

      <Dashboard sessions={sessions} />

      <div className="mt-6 flex justify-end">
        <button className={btnDanger + btnSm} onClick={() => setConfirmClear(true)}>Clear all history</button>
      </div>

      {coach.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[16px] font-extrabold">🤖 Coach discussions</h2>
            <span className="text-[12px] text-fnt">Saved chats with the AI coach — debates that shaped your focus plan</span>
          </div>
          <div className="space-y-3">
            {coach.map((d, i) => {
              const open = openCoach === String(i);
              return (
                <div key={i} className={`${cardCls} px-5 py-4`}>
                  <button type="button" className="flex w-full flex-wrap items-center gap-3 text-left" onClick={() => setOpenCoach(open ? null : String(i))}>
                    <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-acc1/15 text-lg">🤖</div>
                    <div className="min-w-[180px] flex-1">
                      <div className="text-[14px] font-extrabold leading-tight">{d.prompt}</div>
                      <div className="mt-0.5 text-[12px] text-mut">
                        {new Date(d.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        {open ? " · tap to hide" : " · tap to read"}
                      </div>
                    </div>
                    <Chip tone={d.mode === "api" ? "co" : "lvl"}>{d.mode === "api" ? "🤖 AI · API key" : "📚 Knowledge · offline"}</Chip>
                  </button>
                  {open && (
                    <div className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-deep/50 p-3 text-[12.5px] leading-relaxed text-ink">
                      {d.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {sessions.map(s => {
          const gradeTone = s.agg.grade === "A" || s.agg.grade === "B" ? "ok" : s.agg.grade === "C" ? "warn" : "bad";
          return (
            <div key={s.id} className={`${cardCls} flex flex-wrap items-center gap-3 px-5 py-4`}>
              <div className="grid h-11 w-11 flex-none place-items-center rounded-xl grad-bg text-lg font-extrabold text-white shadow-[0_6px_16px_rgba(99,102,241,.4)]">
                {s.agg.grade}
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="text-[14.5px] font-extrabold leading-tight">{s.meta.company} · {s.meta.field} · {s.meta.level}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-mut">
                  <span>{new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span>·</span>
                  <span>{s.answers.length} questions</span>
                  <span>·</span>
                  <span className="text-fnt">{s.agg.score.toFixed(1)}/5</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Chip tone={gradeTone as "ok"}>{Math.round(s.agg.pct * 100)}%</Chip>
                <button className={btnPrimary + btnSm} onClick={() => openHistory(s.id)}>Review</button>
                <button className={btnGhost + btnSm} onClick={() => { deleteHistory(s.id); toast("Session deleted"); }}>✕</button>
              </div>
            </div>
          );
        })}
      </div>

      {confirmClear && (
        <Modal onClose={() => setConfirmClear(false)} title="Clear all history?" desc="This removes every saved session. Your settings and question bank stay untouched.">
          <div className="flex gap-3">
            <button className={btnGhost} onClick={() => setConfirmClear(false)}>Cancel</button>
            <button className={btnDanger} onClick={() => { clearHistory(); setConfirmClear(false); toast("History cleared"); }}>Yes, clear everything</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- progress dashboard ---------- */

function Dashboard({ sessions }: { sessions: ReturnType<typeof useApp>["state"]["sessions"] }) {
  const st = streaks(sessions);
  const trend = scoresOverTime(sessions, 12);
  const mastery = categoryMastery(sessions);
  const due = cardsDueToday();
  const avg = avgScore(sessions);
  const maxPct = Math.max(...trend.map(t => t.pct), 0.01);
  const W = 280, H = 64;

  return (
    <div className={`${cardCls} mt-6 p-6`}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h2 className="text-[16px] font-extrabold">📈 Progress</h2>
        {st.current > 1 && <Chip tone="warn">🔥 {st.current}-day streak</Chip>}
        <span className="ml-auto text-[12.5px] text-fnt">Based on {sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat num={st.current} label="Current streak" icon="🔥" />
        <Stat num={st.longest} label="Longest streak" icon="🏆" />
        <Stat num={avg.toFixed(1)} label="Avg score / 5" icon="⭐" />
        <Stat num={due} label="Drill cards due" icon="🎴" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* score trend sparkline */}
        <div>
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-mut">Score trend</div>
          {trend.length >= 2 ? (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[320px]">
              <polyline
                points={trend.map((t, i) => `${(i / Math.max(1, trend.length - 1)) * W},${H - 4 - (t.pct / maxPct) * (H - 10)}`).join(" ")}
                fill="none" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              />
              {trend.map((t, i) => (
                <circle key={i} cx={(i / Math.max(1, trend.length - 1)) * W} cy={H - 4 - (t.pct / maxPct) * (H - 10)} r="2.5" fill="#a5b4fc" />
              ))}
            </svg>
          ) : (
            <p className="text-[13px] text-fnt">Complete more sessions to see your trend.</p>
          )}
        </div>

        {/* category mastery */}
        <div>
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-mut">Category mastery</div>
          <div className="space-y-2">
            {mastery.map(m => (
              <div key={m.label}>
                <div className="mb-0.5 flex justify-between text-[12px] font-semibold">
                  <span className="text-mut">{m.label}</span>
                  <span>{Math.round(m.pct * 100)}%</span>
                </div>
                <ProgressBar widthPct={Math.max(3, m.pct * 100)} height="h-[6px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ num, label, icon }: { num: string | number; label: string; icon: string }) {
  return (
    <div className="rounded-xl border border-line/10 bg-wht/5 px-3 py-2.5">
      <div className="text-[20px] font-extrabold leading-tight">{icon} {num}</div>
      <div className="text-[11.5px] font-semibold text-mut">{label}</div>
    </div>
  );
}
