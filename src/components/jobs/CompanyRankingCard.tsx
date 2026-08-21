import { cardCls, btnGhost, btnSm, Chip, ProgressBar } from "../ui";
import type { CareerProfile, JobPosting } from "../../types";
import {
  EMPTY_RANK_FILTERS,
  VERDICT_META,
  recommendationReason,
  salaryLabel,
  type RankFilters,
  type CompanyRank,
} from "../../services/jobs";
import { currencySymbol } from "../../services/salaryBench";


/* verdict tone → text color (matches VERDICT_META tones) */
const verdictToneCls = (tone: string) =>
  tone === "ok" ? "text-ok" : tone === "co" ? "text-acctxt" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-mut";

export interface CompanyRankingProps {
  profile: CareerProfile | null;
  jobs: JobPosting[];
  filteredRanks: CompanyRank[];
  ranks: CompanyRank[];
  topPicks: CompanyRank[];
  gapImpact: { skill: string; from: number; to: number } | null;
  rankFilters: RankFilters;
  rankLimit: number;
  shortlist: Set<string>;
  displayCurrency: string;
  proGated: boolean;
  cloud: boolean;
  filterActive: boolean;
  addSkillToProfile: (s: string) => void;
  setRankFilters: (fn: RankFilters | ((f: RankFilters) => RankFilters)) => void;
  setRankLimit: (fn: number | ((n: number) => number)) => void;
  setUpgrade: (reason: string) => void;
  setApplyQueue: (jobs: JobPosting[]) => void;
  setRecsDigestOpen: (v: boolean) => void;
  showInFeed: (company: string) => void;
}

