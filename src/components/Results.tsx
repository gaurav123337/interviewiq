import type { CatStat } from "../types";
import { aggregate, topicSuggestions, verdict } from "../engine";
import { levelById } from "../data";
import { useApp } from "../store";
import { toast } from "../toast";
import { exportMd } from "../services/report";
import { btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, KpNeutral, ScoreBadge } from "./ui";

export function Results() {
  const { state, retry, newSession, practiceWeakTopics } = useApp();
  const { session, answers } = state;

  /* Completion is persisted by the store facade when the session ends, so this view is a pure presenter. */
  if (!session || !answers.length) return null;

  const agg = aggregate(answers);
  const topics = topicSuggestions(answers);
  const meta = session.meta;
  const strong = [...new Set(answers.filter(a => a.fb.score >= 4).map(a => a.q.catLabel))];
  const weak = [...new Set(answers.filter(a => a.fb.score <= 2).map(a => a.q.catLabel))];
  const topCat = agg.cats.slice().sort((a, b) => b.score - a.score)[0];
  const pct = agg.pct;
  const gradeTone = agg.grade === "A" || agg.grade === "B" ? "ok" : agg.grade === "C" ? "warn" : "bad";

  const onExport = () => {
    const md = exportMd(session, answers);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interviewiq-${meta.companyId || "general"}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("📄 Exported markdown report");
  };

  const onShare = async () => {
    const text = `InterviewIQ — ${meta.company} · ${meta.field} · ${meta.level}: ${(pct * 100).toFixed(0)}% (grade ${agg.grade})`;
    try {
      if (navigator.share) await navigator.share({ title: "InterviewIQ result", text });
      else { await navigator.clipboard.writeText(text); toast("Copied result to clipboard"); }
    } catch { toast("Share cancelled"); }
  };

  return (
    <div className="anim-view">
      {/* hero */}
      <div className="overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-b from-panel to-panel2 p-7 text-center shadow-[0_18px_50px_rgba(2,6,23,.55)] max-sm:p-5">
        <div className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">Session complete 🎉</div>
        <div className="mt-3 text-[64px] font-extrabold leading-none tracking-tight">
          {(pct * 100).toFixed(0)}<span className="text-[.45em] text-mut">%</span>
        </div>
        <div className={`mx-auto mt-2 w-fit rounded-full border px-4 py-1 text-sm font-extrabold ${
          gradeTone === "ok" ? "border-ok/40 bg-ok/10 text-ok" : gradeTone === "warn" ? "border-warn/40 bg-warn/10 text-warn" : "border-bad/40 bg-bad/10 text-bad"
        }`}>Grade {agg.grade}</div>
        <p className="mt-3 text-sm text-mut">{meta.company} · {meta.field} · {meta.level}</p>
        {session.meta.mode === "mock" && <VerdictBanner agg={agg} />}
        <div className="mx-auto mt-5 grid max-w-[560px] grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill num={answers.length} label="Questions" />
          <StatPill num={agg.score.toFixed(1)} label="Avg / 5" />
          <StatPill num={topCat ? topCat.score.toFixed(1) : "—"} label={`Best: ${topCat ? topCat.label : ""}`} />
          <StatPill num={answers.filter(a => a.fb.score >= 4).length} label="Strong answers" />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5 no-print">
          <button className={btnPrimary + btnSm} onClick={retry}>🔁 Practice again</button>
          <button className={btnGhost + btnSm} onClick={newSession}>New interview</button>
          <button className={btnGhost + btnSm} onClick={onExport}>⬇ Export .md</button>
          <button className={btnGhost + btnSm} onClick={() => window.print()}>🖨 Print</button>
          <button className={btnGhost + btnSm} onClick={onShare}>↗ Share</button>
        </div>
      </div>

      {/* breakdown grid */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={`${cardCls} p-5`}>
          <h3 className="text-[16px] font-extrabold">📡 Category breakdown</h3>
          <p className="mb-3 text-[13px] text-mut">Where you're strong and where to focus next.</p>
          <Radar cats={agg.cats} />
          <div className="mt-4 space-y-2.5">
            {agg.cats.map(c => (
              <div key={c.label}>
                <div className="mb-1 flex justify-between text-[12.5px] font-semibold">
                  <span className="text-mut">{c.label}</span>
                  <span className="text-ink">{c.score.toFixed(1)}/5</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full grad-bg transition-all duration-700" style={{ width: `${Math.max(3, c.pct * 100)}%` }} />
                </div>
              </div>
            ))}
            {!agg.cats.length && <p className="text-[13px] text-fnt">No categories yet.</p>}
          </div>
        </div>

        <div className={`${cardCls} p-5`}>
          <h3 className="text-[16px] font-extrabold">🧠 What to study next</h3>
          <p className="mb-3 text-[13px] text-mut">Topics you missed most often, straight from the question bank.</p>
          <div className="flex flex-wrap gap-2">
            {topics.length ? topics.map(t => <KpNeutral key={t}>{t}</KpNeutral>)
              : <Chip tone="ok">Strong coverage — no obvious gaps!</Chip>}
          </div>
          <div className="mt-4 space-y-1.5 text-[13px] text-mut">
            {weak.length > 0 && (
              <p>Revisit: <strong className="text-ink">{[...new Set(weak)].slice(0, 3).join(", ")}</strong> — open the Question Bank below.</p>
            )}
            {strong.length > 0 && (
              <p>Strengths: <strong className="text-ok">{[...new Set(strong)].slice(0, 3).join(", ")}</strong></p>
            )}
          </div>
          <button className={`${btnPrimary} ${btnSm} mt-5`} onClick={practiceWeakTopics}>🔁 Practice these topics</button>
        </div>
      </div>

      {/* per-question review */}
      <h3 className="mb-3 mt-8 text-[16px] font-extrabold">📋 Question review</h3>
      <div className="space-y-3">
        {answers.map((a, i) => (
          <details key={i} className={`${cardCls} group px-5 py-4`}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2.5">
              <ScoreBadge score={a.fb.score} />
              <Chip tone="cat">{a.q.catLabel}</Chip>
              <Chip tone="lvl">{levelById(a.q.level).name}</Chip>
              <span className="min-w-[180px] flex-1 text-[14.5px] font-bold leading-snug">Q{i + 1}. {a.q.q}</span>
              <span className="text-mut transition-transform group-open:rotate-90">▸</span>
            </summary>
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-[14px]">
              <div className="rounded-xl bg-[#080c18]/60 p-4">
                <div className="mb-1 text-[12.5px] font-bold uppercase tracking-wider text-mut">You</div>
                <p className="whitespace-pre-wrap leading-relaxed text-[#d7ddf0]">{a.user || "(no answer)"}</p>
              </div>
              <div className="rounded-xl border border-acc1/25 bg-acc1/10 p-4">
                <div className="mb-1 text-[12.5px] font-bold uppercase tracking-wider text-acc3">Model answer</div>
                <p className="whitespace-pre-wrap leading-relaxed text-[#d7ddf0]">{a.q.a}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(a.q.kp || []).map(k => <KpNeutral key={k}>{k}</KpNeutral>)}
              </div>
            </div>
          </details>
        ))}
      </div>

      <div className="mt-8 flex justify-center no-print">
        <button className={`${btnOk} px-8 py-4 text-[17px]`} onClick={newSession}>Start a new interview →</button>
      </div>
    </div>
  );
}

