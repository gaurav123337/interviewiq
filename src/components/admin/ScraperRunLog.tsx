/* Scraper run log (Phase 4 Item B1) — what the scraper DID: one collapsible
   row per scraper_runs record, with server-side filters (status / trigger /
   date range / URL text) and "Load more" paging. cron rows are written by
   scripts/scrape-sources.js; manual rows by the "Run now" button. */

import { useEffect, useState } from "react";
import { listScraperRuns, type ScraperRunRow, type ScraperRunFilter, type ScraperRunTrigger, type RunResult } from "../../services/scraper";
import { toast } from "../../toast";
import { btnGhost, btnSm, cardCls, Chip } from "../ui";

/* ------------------------------------------------------------------ */
/* Date-range helpers (pure)                                           */
/* ------------------------------------------------------------------ */

export type RunDateRange = "all" | "24h" | "7d" | "30d" | "custom";

/** Maps a date-range chip to from/to ISO bounds (pure, unit-tested). */
export function rangeToBounds(range: RunDateRange, from: string, to: string, now = Date.now()): { from?: string; to?: string } {
  if (range === "24h") return { from: new Date(now - 24 * 3600_000).toISOString() };
  if (range === "7d") return { from: new Date(now - 7 * 24 * 3600_000).toISOString() };
  if (range === "30d") return { from: new Date(now - 30 * 24 * 3600_000).toISOString() };
  if (range === "custom") {
    return {
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined
    };
  }
  return {};
}

export const STATUS_META: Record<ScraperRunRow["status"], { icon: string; label: string }> = {
  ok: { icon: "✅", label: "OK" },
  partial: { icon: "⚠️", label: "Partial" },
  failed: { icon: "❌", label: "Failed" }
};

