/* ScraperSection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import { FIELDS, LEVELS } from "../../data";
import { listScraperSources, getScraperSchedule, saveScraperSchedule, saveScraperSource, setScraperSourceEnabled, deleteScraperSource, runScraperNow, type ScraperSourceRow, type RunResult } from "../../services/scraper";
import { toast } from "../../toast";
import { btnPrimary, btnSm, btnOk, btnDanger, cardCls, Chip, Switch } from "../ui";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ------------------------------------------------------------------ */
/* Scraper — sources, schedule and run-now (all admin-configurable)     */
/* ------------------------------------------------------------------ */

export function ScraperSection({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [sources, setSources] = useState<ScraperSourceRow[]>([]);
  const [days, setDays] = useState<number[]>([1]);
  const [loading, setLoading] = useState(true);
  const [runReport, setRunReport] = useState<RunResult[] | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [fUrl, setFUrl] = useState("");
  const [fType, setFType] = useState<ScraperSourceRow["type"]>("markdown");
  const [fField, setFField] = useState(FIELDS[0]?.id ?? "frontend");
  const [fLevel, setFLevel] = useState("mid");
  const [fMax, setFMax] = useState(20);

  const load = () => {
    setLoading(true);
    void Promise.all([listScraperSources(), getScraperSchedule()])
      .then(([s, d]) => { setSources(s); setDays(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const toggleDay = (iso: number) => {
    setDays(ds => (ds.includes(iso) ? ds.filter(d => d !== iso) : [...ds, iso].sort()));
  };

  const saveSchedule = async () => {
    setBusy(true);
    try { await saveScraperSchedule(days); toast("🗓️ Schedule saved — the cron checks it daily"); }
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
              Which days the weekly scraper runs (03:00 UTC). The GitHub Actions workflow runs daily
              and skips days not selected here — no repo edits needed to change cadence.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((name, i) => {
              const iso = i + 1;
              const on = days.includes(iso);
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
          <button className={btnPrimary + btnSm} onClick={saveSchedule} disabled={busy}>💾 Save schedule</button>
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

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🕷️ Sources ({sources.length})</h2>
        <p className="mb-4 text-[12.5px] text-mut">
          Everything scraped lands in the Review inbox as a draft. Sources are read from here by the cron.
        </p>
        {loading && <p className="text-[12.5px] text-fnt"><span className="spinner" /> Loading…</p>}
        {!loading && sources.length === 0 && <p className="text-[13px] text-mut">No sources yet — add your first one below.</p>}
        <div className="space-y-2">
          {sources.map(s => (
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
                <Switch checked={s.enabled} onChange={v => toggleSource(s, v)} />
                <button className={btnDanger + btnSm} onClick={() => removeSource(s.id)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}
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
