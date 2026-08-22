import { CODING_PROBLEMS, type CodingProblem } from "../../data/coding";
import { PATTERN_LABELS } from "../../data/patterns";
import { companyFrequency, companyInterviewPlan, freqForProblem, hasPersonalSignals, personalPlan, problemIsForCompany } from "../../data/codingCompanies";
import { Difficulty } from "../ui";

const ALL_CATS = ["All", "Algorithms", "Functions", "UI components"] as const;
type CatFilter = (typeof ALL_CATS)[number];

const DIFF_COLOR: Record<number, string> = { 1: "text-ok", 2: "text-warn", 3: "text-bad" };

const catOf = (p: CodingProblem): string =>
  p.kind === "cli" ? "Algorithms" : p.kind === "fn" ? "Functions" : "UI components";

interface ProblemListProps {
  search: string;
  setSearch: (v: string) => void;
  cat: CatFilter;
  setCat: (v: CatFilter) => void;
  patternFilter: string | null;
  setPatternFilter: (v: string | null) => void;
  patternCounts: Map<string, number>;
  companyFilter: string | null;
  setCompanyFilter: (v: string | null) => void;
  goalCompany: { id: string; name: string; icon: string } | null;
  dailyId: string;
  problemId: string;
  pickProblem: (id: string) => void;
  proGated: boolean;
}

