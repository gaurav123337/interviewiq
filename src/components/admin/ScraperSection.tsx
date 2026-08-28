/* ScraperSection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import { FIELDS, LEVELS } from "../../data";
import { listScraperSources, getScraperSchedule, saveScraperSchedule, saveScraperSource, setScraperSourceEnabled, deleteScraperSource, saveScraperSourceSchedule, runScraperNow, type ScraperSourceRow, type ScraperSchedule, type RunResult } from "../../services/scraper";
import { toast } from "../../toast";
import { btnPrimary, btnSm, btnOk, btnDanger, btnGhost, cardCls, Chip, Switch } from "../ui";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ------------------------------------------------------------------ */
/* Scraper — sources, schedule and run-now (all admin-configurable)     */
/* ------------------------------------------------------------------ */

export function ScraperSection({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [sources, setSources] = useState<ScraperSourceRow[]>([]);
  const [schedule, setSchedule] = useState<ScraperSchedule>({ days: [1], hour: 3, minute: 0 });
  const [loading, setLoading] = useState(true);
  const [runReport, setRunReport] = useState<RunResult[] | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [fUrl, setFUrl] = useState("");
  const [fType, setFType] = useState<ScraperSourceRow["type"]>("markdown");
  const [fField, setFField] = useState(FIELDS[0]?.id ?? "frontend");
  const [fLevel, setFLevel] = useState("mid");
  const [fMax, setFMax] = useState(20);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  /* Scraper run history — stored in localStorage */
  type RunHistoryEntry = { timestamp: string; sources: number; inserted: number; errors: number; details: RunResult[] };
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  useEffect(() => {
    try { setRunHistory(JSON.parse(localStorage.getItem("scraper_run_history") || "[]")); } catch { setRunHistory([]); }
  }, []);
  const saveRunHistory = (entry: RunHistoryEntry) => {
    const next = [entry, ...runHistory].slice(0, 50); // keep last 50 runs
    setRunHistory(next);
    localStorage.setItem("scraper_run_history", JSON.stringify(next));
  };

  const load = () => {
    setLoading(true);
    void Promise.all([listScraperSources(), getScraperSchedule()])
      .then(([s, sc]) => { setSources(s); setSchedule(sc); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleDay = (iso: number) => {
    setSchedule(sc => ({ ...sc, days: sc.days.includes(iso) ? sc.days.filter(d => d !== iso) : [...sc.days, iso].sort() }));
  };

  const saveSchedule = async () => {
    setBusy(true);
    try { await saveScraperSchedule(schedule); toast("🗓️ Schedule saved — the cron checks it daily"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const addSource = async () => {
    if (!fUrl.trim().startsWith("http")) { toast("Enter a valid source URL"); return; }
    setBusy(true);
    try {
      await saveScraperSource({ url: fUrl.trim(), type: fType, fieldId: fField, level: fLevel, maxItems: fMax });
      toast("➕ Source added — it will be scraped on the next scheduled run");
      setFUrl("");
      await load();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const toggleSource = async (s: ScraperSourceRow, enabled: boolean) => {
    setBusy(true);
    try { await setScraperSourceEnabled(s.id, enabled); await load(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const removeSource = async (id: string) => {
    setBusy(true);
    try { await deleteScraperSource(id); toast("Source removed"); await load(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const runNow = async () => {
    const enabled = sources.filter(s => s.enabled);
    if (!enabled.length) { toast("Enable at least one source first"); return; }
    setRunBusy(true); setRunReport(null);
    try {
      const report = await runScraperNow(sources);
      setRunReport(report);
      const ok = report.filter(r => !r.error);
      const added = report.reduce((n, r) => n + r.inserted, 0);
      const errors = report.filter(r => r.error).length;
      saveRunHistory({ timestamp: new Date().toISOString(), sources: ok.length, inserted: added, errors, details: report });
      toast(`🕷️ Ran ${ok.length}/${report.length} source(s) — ${added} draft(s) landed in the Review inbox`);
    } catch (e) { toast("✗ " + ((e as Error).message || "Run failed")); }
    finally { setRunBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">🗓️ Schedule</h2>
            <p className="text-[12.5px] text-mut">
              Which days and time the scraper runs (UTC). The GitHub Actions workflow runs daily
              and skips days not selected here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES.map((name, i) => {
                const iso = i + 1;
                const on = schedule.days.includes(iso);
                return (
                  <button
                    key={name}
                    onClick={() => toggleDay(iso)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${on ? "grad-bg text-white" : "border border-line/15 bg-wht/5 text-mut hover:bg-wht/10"}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-mut font-bold">at</span>
              <select value={schedule.hour} onChange={ev => setSchedule(sc => ({ ...sc, hour: Number(ev.target.value) }))} className="inp text-[11px] w-[70px]">
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
              </select>
              <span className="text-[11px] text-mut font-bold">UTC</span>
            </div>
            <button className={btnPrimary + btnSm} onClick={saveSchedule} disabled={busy}>💾 Save schedule</button>
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <h2 className="text-[16px] font-extrabold">▶ Run now</h2>
            <p className="text-[12.5px] text-mut">
              Fetches every enabled source from this browser and upserts new questions as drafts —
              same pipeline as the cron, no waiting.
            </p>
          </div>
          <button className={btnOk + btnSm} onClick={runNow} disabled={runBusy || busy}>
            {runBusy ? <><span className="spinner" /> Scraping…</> : `🕷️ Run now (${sources.filter(s => s.enabled).length} sources)`}
          </button>
        </div>
        {runReport && runReport.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {runReport.map(r => (
              <div key={r.sourceId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-wht/5 px-3 py-2 text-[12.5px]">
                <span className="font-bold">{r.sourceId}</span>
                <span className="min-w-[120px] flex-1 truncate text-fnt">{r.url}</span>
                {r.error
                  ? <span className="font-bold text-warn">✗ {r.error}</span>
                  : <span className="font-bold text-ok">✓ +{r.inserted} drafts (from {r.extracted} extracted)</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {runHistory.length > 0 && (
        <div className={`${cardCls} p-5`}>
          <h2 className="mb-3 text-[16px] font-extrabold">📋 Run History ({runHistory.length})</h2>
          <div className="space-y-2">
            {runHistory.slice(0, 10).map((h, idx) => {
              const ts = new Date(h.timestamp);
              const timeAgo = (() => {
                const diff = Date.now() - ts.getTime();
                if (diff < 60000) return "just now";
                if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                return ts.toLocaleDateString();
              })();
              return (
                <div key={idx} className="flex items-center gap-3 rounded-xl border border-line/10 bg-wht/5 px-4 py-3">
                  <span className="text-[14px]">{h.errors === 0 ? "🟢" : "🟡"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold">{h.inserted} draft(s) added</span>
                      <span className="text-[11px] text-mut">from {h.sources} source(s)</span>
                      {h.errors > 0 && <span className="text-[11px] text-warn">{h.errors} error(s)</span>}
                    </div>
                    <div className="text-[11px] text-mut">{timeAgo} · {ts.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🕷️ Sources ({sources.length})</h2>
        <p className="mb-4 text-[12.5px] text-mut">
          Everything scraped lands in the Review inbox as a draft. Sources are read from here by the cron.
        </p>
        {loading && <p className="text-[12.5px] text-fnt"><span className="spinner" /> Loading…</p>}
        {!loading && sources.length === 0 && <p className="text-[13px] text-mut">No sources yet — add your first one below.</p>}
        <div className="space-y-2">
          {sources.map(s => (<>
            <div key={s.id} className="flex items-start gap-3 rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={s.enabled ? "ok" : "default"}>{s.enabled ? "ON" : "OFF"}</Chip>
                  <Chip tone="cat">{FIELDS.find(f => f.id === s.fieldId)?.name ?? s.fieldId}</Chip>
                  <Chip tone="lvl">{LEVELS.find(l => l.id === s.level)?.name ?? s.level}</Chip>
                  <span className="text-[11.5px] font-bold text-fnt">{s.type}</span>
                  <span className="text-[11.5px] text-fnt">max {s.maxItems}</span>
                </div>
                <div className="mt-1 truncate text-[13px] font-bold">{s.url}</div>
                {s.note && <div className="text-[11.5px] text-mut">{s.note}</div>}
              </div>
              <div className="flex flex-none items-center gap-2">
                <button className={btnGhost + btnSm} onClick={() => setExpandedSource(expandedSource === s.id ? null : s.id)}>
                  🗓 {expandedSource === s.id ? "Hide" : "Schedule"}
                </button>
                <Switch checked={s.enabled} onChange={v => toggleSource(s, v)} />
                <button className={btnDanger + btnSm} onClick={() => removeSource(s.id)} disabled={busy}>Delete</button>
              </div>
            </div>
            {/* Per-source schedule override */}
            {expandedSource === s.id && (
              <div className="ml-10 mt-2 rounded-lg border border-line/10 bg-deep/40 p-3">
                <div className="mb-2 text-[12px] font-bold text-mut">🗓 Schedule Override</div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1">
                    {DAY_NAMES.map((name, i) => {
                      const iso = i + 1;
                      const currentDays = s.scheduleOverride?.days ?? [];
                      const on = currentDays.includes(iso);
                      const cls = on ? "grad-bg text-white" : "border border-line/15 bg-wht/5 text-mut";
                      const toggleDay = () => {
                        const current = s.scheduleOverride?.days ?? [];
                        const next = on ? current.filter(d => d !== iso) : [...current, iso].sort();
                        void saveScraperSourceSchedule(s.id, { days: next, hour: s.scheduleOverride?.hour ?? 3, minute: 0 }).then(() => load());
                      };
                      return (
                        <button key={name} onClick={toggleDay} className={`rounded px-2 py-1 text-[10.5px] font-bold transition-colors ${cls}`}>{name}</button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-mut">at</span>
                  <select value={s.scheduleOverride?.hour ?? 3} onChange={ev => {
                    const override = { days: s.scheduleOverride?.days ?? [1], hour: Number(ev.target.value), minute: 0 };
                    void saveScraperSourceSchedule(s.id, override).then(() => load());
                  }} className="inp text-[10px] w-[60px]">
                    {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
                  </select>
                  <span className="text-[10px] text-mut">UTC</span>
                  <button className={btnGhost + btnSm} onClick={() => { void saveScraperSourceSchedule(s.id, null).then(() => { toast("Using global schedule"); load(); }); }}>Reset to global</button>
                </div>
                <p className="mt-1.5 text-[10.5px] text-mut">Leave all days unchecked to use the global schedule.</p>
              </div>
            )}
          </>))}
        </div>

        <div className="mt-4 rounded-xl border border-line/10 bg-deep/40 p-4">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-mut">➕ Add a source</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_130px_130px_110px_90px]">
            <input value={fUrl} onChange={e => setFUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/…/README.md" className="inp" />
            <select value={fType} onChange={e => setFType(e.target.value as ScraperSourceRow["type"])} className="inp">
              <option value="markdown">markdown</option>
              <option value="json">json</option>
              <option value="html">html</option>
            </select>
            <select value={fField} onChange={e => setFField(e.target.value)} className="inp">
              {FIELDS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={fLevel} onChange={e => setFLevel(e.target.value)} className="inp">
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input type="number" min={1} value={fMax} onChange={e => setFMax(Number(e.target.value))} className="inp" title="Max items per run" />
          </div>
          <button className={`${btnPrimary + btnSm} mt-3`} onClick={addSource} disabled={busy}>Add source</button>
        </div>
      </div>
    </div>
  );
}
