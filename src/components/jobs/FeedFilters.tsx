import { memo } from "react";
import { EMPTY_FILTERS, type JobFilters } from "../../services/jobs";
import { btnGhost, btnSm, cardCls } from "../ui";

interface FeedSource {
  s: string;
  n: number;
  label: string;
}

interface FeedFiltersProps {
  filters: JobFilters;
  setFilters: React.Dispatch<React.SetStateAction<JobFilters>>;
  displayCurrency: string;
  setDisplayCurrency: (c: string) => void;
  feedSources: FeedSource[];
  jobCount: number;
}

export const FeedFilters = memo(function FeedFilters({
  filters, setFilters,
  displayCurrency, setDisplayCurrency,
  feedSources, jobCount,
}: FeedFiltersProps) {
  return (
    <div className={`${cardCls} mt-5`}>
      <div className="flex flex-wrap items-center gap-2 p-4">
        <input
          className="inp min-w-[160px] flex-1"
          placeholder="🔍 Search title, company, skill…"
          value={filters.query}
          onChange={e => setFilters(f => ({ ...f, query: e.target.value }))}
        />
        <select className="inp w-auto cursor-pointer" value={filters.remote === null ? "" : String(filters.remote)}
          onChange={e => setFilters(f => ({ ...f, remote: e.target.value === "" ? null : e.target.value === "true" }))}>
          <option value="">📍 Any location</option>
          <option value="true">🏠 Remote only</option>
          <option value="false">🏢 On-site only</option>
        </select>
        <select className="inp w-auto cursor-pointer" value={filters.companySize ?? ""}
          onChange={e => setFilters(f => ({ ...f, companySize: e.target.value || null }))}>
          <option value="">🏢 Any size</option>
          <option value="large">Large (1,000+ employees)</option>
          <option value="mid">Mid (50–999)</option>
          <option value="small">Small (&lt;50)</option>
        </select>
        <select
          className="inp w-auto cursor-pointer"
          value={displayCurrency}
          onChange={e => {
            const c = e.target.value;
            setDisplayCurrency(c);
            setFilters(f => ({ ...f, currency: c }));
          }}
          title="One currency for every salary in the app — postings are converted to it"
        >
          <option value="USD">💱 $ USD</option>
          <option value="INR">💱 ₹ INR</option>
          <option value="EUR">💱 € EUR</option>
          <option value="GBP">💱 £ GBP</option>
        </select>
        <input
          type="number" min={0} step={5000}
          className="inp w-[110px]"
          placeholder={`Min (${displayCurrency})`}
          value={filters.salaryMin ?? ""}
          onChange={e => setFilters(f => ({ ...f, salaryMin: e.target.value ? Number(e.target.value) : null }))}
          title={`Minimum annual salary (in ${displayCurrency}, converted)`}
        />
        {(filters.query || filters.remote !== null || filters.companySize || filters.currency || filters.salaryMin !== null || filters.salaryMax !== null || filters.source) && (
          <button className={btnGhost + btnSm} onClick={() => setFilters(EMPTY_FILTERS)}>✕ Clear</button>
        )}
      </div>
      {/* source chips */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-line/10 px-4 py-2.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-mut">Source:</span>
        <button
          className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold transition-all ${!filters.source ? "border-acc1/40 bg-acc1/15 text-acctxt" : "border-line/15 bg-deep/40 text-mut hover:text-ink"}`}
          onClick={() => setFilters(f => ({ ...f, source: null }))}
        >
          📦 All ({jobCount})
        </button>
        {feedSources.map(({ s, n, label }) => (
          <button
            key={s}
            className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold transition-all ${filters.source === s ? "border-acc1/40 bg-acc1/15 text-acctxt" : "border-line/15 bg-deep/40 text-mut hover:text-ink"}`}
            onClick={() => setFilters(f => ({ ...f, source: f.source === s ? null : s }))}
            title={`Only ${label} postings`}
          >
            {label} ({n})
          </button>
        ))}
      </div>
    </div>
  );
});