/* ---------- bits ---------- */
function VerdictBanner({ agg }: { agg: ReturnType<typeof aggregate> }) {
  const v = verdict(agg);
  const tone = v.tone === "hire"
    ? "border-ok/40 bg-ok/10 text-ok"
    : v.tone === "lean"
      ? "border-warn/40 bg-warn/10 text-warn"
      : "border-bad/40 bg-bad/10 text-bad";
  return (
    <div className={`mx-auto mt-4 w-fit rounded-2xl border px-6 py-3 ${tone}`}>
      <div className="text-[16px] font-extrabold uppercase tracking-[.16em]">{v.label}</div>
      <div className="mx-auto mt-1 max-w-[380px] text-[12.5px] leading-snug text-mut">{v.note}</div>
    </div>
  );
}

function StatPill({ num, label }: { num: string | number; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="text-[20px] font-extrabold leading-tight">{num}</div>
      <div className="text-[11.5px] font-semibold text-mut">{label}</div>
    </div>
  );
}

/* ---------- SVG radar ---------- */
function Radar({ cats }: { cats: CatStat[] }) {
  const n = cats.length;
  const W = 300, H = 250, cx = W / 2, cy = H / 2 + 4, R = 88;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r] as const;
  const ring = (g: number) => Array.from({ length: n + 1 }, (_, i) => pt(i % n, (R * g) / 4));

  if (!n) {
    return <div className="grid h-[220px] place-items-center text-sm text-fnt">No category data yet.</div>;
  }

  const poly = cats.map((c, i) => pt(i, R * Math.max(0.06, Math.min(1, c.pct))).join(",")).join(" ");

  return (
    <div className="grid place-items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[340px]">
        {[1, 2, 3, 4].map(g => (
          <polygon key={g} points={ring(g).map(p => p.join(",")).join(" ")} fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="1" />
        ))}
        {cats.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(148,163,184,.14)" strokeWidth="1" />;
        })}
        <polygon points={poly} fill="rgba(99,102,241,.25)" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" />
        {cats.map((c, i) => {
          const [x, y] = pt(i, R * Math.max(0.06, Math.min(1, c.pct)));
          return <circle key={i} cx={x} cy={y} r="3.5" fill="#a5b4fc" stroke="#0a0e1a" strokeWidth="1.5" />;
        })}
        {cats.map((c, i) => {
          const [x, y] = pt(i, R + 20);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="#c7ccdf">
              {c.label.length > 13 ? c.label.slice(0, 12) + "…" : c.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
