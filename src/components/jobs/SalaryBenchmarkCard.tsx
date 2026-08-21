import { cardCls, btnGhost, btnSm, Chip } from "../ui";
import type { CareerProfile, JobPosting } from "../../types";
import {
  BENCHMARK,
  BENCH_LEVELS,
  companyBands,
  fmtAmount,
  fmtBand,
  marketBand,
  MARKETS,
  negotiationPoints,
  offerVerdict,
  ordinal,
  positionInBand,
  positionRead,
  detectMarket,
  type BenchLevel,
  type Market,
} from "../../services/salaryBench";
import { toCurrency } from "../../services/currency";

export interface SalaryBenchmarkProps {
  profile: CareerProfile | null;
  jobs: JobPosting[];
  displayCurrency: string;
  benchLvl: BenchLevel;
  benchCo: string;
  benchOpen: boolean;
  market: Market;
  expected: string;
  offerOpen: boolean;
  offerBase: string;
  offerEquity: string;
  setBenchLvl: (l: BenchLevel) => void;
  setBenchCo: (v: string) => void;
  setBenchOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  setMarket: (m: Market) => void;
  setExpected: (v: string) => void;
  setOfferOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  setOfferBase: (v: string) => void;
  setOfferEquity: (v: string) => void;
}

export function SalaryBenchmarkCard({
  profile,
  jobs,
  displayCurrency,
  benchLvl,
  benchCo,
  benchOpen,
  market,
  expected,
  offerOpen,
  offerBase,
  offerEquity,
  setBenchLvl,
  setBenchCo,
  setBenchOpen,
  setMarket,
  setExpected,
  setOfferOpen,
  setOfferBase,
  setOfferEquity,
}: SalaryBenchmarkProps) {
  return (
    <div className={`${cardCls} mt-5 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 p-5">
        <div>
          <h3 className="text-[14.5px] font-extrabold">📊 Salary benchmark</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Indicative annual ranges for your seniority, plus real bands from the live feed.</p>
        </div>
        <button className={btnGhost + btnSm} onClick={() => setBenchOpen(o => !o)}>
          {benchOpen ? "Hide" : "Show"}
        </button>
      </div>
      {benchOpen && (
        <div className="p-5">
          {/* level chips + per-company filter */}
          <div className="flex flex-wrap items-center gap-2">
            {BENCH_LEVELS.map(l => (
              <button
                key={l}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-all ${benchLvl === l ? "bg-acc1/25 text-acctxt" : "bg-deep/40 text-mut hover:text-ink"}`}
                onClick={() => setBenchLvl(l)}
              >
                {BENCHMARK[l].label}
              </button>
            ))}
            <input
              className="inp ml-auto w-[150px] py-1.5 text-[12px]"
              placeholder="Filter by company…"
              value={benchCo}
              onChange={e => setBenchCo(e.target.value)}
            />
          </div>

          {/* market — auto-detected from the profile location, overridable */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Market</span>
            <select
              className="inp w-auto cursor-pointer py-1.5 text-[12px]"
              value={market.id}
              onChange={e => setMarket(MARKETS.find(m => m.id === e.target.value) ?? MARKETS[0])}
              title="Cost-of-living adjustment applied to the indicative ranges"
            >
              {MARKETS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            {market.id !== detectMarket(profile?.location).id && (
              <button
                className="text-[11px] font-bold text-acctxt hover:underline"
                onClick={() => setMarket(detectMarket(profile?.location))}
                title="Reset to the market auto-detected from your profile location"
              >
                ↺ use my location
              </button>
            )}
            <span className="text-[10.5px] text-mut">{market.note}</span>
          </div>

          {/* expected comp — percentile position within the level band */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Your expected comp</span>
            <input
              className="inp w-[150px] py-1.5 text-[12px]"
              type="number" min={0}
              placeholder={`annual, ${displayCurrency}`}
              value={expected}
              onChange={e => setExpected(e.target.value)}
              title={`Annual expected compensation in ${displayCurrency}`}
            />
            {expected && (() => {
              const mb = marketBand(BENCHMARK[benchLvl], market);
              const mbd = { min: toCurrency(mb.min, mb.currency, displayCurrency), max: toCurrency(mb.max, mb.currency, displayCurrency) };
              const pct = positionInBand(Number(expected) || 0, mbd.min, mbd.max);
              const read = positionRead(pct);
              return (
                <Chip tone={read.tone === "high" ? "ok" : read.tone === "low" ? "bad" : "co"}>
                  {ordinal(pct)} percentile — {read.label}
                </Chip>
              );
            })()}
          </div>

          {/* the user's level band + all levels for context, adjusted to the market */}
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {BENCH_LEVELS.map(l => {
              const active = l === benchLvl;
              const band = BENCHMARK[l];
              const mb = marketBand(band, market);
              const mbd = { min: toCurrency(mb.min, mb.currency, displayCurrency), max: toCurrency(mb.max, mb.currency, displayCurrency) };
              return (
                <div key={l} className={`rounded-xl border p-3.5 ${active ? "border-acc1/40 bg-acc1/10" : "border-line/15 bg-deep/30"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-extrabold">{band.label}</span>
                    {active && <Chip tone="co">your level</Chip>}
                  </div>
                  <div className="mt-1 text-[15px] font-extrabold text-acc1">{fmtBand(mbd.min, mbd.max, displayCurrency)}</div>
                  <div className="text-[10.5px] text-mut">{displayCurrency} · {market.label} · indicative market range</div>
                </div>
              );
            })}
          </div>

          {/* offer comparison — verdict + negotiation talking points */}
          <div className="mt-4 rounded-xl border border-line/15 bg-deep/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-extrabold">🤝 Compare an offer</p>
              <button className="text-[11px] font-bold text-acctxt hover:underline" onClick={() => setOfferOpen(o => !o)}>
                {offerOpen ? "Hide" : "Show"}
              </button>
            </div>
            {offerOpen && (
              <div className="mt-3 space-y-2.5">
                <div className="flex flex-wrap gap-2">
                  <input
                    className="inp w-[170px] py-1.5 text-[12px]"
                    type="number" min={0}
                    placeholder={`Base / yr (${displayCurrency})`}
                    value={offerBase}
                    onChange={e => setOfferBase(e.target.value)}
                  />
                  <input
                    className="inp w-[170px] py-1.5 text-[12px]"
                    type="number" min={0}
                    placeholder={`Equity / yr (${displayCurrency})`}
                    value={offerEquity}
                    onChange={e => setOfferEquity(e.target.value)}
                  />
                </div>
                {(() => {
                  if (!offerBase) return <p className="text-[11.5px] text-mut">Enter at least a base to compare it against the {BENCHMARK[benchLvl].label} band for {market.label}.</p>;
                  const mb = marketBand(BENCHMARK[benchLvl], market);
                  const mbd = { min: toCurrency(mb.min, mb.currency, displayCurrency), max: toCurrency(mb.max, mb.currency, displayCurrency) };
                  const offer = { base: Number(offerBase) || 0, equity: Number(offerEquity) || 0, currency: displayCurrency };
                  const v = offerVerdict(offer, mbd);
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone={v.kind === "below" ? "bad" : v.kind === "above" ? "ok" : "co"}>{v.label}</Chip>
                        <span className="text-[12px] text-fnt">Total {fmtAmount(v.total, displayCurrency)} · {ordinal(v.pct)} percentile of the band</span>
                      </div>
                      {v.kind === "below" && (
                        <p className="text-[11.5px] text-warn">Gap to the low end: {fmtAmount(v.gapToMin, displayCurrency)}</p>
                      )}
                      <ul className="space-y-1.5">
                        {negotiationPoints(offer, mbd, market, displayCurrency).map((p, i) => (
                          <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-fnt">
                            <span className="font-extrabold text-acc1">•</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* live bands from the feed — real data, never invented */}
          {(() => {
            const live = companyBands(jobs).filter(c => !benchCo || c.company.toLowerCase().includes(benchCo.toLowerCase()));
            const postingCount = live.reduce((n, c) => n + c.bands.filter(b => b.source === "posting").length, 0);
            const estCount = live.reduce((n, c) => n + c.bands.filter(b => b.source === "estimate").length, 0);
            if (!live.length) {
              return (
                <div className="mt-3 rounded-xl border border-dashed border-line/20 p-4 text-center">
                  <p className="text-[12px] font-bold">No live salary data{benchCo ? ` for "${benchCo}"` : " in the feed"} yet</p>
                  <p className="mt-0.5 text-[11px] text-mut">Postings rarely list bands. Add the Adzuna keys in Admin → Salary enrichment and re-ingest to fill estimates (labelled "est.").</p>
                </div>
              );
            }
            return (
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Live feed bands</span>
                  <Chip tone="lvl">{postingCount} posting{postingCount === 1 ? "" : "s"} · {estCount} est.</Chip>
                </div>
                <div className="mt-2 space-y-1.5">
                  {live.map(c => (
                    <div key={c.company} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/30 px-3 py-2 text-[12px]">
                      <span className="min-w-[120px] font-extrabold">{c.company}</span>
                      {c.median && (() => {
                        const md = { min: toCurrency(c.median.min, c.median.currency, displayCurrency), max: toCurrency(c.median.max, c.median.currency, displayCurrency) };
                        return <span className="font-bold text-acc1">{fmtBand(md.min, md.max, displayCurrency)}</span>;
                      })()}
                      <span className="text-[10.5px] text-mut">median of {c.bands.length} band{c.bands.length === 1 ? "" : "s"} {c.bands.some(b => b.source === "estimate") ? "(incl. est.)" : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <p className="mt-3 text-[10.5px] text-mut">Static ranges are indicative US-market baselines from public salary research, adjusted per market by cost-of-living multipliers and approximate FX — your real offer depends on company, equity and negotiation. Live bands come straight from the feed and are never adjusted.</p>
        </div>
      )}
    </div>
  );
}