const TRIGGER_META: Record<ScraperRunTrigger, { icon: string; label: string }> = {
  cron: { icon: "🤖", label: "Cron" },
  manual: { icon: "🖱", label: "Manual" }
};

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function fmtAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function ScraperRunLog({ lastLocalRun, refreshKey }: { lastLocalRun: RunResult[] | null; refreshKey: number }) {
  const [filter, setFilter] = useState<ScraperRunFilter>({});
  const [range, setRange] = useState<RunDateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [qText, setQText] = useState("");
  const [rows, setRows] = useState<ScraperRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(10);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = (lim: number, replace: boolean) => {
    setLoading(true);
    const bounds = rangeToBounds(range, customFrom, customTo);
    const f: ScraperRunFilter = { ...filter, ...bounds };
    void listScraperRuns(f, lim)
      .then(r => {
        setRows(r);
        if (replace) setLimit(lim);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  /* re-query whenever filters change or a fresh run lands */
  useEffect(() => {
    load(limit, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, range, customFrom, customTo, refreshKey]);

  const clearFilters = () => {
    setFilter({});
    setRange("all");
    setCustomFrom("");
    setCustomTo("");
    setQText("");
  };

  const setF = (patch: Partial<ScraperRunFilter>) => setFilter(f => ({ ...f, ...patch }));

  const applyQ = () => setF({ q: qText.trim() || undefined });

  const pageMore = () => {
    const next = limit + 10;
    setLimit(next);
    load(next, true);
  };

  const hasActiveFilters = !!(filter.status || filter.trigger || filter.q || range !== "all");

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">🕷️ Scraper run log</h2>
          <p className="text-[12.5px] text-mut">
            What the scraper actually did — cron and manual runs, newest first. Green GH runs with no row here
            mean the workflow ran but skipped the day or extracted nothing.
          </p>
          <p className="mt-0.5 text-[11px] text-mut">
            {rows.length > 0
              ? <>Showing {rows.length} run(s) · newest {fmtAgo(rows[0].ranAt)}</>
              : loading ? "…" : "No runs recorded yet — they appear here after the cron or “Run now”."}
          </p>
        </div>
        <button className={btnGhost + btnSm} onClick={() => load(limit, true)} disabled={loading}>↻ Refresh</button>
      </div>

      {/* Filter bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["all", "ok", "partial", "failed"] as const).map(s => (
          <button
            key={s}
            onClick={() => setF({ status: s === "all" ? undefined : s })}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${((filter.status ?? "all") === s) ? "grad-bg text-white" : "border border-line/15 bg-wht/5 text-mut hover:bg-wht/10"}`}
          >
            {s === "all" ? "All" : `${STATUS_META[s].icon} ${STATUS_META[s].label}`}
          </button>
        ))}
        <select
          value={filter.trigger ?? ""}
          onChange={ev => setF({ trigger: (ev.target.value || undefined) as ScraperRunFilter["trigger"] })}
          className="inp text-[11px] w-[130px]"
        >
          <option value="">All triggers</option>
          <option value="cron">🤖 Cron</option>
          <option value="manual">🖱 Manual</option>
        </select>
        <select value={range} onChange={ev => setRange(ev.target.value as RunDateRange)} className="inp text-[11px] w-[110px]">
          <option value="all">All time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
          <option value="30d">Last 30d</option>
          <option value="custom">Custom…</option>
        </select>
        {range === "custom" && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="inp text-[11px] w-[150px]" />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="inp text-[11px] w-[150px]" />
          </>
        )}
        <input
          value={qText}
          onChange={e => setQText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") applyQ(); }}
          placeholder="Search source URLs…"
          className="inp text-[11px] w-[190px]"
        />
        {hasActiveFilters && <button className={btnGhost + btnSm} onClick={clearFilters}>Clear filters</button>}
      </div>

      {/* Rows (accordion) */}
      {loading && rows.length === 0 && <p className="mt-3 text-[12.5px] text-fnt"><span className="spinner" /> Loading…</p>}
      <div className="mt-3 space-y-2">
        {rows.map(r => {
          const meta = STATUS_META[r.status];
          const open = expanded === r.id;
          const sources = Object.entries(r.perSource);
          return (
            <div key={r.id} className="rounded-xl border border-line/10 bg-wht/5">
              <button
                onClick={() => setExpanded(open ? null : r.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
                <span className="text-[14px]">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-bold">{fmtWhen(r.ranAt)}</span>
                    <Chip tone="cat">{TRIGGER_META[r.trigger].icon} {TRIGGER_META[r.trigger].label}</Chip>
                    <span className="text-[11.5px] font-bold text-ok">+{r.inserted} draft(s)</span>
                    {r.errors > 0 && <span className="text-[11.5px] font-bold text-warn">{r.errors} error(s)</span>}
                  </div>
                  <div className="text-[11px] text-mut">{fmtAgo(r.ranAt)} · {sources.length} source(s)</div>
                </div>
              </button>
              {open && (
                <div className="border-t border-line/10 px-4 py-3">
                  {sources.length === 0 && <p className="text-[12px] text-mut">No per-source detail recorded for this run.</p>}
                  <div className="space-y-1.5">
                    {sources.map(([sid, p]) => (
                      <div key={sid} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-3 py-2 text-[12px]">
                        <span className="font-bold">{sid}</span>
                        <span className="min-w-[140px] flex-1 truncate text-mut" title={p.url}>{p.url}</span>
                        {p.error
                          ? <span className="font-bold text-warn">✗ {p.error}</span>
                          : <span className="font-bold text-ok">✓ {p.extracted ?? "?"} extracted · +{p.inserted ?? "?"} drafts</span>}
                      </div>
                    ))}
                  </div>
                  {sources.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-mut">Raw per-source JSON</summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-deep/60 p-2 text-[10.5px] leading-snug">{JSON.stringify(r.perSource, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!loading && rows.length === 0 && (
        <p className="mt-3 text-[12.5px] text-mut">
          {hasActiveFilters ? "No runs match these filters." : "No runs recorded yet — they appear after the cron or “Run now”."}
          {lastLocalRun && !hasActiveFilters && <> Your last local run found {lastLocalRun.length} source report(s).</>}
        </p>
      )}
      {rows.length >= limit && (
        <div className="mt-3 flex justify-center">
          <button className={btnGhost + btnSm} onClick={pageMore} disabled={loading}>Load more</button>
        </div>
      )}
    </div>
  );
}