export function ProblemList({
  search, setSearch, cat, setCat,
  patternFilter, setPatternFilter, patternCounts,
  companyFilter, setCompanyFilter, goalCompany,
  dailyId, problemId, pickProblem, proGated,
}: ProblemListProps) {
  const companyPlan = companyFilter ? companyInterviewPlan(companyFilter) : [];
  const companyFreq = companyFilter ? companyFrequency(companyFilter) : null;
  const personalSignals = hasPersonalSignals();
  const focusRanks = companyFilter && personalSignals ? personalPlan(companyFilter) : [];

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-line/10 bg-gradient-to-b from-panel to-panel2 p-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search problems…"
          className="editor-surface w-full rounded-xl px-3 py-2 text-[13px] placeholder:text-fnt"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {ALL_CATS.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${cat === c ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
            >
              {c}
            </button>
          ))}
        </div>
        {patternCounts.size > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-line/10 pt-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-fnt">Pattern:</span>
            <button
              onClick={() => setPatternFilter(null)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${patternFilter === null ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
            >
              All
            </button>
            {[...patternCounts.keys()].sort().map(p => (
              <button
                key={p}
                onClick={() => setPatternFilter(p)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${patternFilter === p ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
              >
                {PATTERN_LABELS[p] ?? p} <span className="opacity-70">({patternCounts.get(p)})</span>
              </button>
            ))}
          </div>
        )}
        {goalCompany && (
          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-line/10 pt-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-fnt">Target:</span>
            <button
              onClick={() => setCompanyFilter(null)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${companyFilter === null ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
            >
              All
            </button>
            <button
              onClick={() => setCompanyFilter(goalCompany.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${companyFilter === goalCompany.id ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
            >
              {goalCompany.icon} For {goalCompany.name}
            </button>
          </div>
        )}
      </div>

      {companyFilter && goalCompany && companyPlan.length > 0 && companyFreq && (
        <div className="rounded-2xl border border-acc1/30 bg-acc1/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[12px] font-extrabold text-acctxt">🎯 Your {goalCompany.name} plan</div>
            <div className="rounded-full bg-acc1/15 px-2 py-0.5 text-[10.5px] font-bold text-acctxt">
              {companyFreq.total} problems · 🔥{companyFreq.heat}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {([1, 2, 3] as const).map(d => (
              <div key={d} className="rounded-lg border border-line/10 bg-deep/60 px-2 py-1.5">
                <div className={`text-[10px] font-extrabold uppercase ${DIFF_COLOR[d]}`}>
                  {["Easy", "Medium", "Hard"][d - 1]}
                </div>
                <div className="mt-0.5 flex items-baseline justify-between">
                  <span className="text-[13px] font-extrabold text-ink">{companyFreq.byDifficulty[d].count}</span>
                  <span className="text-[10px] font-bold text-acctxt">🔥{companyFreq.byDifficulty[d].heat}</span>
                </div>
              </div>
            ))}
          </div>
          {companyFreq.byTopic.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mut">By topic</div>
              {companyFreq.byTopic.slice(0, 4).map(t => {
                const max = companyFreq.byTopic[0].heat;
                return (
                  <div key={t.topic} className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className="w-[92px] shrink-0 truncate font-semibold text-ink">{t.topic}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-deep">
                      <div
                        className={`h-full rounded-full ${t.hottest && freqForProblem(companyFilter, t.hottest.id) >= 3 ? "grad-bg" : "bg-acc1/60"}`}
                        style={{ width: `${Math.max(10, Math.round((t.heat / max) * 100))}%` }}
                      />
                    </div>
                    <span className="w-3 text-right font-bold text-mut">{t.count}</span>
                    <span className="w-7 text-right font-bold text-acctxt">🔥{t.heat}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-mut">
            {focusRanks.length ? "🎯 Your focus plan — personalized" : "🔥 Focus first"}
          </div>
          {!personalSignals && (
            <div className="mt-0.5 text-[10px] text-mut">Complete sessions and practice to personalize this.</div>
          )}
          <div className="mt-1 flex flex-col gap-1.5">
            {(focusRanks.length
              ? focusRanks.map(r => ({ id: r.problem.id, title: r.problem.title, kind: r.problem.kind, difficulty: r.problem.difficulty, freq: r.freq, tag: r.misses >= 2 ? `missed ×${r.misses}` : r.misses === 1 ? "missed" : r.weakSrc === "skill" ? "weak skill" : r.weakSrc === "session" ? "missed in interviews" : r.weakSrc === "coach" ? "discussed with coach" : null }))
              : companyPlan.map(p => ({ id: p.id, title: p.title, kind: p.kind, difficulty: p.difficulty, freq: freqForProblem(companyFilter, p.id), tag: null }))
            ).map(item => (
              <button
                key={item.id}
                onClick={() => pickProblem(item.id)}
                className="flex items-center gap-2 rounded-xl border border-line/10 bg-deep/60 px-3 py-2 text-left text-[12.5px] font-bold text-ink transition-all hover:border-acc1/40"
              >
                <span>{item.kind === "fn" ? "🧩" : "⚙️"}</span>
                <span className="flex-1 truncate">{item.title}</span>
                {item.tag && (
                  <span className="rounded-full bg-warn/15 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-warn">🎯 {item.tag}</span>
                )}
                <span className="text-[10px] font-bold text-acctxt">🔥{item.freq}</span>
                <span className={`text-[10.5px] font-extrabold uppercase ${DIFF_COLOR[item.difficulty]}`}>
                  {["Easy", "Medium", "Hard"][item.difficulty - 1]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {CODING_PROBLEMS.filter(p =>
        (cat === "All" || catOf(p) === cat) &&
        (!companyFilter || problemIsForCompany(p, companyFilter)) &&
        (!patternFilter || (p.kind === "cli" && p.pattern === patternFilter)) &&
        p.title.toLowerCase().includes(search.trim().toLowerCase())
      ).map(p => (
        <button
          key={p.id}
          onClick={() => pickProblem(p.id)}
          className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${p.id === problemId ? "grad-bg-soft border-acc1/40" : "border-line/10 bg-gradient-to-b from-panel to-panel2 hover:border-acc1/30"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className={`flex items-center gap-1.5 text-[13.5px] font-bold ${p.id === problemId ? "text-acctxt" : "text-ink"}`}>
              <span className="text-[11px]">{p.kind === "fn" ? "🧩" : p.kind === "ui" ? "🎨" : "⚙️"}</span>
              {p.title}
              {p.id === dailyId && <span className="rounded-full bg-acc2/15 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-acc2">🎯 Daily</span>}
            </span>
            <span className="flex items-center gap-1">
              {goalCompany && problemIsForCompany(p, goalCompany.id) && (
                <span className="text-[10px]" title={`Asked at ${goalCompany.name}`}>{goalCompany.icon}</span>
              )}
              <span className={`text-[11px] font-extrabold uppercase ${DIFF_COLOR[p.difficulty]}`}>
                {["Easy", "Medium", "Hard"][p.difficulty - 1]}
              </span>
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <Difficulty level={p.difficulty} />
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-fnt">
              {p.kind === "cli" && p.pattern && (
                <span className="rounded-full bg-acc1/10 px-1.5 py-0.5 font-bold text-acctxt">{PATTERN_LABELS[p.pattern] ?? p.pattern}</span>
              )}
              {p.kind === "ui" && proGated ? "🎨 UI · 🔒 Pro" : catOf(p)}
            </span>
          </div>
        </button>
      ))}
      <p className="px-1 pt-1 text-[11.5px] leading-relaxed text-fnt">
        {CODING_PROBLEMS.length} problems · ⚙️ compile on the free Wandbox API · 🧩 functions run locally in your browser · 🎨 UI components are judged on the rendered DOM, fully offline{goalCompany ? ` · problems tagged ${goalCompany.icon} are asked at ${goalCompany.name}` : ""}.
      </p>
    </div>
  );
}