export function CompanyRankingCard({
  profile,
  jobs,
  filteredRanks,
  ranks,
  topPicks,
  gapImpact,
  rankFilters,
  rankLimit,
  shortlist,
  displayCurrency,
  proGated,
  cloud,
  filterActive,
  addSkillToProfile,
  setRankFilters,
  setRankLimit,
  setUpgrade,
  setApplyQueue,
  setRecsDigestOpen,
  showInFeed,
}: CompanyRankingProps) {
  const star = (company: string) => {
    const next = new Set(shortlist);
    if (next.has(company)) next.delete(company);
    else next.add(company);
    setRankFilters(f => ({ ...f, shortlistOnly: f.shortlistOnly })); // trigger re-render
  };
  const isStarred = (company: string) => shortlist.has(company);

  return (
    <div className={`${cardCls} mt-5 overflow-hidden`}>
      <div className="border-b border-line/10 p-5">
        <h3 className="text-[14.5px] font-extrabold">🏆 Best-fit companies ({filteredRanks.length}{filterActive && filteredRanks.length !== ranks.length ? ` of ${ranks.length}` : ""})</h3>
        <p className="mt-0.5 text-[11.5px] text-fnt">Every company in the feed, ranked by match % — a company's best open role wins. {profile ? "Scored from your uploaded resume." : "Upload your resume above (or save the profile) to score the list."}</p>
      </div>

      {/* ranking filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line/10 bg-wht/[.03] px-5 py-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line/15 bg-deep/40 px-3 py-1.5 text-[12px] font-bold">
          <input type="checkbox" className="h-3.5 w-3.5 accent-[#6366f1]" checked={rankFilters.remoteOnly}
            onChange={e => setRankFilters(f => ({ ...f, remoteOnly: e.target.checked }))} />
          🏠 Remote only
        </label>
        <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-mut">
          Match
          <select
            className="cursor-pointer rounded-full border border-line/20 bg-deep/40 px-2.5 py-1.5 text-[12px] font-bold text-fnt outline-none"
            value={rankFilters.minScore}
            onChange={e => setRankFilters(f => ({ ...f, minScore: Number(e.target.value) }))}
          >
            <option value={0}>any %</option>
            <option value={40}>40%+</option>
            <option value={60}>60%+</option>
            <option value={80}>80%+</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-mut">
          Min salary
          <input
            type="number" min={0} step={5000} className="w-[92px] rounded-full border border-line/20 bg-deep/40 px-2.5 py-1.5 text-[12px] font-bold text-fnt outline-none"
            placeholder={`${currencySymbol(displayCurrency)}0`}
            value={rankFilters.minSalary || ""}
            onChange={e => setRankFilters(f => ({ ...f, minSalary: e.target.value ? Number(e.target.value) : 0 }))}
            title={`Minimum annual salary of the best role (in ${displayCurrency})`}
          />
        </label>
        <button
          className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${rankFilters.shortlistOnly ? "grad-bg text-white" : "border border-line/15 bg-deep/40 text-mut hover:text-ink"}`}
          onClick={() => setRankFilters(f => ({ ...f, shortlistOnly: !f.shortlistOnly }))}
          disabled={shortlist.size === 0}
          title="Only companies you've starred"
        >
          ⭐ Shortlist ({shortlist.size})
        </button>
        {filterActive && (
          <button className="rounded-full border border-line/15 px-2.5 py-1.5 text-[11.5px] font-bold text-mut hover:text-ink" onClick={() => setRankFilters(EMPTY_RANK_FILTERS)}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* recommendations — top picks */}
      {profile && jobs.length > 0 && topPicks.length > 0 && topPicks[0].score > 0 && (
        <div className="border-b border-ok/20 bg-ok/[.07] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] font-extrabold text-ok">🏆 Recommendations — your top {topPicks.length} pick{topPicks.length === 1 ? "" : "s"}</p>
            <div className="flex items-center gap-2">
              {filterActive && (
                <button className="text-[11px] font-bold text-mut underline-offset-2 hover:text-ink hover:underline" onClick={() => setRankFilters(EMPTY_RANK_FILTERS)}>
                  ✕ show all companies
                </button>
              )}
              <button
                className="rounded-full border border-ok/25 bg-ok/10 px-2.5 py-0.5 text-[11.5px] font-bold text-ok transition-all hover:bg-ok/20"
                onClick={() => setRecsDigestOpen(true)}
                title="Preview or email this week's top picks"
              >
                📧 Email digest
              </button>
              <button
                className="rounded-full border border-ok/25 bg-ok/10 px-2.5 py-0.5 text-[11.5px] font-bold text-ok transition-all hover:bg-ok/20"
                onClick={() => setApplyQueue(topPicks.map(r => r.best))}
                title="Work through your top picks' best-fit roles in one apply queue"
              >
                📋 Apply to top picks
              </button>
            </div>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">
            Start with <span className="font-extrabold text-ok">{topPicks[0].company}</span> — {proGated ? "your match % is locked" : `${topPicks[0].score}% match (${VERDICT_META[topPicks[0].verdict].label.toLowerCase()})`} across {topPicks[0].openings} open role{topPicks[0].openings === 1 ? "" : "s"}, best fit: <span className="font-semibold">{topPicks[0].best.title}</span>.{" "}
            {!proGated && topPicks[0].matched.length > 0 && <>You already cover <span className="font-semibold">{topPicks[0].matched.slice(0, 4).join(", ")}</span>.</>}{" "}
            {!proGated && gapImpact && (
              <>Learn <span className="font-bold text-bad">{gapImpact.skill}</span> and {topPicks[0].company} jumps from {gapImpact.from}% → <span className="font-extrabold text-ok">{gapImpact.to}%</span>.</>
            )}
            {proGated && <button className="font-bold text-acc3 underline" onClick={() => setUpgrade("Match verdicts and the company ranking are Pro features.")}>Unlock Pro</button>}
          </p>
          <ul className="mt-3 space-y-1.5">
            {topPicks.map((r, i) => (
              <li key={r.company} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-ok/15 bg-deep/30 px-3 py-2">
                <span className="w-5 flex-none text-center text-[12px] font-extrabold text-ok">{i + 1}</span>
                <span className="text-[13px] font-extrabold">{r.company}</span>
                {proGated ? (
                  <span className="text-[12px] font-bold text-mut">🔒 {r.openings} open role{r.openings === 1 ? "" : "s"}</span>
                ) : (
                  <>
                    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${verdictToneCls(VERDICT_META[r.verdict].tone)} border-current/25 bg-current/10`}>{r.score}% · {VERDICT_META[r.verdict].label}</span>
                    <span className="text-[12px] text-mut">{r.openings} role{r.openings === 1 ? "" : "s"} · {r.best.title}</span>
                  </>
                )}
                {(() => { const s = salaryLabel(r.best, displayCurrency); return s ? <span className="text-[11.5px] font-bold text-ok">💰 {s}</span> : null; })()}
                {!proGated && r.missing.length > 0 && (
                  <span className="text-[11.5px] text-mut">gap: <span className="font-bold text-bad">{r.missing.slice(0, 2).join(", ")}</span></span>
                )}
                {!proGated && (
                  <span className="w-full text-[11.5px] leading-snug text-mut">💡 {recommendationReason(profile, r)}</span>
                )}
                <div className="ml-auto flex gap-1.5">
                  <button
                    className="rounded-full border border-ok/30 bg-ok/5 px-2.5 py-0.5 text-[11.5px] font-bold text-ok transition-all hover:bg-ok/15"
                    onClick={() => setApplyQueue([r.best])}
                    title="Apply to this best-fit role"
                  >
                    📮 Apply next
                  </button>
                  <button
                    className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
                    onClick={() => showInFeed(r.company)}
                    title="Filter the match feed to this company and jump to it"
                  >
                    🔎 Show in feed
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* nothing clears the bar yet */}
      {profile && jobs.length > 0 && topPicks.length > 0 && topPicks[0].score === 0 && (
        <div className="border-b border-warn/20 bg-warn/[.07] px-5 py-4">
          <p className="text-[12.5px] font-extrabold text-warn">🏆 Recommendation</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">
            Nothing in the feed clears a match yet — the closest gap is <span className="font-bold text-bad">{topPicks[0].missing.slice(0, 3).join(", ") || "a skills mismatch"}</span>. Add those skills to your profile and re-rank, or upload a fuller resume.
          </p>
        </div>
      )}

      {!profile ? (
        <div className="p-10 text-center">
          <div className="text-[26px]">📄</div>
          <p className="mt-2 text-[13.5px] font-bold">Upload your resume to rank companies</p>
          <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-mut">Your skills drive the match — drop a .pdf / .txt above and every company in the feed gets a match %, sorted best first.</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-10 text-center">
          <div className="text-[26px]">🕳️</div>
          <p className="mt-2 text-[13.5px] font-bold">No companies to rank yet</p>
          <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-mut">{cloud ? 'Tap "Refresh feed" to pull live jobs and rank them.' : "Sign in to fetch the live feed, then come back here."}</p>
        </div>
      ) : filteredRanks.length === 0 ? (
        <div className="p-10 text-center">
          <div className="text-[26px]">🔍</div>
          <p className="mt-2 text-[13.5px] font-bold">No companies match these filters</p>
          <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-mut">{rankFilters.shortlistOnly ? "Star some companies with ☆ to build a shortlist, or " : ""}clear the filters to see the full ranking.</p>
          <button className={btnGhost + btnSm + " mt-3"} onClick={() => setRankFilters(EMPTY_RANK_FILTERS)}>✕ Clear filters</button>
        </div>
      ) : (
        <ul className="divide-y divide-line/10">
          {filteredRanks.slice(0, rankLimit).map((r, i) => (
            <li key={r.company} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-6 flex-none text-center text-[13px] font-extrabold text-mut">{i + 1}</span>
                <div className="min-w-[190px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className={`text-[15px] leading-none transition-all ${isStarred(r.company) ? "text-amber-300" : "text-mut opacity-50 hover:opacity-100"}`}
                      onClick={() => star(r.company)}
                      title={isStarred(r.company) ? "Remove from shortlist" : "Add to shortlist"}
                    >
                      {isStarred(r.company) ? "★" : "☆"}
                    </button>
                    <span className="text-[14px] font-extrabold">{r.company}</span>
                    {i === 0 && <Chip tone="ok">🏆 Best fit</Chip>}
                  </div>
                  <div className="mt-0.5 text-[12px] text-mut">{r.openings} open role{r.openings === 1 ? "" : "s"} · best fit: {r.best.title}</div>
                </div>
                <div className="w-[132px] flex-none">
                  {proGated ? (
                    <button
                      className="rounded-full border border-line/15 bg-wht/10 px-3 py-1 text-[12px] font-extrabold text-mut transition-all hover:text-ink"
                      onClick={() => setUpgrade("Match verdicts and the company ranking are Pro features.")}
                      title="Pro feature"
                    >
                      🔒 Match %
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-extrabold text-acctxt">{r.score}%</span>
                        <span className={`text-[10px] font-extrabold uppercase tracking-wide ${VERDICT_META[r.verdict].tone === "ok" ? "text-ok" : VERDICT_META[r.verdict].tone === "co" ? "text-acctxt" : VERDICT_META[r.verdict].tone === "warn" ? "text-warn" : VERDICT_META[r.verdict].tone === "bad" ? "text-bad" : "text-mut"}`}>{VERDICT_META[r.verdict].label}</span>
                      </div>
                      <ProgressBar widthPct={Math.max(4, r.score)} height="h-1.5" className="mt-1 bg-deep/60" />
                    </>
                  )}
                </div>
              </div>
              {!proGated && (r.matched.length > 0 || r.missing.length > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-9 text-[12px]">
                  {r.matched.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-mut">You have:</span>
                      {r.matched.slice(0, 5).map(s => (
                        <Chip key={s} tone="ok" title="Appears in your resume">✓ {s}</Chip>
                      ))}
                      {r.matched.length > 5 && <span className="text-[11.5px] text-mut">+{r.matched.length - 5} more</span>}
                    </span>
                  )}
                  {r.missing.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Gap:</span>
                      {r.missing.slice(0, 4).map(s => (
                        <button
                          key={s}
                          className="inline-flex items-center gap-1 rounded-full border border-bad/30 bg-bad/10 px-2 py-0.5 text-[11.5px] font-semibold text-bad transition-all hover:bg-bad/20"
                          onClick={() => addSkillToProfile(s)}
                          title={`Add "${s}" to my profile skills`}
                        >
                          {s} <span className="text-[10px] opacity-60">+add</span>
                        </button>
                      ))}
                      {r.missing.length > 4 && <span className="text-[11.5px] text-mut">+{r.missing.length - 4} more</span>}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-2 pl-9">
                <button
                  className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
                  onClick={() => showInFeed(r.company)}
                  title="Filter the match feed to this company and jump to it"
                >
                  🔎 Show in feed
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {profile && jobs.length > 0 && filteredRanks.length > rankLimit && (
        <div className="border-t border-line/10 p-4 text-center">
          <button className={btnGhost + btnSm} onClick={() => setRankLimit(l => l + 10)}>
            Show more — {filteredRanks.length - rankLimit} more company{filteredRanks.length - rankLimit === 1 ? "" : "ies"}
          </button>
        </div>
      )}
    </div>
  );
}
