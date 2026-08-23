import { RagHealthTab } from "./quality";
import { useMemo, useState } from "react";
import { FIELDS, LEVELS } from "../../data";
import { codingProblemById } from "../../data/coding";
import { getPublishedQuestions } from "../../services/remoteConfig";
import { mergeQuality, touchQuestion } from "../../services/quality";
import { useAllQualityData } from "../../hooks/useQueryHooks";
import { toast } from "../../toast";
import { cardCls, btnGhost, btnSm, Chip, QualityBar, Seg } from "../ui";

/* ------------------------------------------------------------------ */
/* Quality Center — scoreboard, calibration, staleness, feedback       */

const QUALITY_TABS = [
  { value: "scoreboard", label: "📊 Scoreboard" },
  { value: "calibration", label: "🎚️ Calibration" },
  { value: "staleness", label: "⏳ Staleness" },
  { value: "feedback", label: "💬 Feedback" },
  { value: "coding", label: "💻 Coding" },
  { value: "coach", label: "🎯 Coach gaps" },
  { value: "rag", label: "🛰️ RAG health" }
] as const;


export function QualitySection({
  busy, setBusy, onApplyHardFloor, onStageTuning
}: {
  busy: boolean;
  setBusy: (b: boolean) => void;
  /** Stages a suggested hard floor into the Product config draft (auto-tune). */
  onApplyHardFloor: (v: number) => void;
  /** Stages a playground pick (cutoff + hard floor) into the config draft. */
  onStageTuning: (minSim: number, hardFloor: number) => void;
}) {
  const { data, isLoading, refetch } = useAllQualityData();
  const { rows, feed, coding, coachGaps, ragRows, ragDigest, ragDocs, ragDomains, kbSuggestions, kbDocs } = data;
  const [tab, setTab] = useState<(typeof QUALITY_TABS)[number]["value"]>("scoreboard");
  const [cutoff, setCutoff] = useState(90);
  const [refreshed, setRefreshed] = useState<Set<string>>(new Set());
  const [gapMin, setGapMin] = useState(5);
  const gapAlerts = coachGaps.filter(g => g.discussions >= gapMin);
  const draftGuide = (topic: string) => {
    const t = `Deep-dive guide: ${topic}

Concepts to cover:
- 
- 

Key points interviewers look for:
- 
- 

Common traps:
- 
- 

Practice questions:
- 
`;
    navigator.clipboard.writeText(t).then(() => toast("📋 Guide template copied — paste it into the deep-dive bank"), () => toast("✗ Clipboard blocked — copy manually"));
  };

  const bank = getPublishedQuestions();
  const merged = useMemo(
    () => mergeQuality(rows, bank.map(b => ({ question: b.question, updatedAt: b.updatedAt }))),
    [rows, bank]
  );
  const stale = merged
    .filter(m => m.staleDays != null && m.staleDays > cutoff)
    .sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0));

  const load = () => refetch();

  const touch = async (question: string) => {
    const q = bank.find(b => b.question === question);
    if (!q) return;
    setBusy(true);
    try {
      await touchQuestion(q.id);
      setRefreshed(s => new Set(s).add(question));
      toast("✓ Marked reviewed — staleness clock restarted");
      load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  /* calibration bands — pass rate 0-20 / 20-40 / … / 80-100 */
  const confident = merged.filter(m => m.attempts >= 5);
  const tooEasy = confident.filter(m => m.passRate > 90);
  const tooHard = confident.filter(m => m.passRate < 30);
  const bins = [0, 20, 40, 60, 80].map(low => {
    const items = merged.filter(m => m.passRate >= low && m.passRate < low + 20);
    return { low, count: items.length };
  });
  const maxBin = Math.max(1, ...bins.map(b => b.count));

  const bandTone = { healthy: "ok", watch: "warn", fix: "bad" } as const;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[16px] font-extrabold">🔎 Content quality center</h2>
        <p className="text-[12.5px] text-mut">
          Every question that real users answered, scored on performance, difficulty, feedback and freshness.
          The composite score (0-100) is: avg score · pass-rate band · 👍/👎/🚩 · days since review.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Seg
          options={QUALITY_TABS.map(t => t.value === "coach" && gapAlerts.length > 0 ? { ...t, label: `${t.label} · ${gapAlerts.length}` } : t)}
          value={tab}
          onChange={v => setTab(v)}
        />
        <button className={btnGhost + btnSm} onClick={load} disabled={busy}>↻ Refresh</button>
      </div>

      {isLoading && rows.length === 0 && <p className="text-center text-mut"><span className="spinner inline-block" /> Crunching session data…</p>}

      {tab === "scoreboard" && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-line/10 p-5">
            <h3 className="text-[15px] font-extrabold">📊 Scoreboard ({merged.length} questions with data)</h3>
            <p className="text-[12.5px] text-mut">Worst first. Low-attempt rows are low-confidence — check before acting.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
                  <th className="px-5 py-3 font-bold">Question</th>
                  <th className="px-3 py-3 font-bold">Field · level</th>
                  <th className="px-3 py-3 font-bold">Attempts</th>
                  <th className="px-3 py-3 font-bold">Avg</th>
                  <th className="px-3 py-3 font-bold">Miss</th>
                  <th className="px-3 py-3 font-bold">Pass</th>
                  <th className="px-3 py-3 font-bold">Feedback</th>
                  <th className="px-3 py-3 font-bold">Stale</th>
                  <th className="px-3 py-3 font-bold">Quality</th>
                  <th className="px-5 py-3 font-bold" />
                </tr>
              </thead>
              <tbody>
                {merged.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-10 text-center text-mut">No scored sessions yet — complete an interview and come back.</td></tr>
                )}
                {merged.map(m => (
                  <tr key={m.question} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                    <td className="max-w-[300px] px-5 py-3">
                      <div className="truncate font-bold">{m.question}</div>
                      <div className="text-[11.5px] text-fnt">
                        {m.attempts < 5 ? "⚠️ low confidence" : `last ${m.lastSeen ? new Date(m.lastSeen).toLocaleDateString() : "—"}`}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Chip tone="cat">{FIELDS.find(f => f.id === m.fieldId)?.name ?? m.fieldId}</Chip>
                      <span className="ml-1 text-[11.5px] text-fnt">{LEVELS.find(l => l.id === m.level)?.name ?? m.level}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{m.attempts}</td>
                    <td className="px-3 py-3 font-bold tabular-nums">{m.avgScore}/5</td>
                    <td className="px-3 py-3 tabular-nums text-bad">{m.missRate}%</td>
                    <td className="px-3 py-3 tabular-nums text-ok">{m.passRate}%</td>
                    <td className="px-3 py-3 tabular-nums">
                      <span className="text-ok">👍{m.ups}</span> <span className="text-bad">👎{m.downs}</span> <span className="text-warn">🚩{m.flags}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{m.staleDays == null ? "—" : m.staleDays + "d"}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <QualityBar score={m.score} />
                        <Chip tone={bandTone[m.band]}>{m.score}</Chip>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {bank.some(b => b.question === m.question) && !refreshed.has(m.question) ? (
                        <button className={btnGhost + btnSm} onClick={() => touch(m.question)} disabled={busy}>✓ Reviewed</button>
                      ) : bank.some(b => b.question === m.question) ? (
                        <Chip tone="ok">✓ fresh</Chip>
                      ) : (
                        <span className="text-[11.5px] text-fnt" title="Curated question shipped in code — versioned with the app">in code</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "calibration" && (
        <div className="space-y-4">
          <div className={`${cardCls} p-5`}>
            <h3 className="text-[15px] font-extrabold">🎚️ Difficulty calibration ({confident.length} questions with ≥5 attempts)</h3>
            <p className="text-[12.5px] text-mut">
              Pass rate = % of answers scored ≥3/5. The healthy band is 30-90%: under 30% the question is
              too hard or badly worded; over 90% it's too easy to be worth the user's time.
            </p>
            <div className="mt-4 flex h-[140px] items-end gap-3">
              {bins.map(b => (
                <div key={b.low} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="text-[11px] font-bold tabular-nums text-fnt">{b.count}</div>
                  <div
                    className={`w-full max-w-[80px] rounded-t-lg ${b.low === 40 || b.low === 60 ? "bg-ok/70" : b.low === 20 || b.low === 80 ? "bg-warn/60" : "bg-bad/60"}`}
                    style={{ height: Math.max(4, (b.count / maxBin) * 100) + "px" }}
                  />
                  <div className="text-[10.5px] font-bold text-mut">{b.low}–{b.low + 20}%</div>
                </div>
              ))}
            </div>
          </div>
          {tooEasy.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="mb-2 text-[15px] font-extrabold text-ok">✅ Too easy (&gt;90% pass) — consider leveling up or replacing</h3>
              <ul className="space-y-1.5">
                {tooEasy.map(m => <li key={m.question} className="text-[13px] text-mut">• {m.question} <span className="text-fnt">({m.passRate}% · {m.attempts} attempts)</span></li>)}
              </ul>
            </div>
          )}
          {tooHard.length > 0 && (
            <div className={`${cardCls} p-5`}>
              <h3 className="mb-2 text-[15px] font-extrabold text-bad">🔴 Too hard or unclear (&lt;30% pass) — review wording & model answer</h3>
              <ul className="space-y-1.5">
                {tooHard.map(m => <li key={m.question} className="text-[13px] text-mut">• {m.question} <span className="text-fnt">({m.passRate}% · {m.attempts} attempts)</span></li>)}
              </ul>
            </div>
          )}
          {confident.length === 0 && <p className="text-center text-mut">Not enough data yet — outliers appear once questions have ≥5 attempts.</p>}
        </div>
      )}

      {tab === "staleness" && (
        <div className={`${cardCls} p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <h3 className="text-[15px] font-extrabold">⏳ Staleness queue ({stale.length})</h3>
              <p className="text-[12.5px] text-mut">
                Questions not edited or marked reviewed for {cutoff}+ days. Interview topics churn — refresh
                anything the market has moved past. (Curated code questions aren't listed; they ship with the app.)
              </p>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] font-bold text-mut">
              Stale after
              <select value={cutoff} onChange={e => setCutoff(Number(e.target.value))} className="inp w-[90px]">
                {[60, 90, 120, 180, 270, 365].map(d => <option key={d} value={d}>{d}d</option>)}
              </select>
            </label>
          </div>
          <div className="mt-3 space-y-2">
            {stale.length === 0 && <p className="py-6 text-center text-[13px] text-mut">Nothing stale — the bank is healthy. 🎉</p>}
            {stale.map(m => (
              <div key={m.question} className="flex flex-wrap items-center gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold">{m.question}</div>
                  <div className="text-[11.5px] text-fnt">
                    {m.staleDays}d since last edit · avg {m.avgScore}/5 · {m.attempts} attempts
                  </div>
                </div>
                <Chip tone={(m.staleDays ?? 0) > 270 ? "bad" : (m.staleDays ?? 0) > 180 ? "warn" : "default"}>{(m.staleDays ?? 0)}d</Chip>
                <button className={btnGhost + btnSm} onClick={() => touch(m.question)} disabled={busy || refreshed.has(m.question)}>
                  {refreshed.has(m.question) ? "✓ done" : "✓ Reviewed"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "feedback" && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-[15px] font-extrabold">💬 Recent answer feedback ({feed.length})</h3>
          <p className="mb-3 text-[12.5px] text-mut">👍/👎/🚩 from every user, signed in or not — the most direct quality signal there is.</p>
          <div className="space-y-2">
            {feed.length === 0 && <p className="py-6 text-center text-[13px] text-mut">No feedback yet — it appears as users rate answers in the app.</p>}
            {feed.map((f, i) => (
              <div key={i} className="flex flex-wrap items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
                <span className="text-[16px]">{f.kind === "up" ? "👍" : f.kind === "down" ? "👎" : "🚩"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold">{f.question}</div>
                  {f.reason && <div className="mt-0.5 text-[12.5px] text-warn">“{f.reason}”</div>}
                  <div className="mt-0.5 text-[11.5px] text-fnt">
                    {f.fieldId && <>{FIELDS.find(x => x.id === f.fieldId)?.name ?? f.fieldId} · </>}
                    {f.level && <>{LEVELS.find(l => l.id === f.level)?.name ?? f.level} · </>}
                    {new Date(f.createdAt).toLocaleString()}
                  </div>
                </div>
                <Chip tone={f.kind === "up" ? "ok" : f.kind === "down" ? "bad" : "warn"}>{f.kind}</Chip>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "coding" && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-line/10 p-5">
            <h3 className="text-[15px] font-extrabold">💻 Coding scoreboard ({coding.length} problems with attempts)</h3>
            <p className="text-[12.5px] text-mut">
              Pass rate per playground problem from real full-suite runs. Under 30% pass = too hard or broken prompt;
              over 90% = too easy. Problems are versioned with the app — a bad one is fixed in the next release.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
                  <th className="px-5 py-3 font-bold">Problem</th>
                  <th className="px-3 py-3 font-bold">Kind</th>
                  <th className="px-3 py-3 font-bold">Attempts</th>
                  <th className="px-3 py-3 font-bold">Passed</th>
                  <th className="px-3 py-3 font-bold">Pass rate</th>
                  <th className="px-3 py-3 font-bold">Flag</th>
                  <th className="px-5 py-3 font-bold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {coding.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-mut">No coding attempts yet — users solve problems in the 💻 Playground and the scoreboard fills in.</td></tr>
                )}
                {coding
                  .slice()
                  .sort((a, b) => a.passRate - b.passRate || b.attempts - a.attempts)
                  .map(c => {
                    const p = codingProblemById(c.problemId);
                    const label = p ? `${p.kind === "fn" ? "🧩" : p.kind === "ui" ? "🎨" : "⚙️"} ${p.title}` : c.problemId;
                    const tone = c.attempts >= 5 && c.passRate < 30 ? "bad" : c.attempts >= 5 && c.passRate > 90 ? "warn" : "ok";
                    const note = c.attempts >= 5 && c.passRate < 30 ? "too hard / broken" : c.attempts >= 5 && c.passRate > 90 ? "too easy" : "healthy";
                    return (
                      <tr key={c.problemId} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                        <td className="px-5 py-3 font-bold">{label}</td>
                        <td className="px-3 py-3">{p ? (p.kind === "fn" ? "function" : p.kind === "ui" ? "UI component" : "CLI algorithm") : "—"}</td>
                        <td className="px-3 py-3 tabular-nums">{c.attempts}</td>
                        <td className="px-3 py-3 tabular-nums">{c.passes}</td>
                        <td className={`px-3 py-3 font-bold tabular-nums ${c.passRate < 30 ? "text-bad" : c.passRate > 90 ? "text-warn" : "text-ok"}`}>{c.passRate}%</td>
                        <td className="px-3 py-3"><Chip tone={tone}>{note}</Chip></td>
                        <td className="px-5 py-3 text-[12.5px] text-fnt">{c.lastSeen ? new Date(c.lastSeen).toLocaleDateString() : "—"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "coach" && (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-line/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[15px] font-extrabold">🎯 Coach gaps ({coachGaps.length} topics debated)</h3>
              <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
                Alert at
                <input
                  type="number" min={1} value={gapMin}
                  onChange={e => setGapMin(Math.max(1, Number(e.target.value) || 5))}
                  className="inp w-16 py-1 text-center"
                />
                discussions
              </label>
            </div>
            <p className="mt-1 text-[12.5px] text-mut">
              Weak coding topics users saved from AI-coach discussions (queued as coach_discussion events).
              Topics at or above the alert threshold get flagged for a deep-dive guide.
            </p>
            {gapAlerts.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[12px] font-extrabold uppercase tracking-wider text-bad">🚨 Guide opportunities ({gapAlerts.length})</div>
                {gapAlerts.map(g => (
                  <div key={g.topic} className="flex flex-wrap items-center gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-[12.5px]">
                    <span className="flex-1 font-bold">{g.topic}</span>
                    <Chip tone="bad">{g.discussions} discussions · {g.users} users</Chip>
                    <button className={btnGhost + btnSm} onClick={() => draftGuide(g.topic)}>✍️ Draft guide</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
                  <th className="px-5 py-3 font-bold">Topic</th>
                  <th className="px-3 py-3 font-bold">Discussions</th>
                  <th className="px-3 py-3 font-bold">Users</th>
                  <th className="px-5 py-3 font-bold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {coachGaps.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-mut">No coach discussions saved yet — users save chats in the 🤖 AI Coach and the gaps fill in.</td></tr>
                )}
                {coachGaps.map(g => (
                  <tr key={g.topic} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                    <td className="px-5 py-3 font-bold">{g.topic}</td>
                    <td className="px-3 py-3 tabular-nums">{g.discussions}</td>
                    <td className="px-3 py-3 tabular-nums">{g.users}</td>
                    <td className="px-5 py-3 text-[12.5px] text-fnt">{g.lastSeen ? new Date(g.lastSeen).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "rag" && <RagHealthTab
        ragRows={ragRows}
        ragDigest={ragDigest}
        ragDocs={ragDocs}
        ragDomains={ragDomains}
        kbSuggestions={kbSuggestions}
        kbDocs={kbDocs}
        busy={busy}
        onApplyHardFloor={onApplyHardFloor} onStageTuning={onStageTuning}
        onRefresh={load}
      />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
