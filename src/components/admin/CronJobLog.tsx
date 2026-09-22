/* Cron job log (Phase 4 Item B2) — pipeline health for the GitHub Actions
   workflows, from the public REST API (no token; 403/404 degrade to a message
   + link). Each collapsible row shows run metadata, a best-effort step list,
   and the paired scraper_runs row (nearest cron run within ±30 min) so a run
   shows pipeline health AND per-source results side by side. */

import { useEffect, useRef, useState } from "react";
import {
  listWorkflowRuns, pairRunToScraperRow, ghRangeToCreated, WORKFLOWS,
  type GhWorkflowRun, type GhRunFilter, type GhRange
} from "../../services/ghActions";
import { listScraperRuns, type ScraperRunRow } from "../../services/scraper";
import { btnGhost, btnSm, cardCls, Chip } from "../ui";

function conclusionMeta(r: GhWorkflowRun): { icon: string; cls: string } {
  if (r.status !== "completed") return { icon: "🟡", cls: "text-warn" };
  if (r.conclusion === "success") return { icon: "🟢", cls: "text-ok" };
  if (r.conclusion === "skipped") return { icon: "⚪", cls: "text-mut" };
  return { icon: "🔴", cls: "text-bad" };
}

function fmtDur(sec: number | null): string {
  if (sec == null) return "";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

interface StepRow { name: string; conclusion: string | null; status: string }

export function CronJobLog() {
  const [workflow, setWorkflow] = useState(WORKFLOWS[0].id);
  const [filter, setFilter] = useState<GhRunFilter>({});
  const [range, setRange] = useState<GhRange>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [runs, setRuns] = useState<GhWorkflowRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(10);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [steps, setSteps] = useState<Record<number, StepRow[]>>({});
  const [paired, setPaired] = useState<Record<number, ScraperRunRow | null>>({});
  const [scraperRuns, setScraperRuns] = useState<ScraperRunRow[]>([]);

  const load = (lim: number) => {
    setLoading(true);
    const created = ghRangeToCreated(range, customFrom, customTo);
    const f: GhRunFilter = { ...filter, ...(created ? { created } : {}) };
    void Promise.all([
      listWorkflowRuns(workflow, f, lim),
      listScraperRuns({ trigger: "cron" }, 50)
    ])
      .then(([gh, sr]) => {
        setError(gh.error ?? null);
        setRuns(gh.runs);
        setScraperRuns(sr);
        const pairMap: Record<number, ScraperRunRow | null> = {};
        for (const r of gh.runs) pairMap[r.id] = gh.error ? null : pairRunToScraperRow(r, sr);
        setPaired(pairMap);
      })
      .catch(() => setError("Could not reach GitHub"))
      .finally(() => setLoading(false));
  };

  /* Re-query on filter changes (paging calls load() directly so the effect
     doesn't double-fetch when `limit` changes). The closure reads the current
     render's limit, so a filter change preserves the loaded page size. */
  const limitRef = useRef(limit);
  limitRef.current = limit;
  useEffect(() => {
    load(limitRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow, filter, range, customFrom, customTo]);

  const setF = (patch: Partial<GhRunFilter>) => setFilter(f => ({ ...f, ...patch }));

  const pageMore = () => {
    const next = limit + 10;
    setLimit(next);
    load(next);
  };

  const openSteps = async (r: GhWorkflowRun) => {
    setExpanded(expanded === r.id ? null : r.id);
    if (steps[r.id]) return;
    try {
      const repo = "gaurav123337/interviewiq";
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${r.id}/jobs?per_page=5`);
      if (!res.ok) return;
      const body = (await res.json()) as {
        jobs?: { steps?: { name: string; conclusion: string | null; status: string }[] }[];
      };
      const job = body.jobs?.[0];
      if (job?.steps) setSteps(s => ({ ...s, [r.id]: job.steps! }));
    } catch { /* best-effort — metadata rows still render */ }
  };

  const hasActiveFilters = !!(filter.status || filter.conclusion || range !== "7d");

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">⏰ Cron job log (GitHub Actions)</h2>
          <p className="text-[12.5px] text-mut">
            Whether the scheduled pipelines themselves ran — checkout failures, missing secrets and skipped
            days show here even when they leave no scraper row.
          </p>
        </div>
        <a
          href="https://github.com/gaurav123337/interviewiq/actions"
          target="_blank"
          rel="noreferrer"
          className={btnGhost + btnSm}
        >Open in GitHub ↗</a>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
          {error} — open the <a className="underline" href="https://github.com/gaurav123337/interviewiq/actions" target="_blank" rel="noreferrer">Actions page</a> instead.
        </p>
      )}

      {/* Filter bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={workflow} onChange={ev => setWorkflow(ev.target.value)} className="inp text-[11px] w-[250px]">
          {WORKFLOWS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
        </select>
        {([
          ["", "All"],
          ["success", "🟢 Success"],
          ["failure", "🔴 Failed"],
          ["in_progress", "🟡 Running/Queued"]
        ] as const).map(([v, label]) => (
          <button
            key={v || "all"}
            onClick={() => setF(v ? { conclusion: v as GhRunFilter["conclusion"] } : { conclusion: undefined, status: undefined })}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${((filter.conclusion ?? "") === v) ? "grad-bg text-white" : "border border-line/15 bg-wht/5 text-mut hover:bg-wht/10"}`}
          >
            {label}
          </button>
        ))}
        <select value={range} onChange={ev => setRange(ev.target.value as GhRange)} className="inp text-[11px] w-[110px]">
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
        {hasActiveFilters && (
          <button className={btnGhost + btnSm} onClick={() => { setFilter({}); setRange("7d"); setCustomFrom(""); setCustomTo(""); }}>Clear filters</button>
        )}
      </div>

      {/* Rows */}
      {loading && runs.length === 0 && <p className="mt-3 text-[12.5px] text-fnt"><span className="spinner" /> Loading…</p>}
      <div className="mt-3 space-y-2">
        {runs.map(r => {
          const meta = conclusionMeta(r);
          const open = expanded === r.id;
          const pair = paired[r.id];
          const runSteps = steps[r.id];
          return (
            <div key={r.id} className="rounded-xl border border-line/10 bg-wht/5">
              <button onClick={() => void openSteps(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
                <span className="text-[14px]">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-bold">{r.name || workflow}</span>
                    <Chip tone="cat">{r.event === "schedule" ? "⏰ schedule" : r.event === "workflow_dispatch" ? "🖱 dispatch" : r.event}</Chip>
                    <span className="text-[11.5px] text-mut">{fmtWhen(r.createdAt)}</span>
                    {r.durationSec != null && <span className="text-[11.5px] text-mut">· {fmtDur(r.durationSec)}</span>}
                  </div>
                  <div className="text-[11px] text-mut">
                    {r.conclusion ?? r.status}{r.headBranch ? ` · ${r.headBranch}` : ""}
                    {pair ? " · 🕷 paired scraper row below" : r.status === "completed" && r.conclusion === "success" ? " · ran but no scraper row (skipped/nothing extracted)" : ""}
                  </div>
                </div>
              </button>
              {open && (
                <div className="border-t border-line/10 px-4 py-3 text-[12px]">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <span className="text-mut">Run #{r.id}</span>
                    <span className="text-mut">branch: {r.headBranch || "—"}</span>
                    <span className="text-mut">actor: {r.actor ?? "—"}</span>
                    <span className="text-mut">started: {r.runStartedAt ? fmtWhen(r.runStartedAt) : "—"}</span>
                  </div>
                  {runSteps && runSteps.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-[11px] font-bold text-mut uppercase tracking-wider">Steps (first job)</div>
                      {runSteps.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span>{s.conclusion === "success" ? "✅" : s.conclusion === "failure" ? "❌" : s.conclusion === "skipped" ? "⚪" : "🟡"}</span>
                          <span className="text-mut">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 rounded-lg border border-line/10 bg-deep/40 p-3">
                    {pair ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">🕷 Paired scraper run</span>
                          <Chip tone="cat">{new Date(pair.ranAt).toLocaleString()}</Chip>
                          <span className="font-bold text-ok">+{pair.inserted} draft(s)</span>
                          {pair.errors > 0 && <span className="font-bold text-warn">{pair.errors} error(s)</span>}
                        </div>
                        <div className="mt-1.5 space-y-1">
                          {Object.entries(pair.perSource).map(([sid, p]) => (
                            <div key={sid} className="flex flex-wrap items-center gap-2 text-[11.5px]">
                              <span className="font-bold">{sid}</span>
                              <span className="flex-1 truncate text-mut" title={p.url}>{p.url}</span>
                              {p.error
                                ? <span className="font-bold text-warn">✗ {p.error}</span>
                                : <span className="font-bold text-ok">✓ {p.extracted ?? "?"} ext · +{p.inserted ?? "?"}</span>}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <span className="text-mut">
                        {scraperRuns.length === 0
                          ? "No cron scraper rows recorded yet."
                          : "No scraper_runs row within ±30 min of this run — the workflow ran but skipped the day or extracted nothing."}
                      </span>
                      )}
                  </div>
                  <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11.5px] text-acctxt underline">Open run in GitHub ↗</a>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!loading && runs.length === 0 && !error && (
        <p className="mt-3 text-[12.5px] text-mut">No workflow runs match these filters.</p>
      )}
      {runs.length >= limit && (
        <div className="mt-3 flex justify-center">
          <button className={btnGhost + btnSm} onClick={pageMore} disabled={loading}>Load more</button>
        </div>
      )}
    </div>
  );
}
