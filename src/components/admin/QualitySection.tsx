import { useEffect, useMemo, useState } from "react";
import { FIELDS, LEVELS } from "../../data";
import { codingProblemById } from "../../data/coding";
import { cloudFnHeaders } from "../../services/cloud";
import { CONFIG } from "../../config";
import { aiAvailable } from "../../ai";
import { listPdfChunks, listPdfDocuments, type PdfDocumentRow } from "../../services/admin";
import { getPublishedQuestions } from "../../services/remoteConfig";
import { reindexDocument } from "../../services/indexer";
import {
  adminCoachGaps, adminCodingQuality, adminFeedbackFeed, adminKbSuggestions, adminQuestionQuality,
  adminRagDocuments, adminRagDomains, adminRagHealth, adminRagWeeklyDigest, bestTuningCell, evaluateRagDigest,
  mergeQuality, ragHealthSummary, ragHistogram, simulateTuning, suggestHardFloor, touchQuestion,
  type CodingQualityRow, type CoachGapRow, type FeedbackFeedRow, type KbSuggestionRow, type QualityRow,
  type RagDocRow, type RagDomainRow, type RagHealthRow, type RagWeeklyDigest
} from "../../services/quality";
import { effectiveGroundingMinSim, effectiveHardFloor, getRagDigestOpts } from "../../services/rag";
import { STORAGE_KEYS, storageGet, storageSet } from "../../services/storage";
import { weekKey } from "../../services/notifications";
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


/* playground grid — candidate (cutoff, hard floor) pairs to simulate */
const PLAY_MINSIMS = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75];
const PLAY_FLOORS = [0.75, 0.8, 0.85, 0.9, 0.95];

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
  const [rows, setRows] = useState<QualityRow[]>([]);
  const [feed, setFeed] = useState<FeedbackFeedRow[]>([]);
  const [coding, setCoding] = useState<CodingQualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof QUALITY_TABS)[number]["value"]>("scoreboard");
  const [cutoff, setCutoff] = useState(90);
  const [refreshed, setRefreshed] = useState<Set<string>>(new Set());
  const [coachGaps, setCoachGaps] = useState<CoachGapRow[]>([]);
  const [ragRows, setRagRows] = useState<RagHealthRow[]>([]);
  const [ragDigest, setRagDigest] = useState<RagWeeklyDigest | null>(null);
  const [ragDocs, setRagDocs] = useState<RagDocRow[]>([]);
  const [ragDomains, setRagDomains] = useState<RagDomainRow[]>([]);
  const [kbSuggestions, setKbSuggestions] = useState<KbSuggestionRow[]>([]);
  /* weekly digest delivery — which week the full digest was last sent */
  const [digestSentWeek, setDigestSentWeek] = useState<string | null>(() => storageGet<string>(STORAGE_KEYS.ragDigestWeek, "") || null);
  const [kbDocs, setKbDocs] = useState<PdfDocumentRow[]>([]);
  /* threshold explorer — reclassify recent retrievals against any cutoff */
  const [ragThreshold, setRagThreshold] = useState<number>(() => effectiveGroundingMinSim());
  /* clickable histogram — filter the query log to one similarity band */
  const [histSel, setHistSel] = useState<number | null>(null);
  const [reindexBusy, setReindexBusy] = useState(false);
  /* RAG digest alerts — breached thresholds surface as a banner; when a webhook
     (Slack / email bridge) is configured they are delivered once per week */
  const [alertSent, setAlertSent] = useState(false);
  /* coach-gap alerts — topics debated enough to warrant a deep-dive guide */
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

  const load = () => {
    setLoading(true);
    void Promise.all([adminQuestionQuality(), adminFeedbackFeed(50), adminCodingQuality(), adminCoachGaps(), adminRagHealth(), adminRagDocuments(), adminRagWeeklyDigest(), adminRagDomains(), adminKbSuggestions(), listPdfDocuments()])
      .then(([q, f, c, g, r, d, dig, dom, sug, k]) => { setRows(q); setFeed(f); setCoding(c); setCoachGaps(g); setRagRows(r); setRagDocs(d); setRagDigest(dig); setRagDomains(dom); setKbSuggestions(sug); setKbDocs(k); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const ragAlerts = useMemo(
    () => (ragDigest && ragDigest.total > 0 ? evaluateRagDigest(ragDigest, getRagDigestOpts()).filter(a => a.fired) : []),
    [ragDigest]
  );
  /* tuning playground — the recent log reclassified at every candidate pair */
  const playCells = useMemo(() => simulateTuning(ragRows, PLAY_MINSIMS, PLAY_FLOORS), [ragRows]);
  useEffect(() => {
    if (!ragAlerts.length || alertSent) return;
    const wk = weekKey();
    if (storageGet<string>(STORAGE_KEYS.ragAlertWeek, "") === wk) { setAlertSent(true); return; }
    const opts = getRagDigestOpts();
    if (!opts.webhook) return; /* in-app banner only — nothing to deliver to */
    storageSet(STORAGE_KEYS.ragAlertWeek, wk);
    setAlertSent(true);
    void fetch(opts.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "rag_digest_alert",
        week: wk,
        alerts: ragAlerts.map(a => ({ severity: a.severity, title: a.title, detail: a.detail })),
        digest: {
          total: ragDigest?.total ?? 0,
          groundedRate: ragDigest ? Math.round((ragDigest.grounded / Math.max(1, ragDigest.total)) * 100) : 0,
          emptyRate: ragDigest ? Math.round((ragDigest.empty / Math.max(1, ragDigest.total)) * 100) : 0,
          avgTopSim: ragDigest?.avgTopSim ?? 0,
          gateRejects: ragDigest?.gateRejects ?? 0
        },
        sentAt: new Date().toISOString()
      })
    }).catch(() => { /* webhook delivery is best-effort */ });
  }, [ragAlerts, alertSent]);

  /* Sends the FULL weekly digest (metrics + top queries + top documents) to
     the configured webhook / email bridge. Shared by the scheduled effect
     and the manual “Send now” button. */
  const deliverDigest = async (wk: string) => {
    const opts = getRagDigestOpts();
    const dig = ragDigest;
    if (!dig) return;
    const payload = {
      event: "rag_weekly_digest",
      week: wk,
      to: (opts.email ?? "").split(",").map(s => s.trim()).filter(Boolean),
      digest: {
        total: dig.total,
        grounded: dig.grounded,
        groundedRate: Math.round((dig.grounded / Math.max(1, dig.total)) * 100),
        empty: dig.empty,
        emptyRate: Math.round((dig.empty / Math.max(1, dig.total)) * 100),
        avgTopSim: dig.avgTopSim,
        gateRejects: dig.gateRejects,
        prevTotal: dig.prevTotal,
        prevGrounded: dig.prevGrounded,
        topQueries: dig.topQueries,
        topDocs: dig.topDocs
      },
      sentAt: new Date().toISOString()
    };
    if (opts.nativeEmail) {
      /* native delivery — send-rag-digest Edge Function (no webhook needed) */
      const fnUrl = `${CONFIG.supabase.url}/functions/v1/send-rag-digest`;
      const headers = await cloudFnHeaders();
      void fetch(fnUrl, { method: "POST", headers, body: JSON.stringify({ ...payload, from: opts.from ?? "InterviewIQ <digest@interviewiq.app>" }) })
        .then(async r => {
          const j = await r.json().catch(() => ({}));
          if (j && !j.sent) toast("📧 Native digest: " + (j.reason ?? "delivery failed — check the function"));
        })
        .catch(() => toast("✗ Native digest delivery failed — is the send-rag-digest function deployed?"));
      return;
    }
    if (!opts.webhook) return;
    void fetch(opts.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => { /* delivery is best-effort — the in-app digest stays visible */ });
  };

  /* scheduled weekly digest — once per week when enabled, no repeated sends */
  useEffect(() => {
    if (!ragDigest || ragDigest.total <= 0 || digestSentWeek) return;
    const opts = getRagDigestOpts();
    if (!opts.sendWeekly || !opts.webhook) return;
    const wk = weekKey();
    if (storageGet<string>(STORAGE_KEYS.ragDigestWeek, "") === wk) { setDigestSentWeek(wk); return; }
    storageSet(STORAGE_KEYS.ragDigestWeek, wk);
    setDigestSentWeek(wk);
    deliverDigest(wk);
  }, [ragDigest, digestSentWeek]);

  /* manual digest send — same payload, no weekly gate */
  const sendDigestNow = () => {
    if (!ragDigest || ragDigest.total <= 0) { toast("Nothing to send yet — the digest fills once signed-in users ask the tutor/coach"); return; }
    const opts = getRagDigestOpts();
    if (!opts.webhook) { toast("Set a delivery webhook in Product config → 🔔 RAG digest alerts first"); return; }
    const wk = weekKey();
    storageSet(STORAGE_KEYS.ragDigestWeek, wk);
    setDigestSentWeek(wk);
    deliverDigest(wk);
    toast("📧 Weekly digest queued to the webhook / email bridge");
  };

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

  /* re-embed ONE document with the current chunker (used from the RAG tab). */
  const reindexOne = async (doc: PdfDocumentRow) => {
    if (!aiAvailable()) { toast("Add an AI key in Settings — re-indexing needs one"); return; }
    setReindexBusy(true);
    try {
      const oldRows = await listPdfChunks(doc.id);
      if (!oldRows.length) { toast(`⏭️ "${doc.title}" has no chunks to re-index`); return; }
      const text = oldRows.map(c => c.content).join("\n");
      const r = await reindexDocument(doc.id, text, oldRows);
      if (r.changed === 0) { toast(`⏭️ "${doc.title}" already matches the current chunker`); return; }
      await load();
      toast(`♻️ Re-indexed "${doc.title}" — ${r.fresh} fresh embed${r.fresh === 1 ? "" : "s"}, reused ${r.reused}`);
    } catch (e) { toast("✗ " + ((e as Error).message || "Re-index failed")); }
    finally { setReindexBusy(false); }
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">🔎 Content quality center</h2>
          <p className="text-[12.5px] text-mut">
            Every question that real users answered, scored on performance, difficulty, feedback and freshness.
            The composite score (0-100) is: avg score · pass-rate band · 👍/👎/🚩 · days since review.
          </p>
        </div>
        <Seg
          options={QUALITY_TABS.map(t => t.value === "coach" && gapAlerts.length > 0 ? { ...t, label: `${t.label} · ${gapAlerts.length}` } : t)}
          value={tab}
          onChange={v => setTab(v)}
        />
        <button className={btnGhost + btnSm} onClick={load} disabled={busy}>↻ Refresh</button>
      </div>

      {loading && rows.length === 0 && <p className="text-center text-mut"><span className="spinner inline-block" /> Crunching session data…</p>}

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

      {tab === "rag" && (
        <div className={`${cardCls} p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <h3 className="text-[15px] font-extrabold">🛰️ RAG health — is the knowledge base answering?</h3>
              <p className="mt-1 text-[12.5px] text-mut">
                Every tutor/coach retrieval queues a rag_event. A low grounded rate or high empty rate means
                users' questions aren't in the uploaded PDFs — time to add documents or improve chunking.
              </p>
            </div>
            {kbDocs.length > 0 && (
              <button
                className={btnGhost + btnSm}
                disabled={reindexBusy || busy || !aiAvailable()}
                onClick={async () => {
                  if (!aiAvailable()) { toast("Add an AI key in Settings — re-indexing needs one"); return; }
                  setReindexBusy(true);
                  try {
                    let reembedded = 0, skipped = 0, fresh = 0;
                    for (const doc of kbDocs) {
                      const oldRows = await listPdfChunks(doc.id);
                      if (!oldRows.length) { skipped++; continue; }
                      const text = oldRows.map(c => c.content).join("\n");
                      const r = await reindexDocument(doc.id, text, oldRows);
                      if (r.changed === 0) { skipped++; continue; }
                      fresh += r.fresh;
                      reembedded++;
                    }
                    await load();
                    toast(`🧠 Re-indexed ${reembedded} document(s) with the current chunker${fresh ? ` — ${fresh} fresh embed${fresh === 1 ? "" : "s"}, rest reused` : ""} · ${skipped} unchanged`);
                  } catch (e) {
                    toast("✗ " + ((e as Error).message || "Re-index failed"));
                  } finally { setReindexBusy(false); }
                }}
              >
                {reindexBusy ? <><span className="spinner" /> Re-indexing…</> : `♻️ Re-index all (${kbDocs.length})`}
              </button>
            )}
          </div>

          {/* digest alert banner — breached thresholds this week (in-app + webhook) */}
          {ragAlerts.length > 0 && (
            <div className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3">
              <div className="text-[13px] font-extrabold">🔔 RAG health alerts — this week</div>
              <ul className="mt-1 space-y-1 text-[12.5px]">
                {ragAlerts.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`font-black ${a.severity === "bad" ? "text-bad" : "text-warn"}`}>•</span>
                    <span><span className="font-bold">{a.title}:</span> {a.detail}</span>
                  </li>
                ))}
              </ul>
              {getRagDigestOpts().webhook ? (
                <p className="mt-1 text-[11px] text-fnt">Delivered to the configured webhook once this week.</p>
              ) : (
                <p className="mt-1 text-[11px] text-fnt">
                  No delivery webhook configured — set one in <span className="font-bold">Product config → 🔔 RAG digest alerts</span> for Slack / email delivery.
                </p>
              )}
            </div>
          )}

          {/* weekly digest — last-7-days aggregates vs the previous week */}
          {ragDigest && ragDigest.total > 0 && (
            <div className="mt-3 rounded-xl border border-line/10 bg-deep/40 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-extrabold">📅 This week</span>
                <Chip tone="ok">{ragDigest.total} retrieval{ragDigest.total === 1 ? "" : "s"}</Chip>
                <Chip tone={ragDigest.grounded / Math.max(1, ragDigest.total) >= 0.6 ? "ok" : "warn"}>
                  {Math.round((ragDigest.grounded / Math.max(1, ragDigest.total)) * 100)}% grounded
                </Chip>
                <Chip tone={ragDigest.empty / Math.max(1, ragDigest.total) <= 0.2 ? "ok" : "warn"}>
                  {ragDigest.empty} empty
                </Chip>
                <Chip>avg sim {ragDigest.avgTopSim.toFixed(2)}</Chip>
                {ragDigest.gateRejects > 0 && <Chip tone="warn">🚫 {ragDigest.gateRejects} gate rejects</Chip>}
                {ragDigest.prevTotal > 0 && (
                  <Chip tone={ragDigest.total >= ragDigest.prevTotal ? "ok" : "warn"}>
                    {ragDigest.total >= ragDigest.prevTotal ? "▲" : "▼"} {Math.round((Math.abs(ragDigest.total - ragDigest.prevTotal) / ragDigest.prevTotal) * 100)}% vs prior week
                  </Chip>
                )}
                {ragDigest.prevTotal > 0 && (
                  <Chip tone={ragDigest.grounded / Math.max(1, ragDigest.total) >= ragDigest.prevGrounded / Math.max(1, ragDigest.prevTotal) ? "ok" : "warn"}>
                    grounded {(ragDigest.grounded / Math.max(1, ragDigest.total) * 100 - ragDigest.prevGrounded / Math.max(1, ragDigest.prevTotal) * 100) >= 0 ? "▲" : "▼"} {Math.abs((ragDigest.grounded / Math.max(1, ragDigest.total) - ragDigest.prevGrounded / Math.max(1, ragDigest.prevTotal)) * 100).toFixed(0)}pt
                  </Chip>
                )}
              </div>
              {ragDigest.topQueries.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-mut">Top asked:</span>
                  {ragDigest.topQueries.map((t, i) => (
                    <Chip key={i} tone="lvl">{t.q} · {t.n}</Chip>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button className={btnGhost + btnSm} disabled={busy} onClick={sendDigestNow} title="Deliver this week's digest to the configured webhook / email bridge now">
                  📧 Send digest now
                </button>
                {digestSentWeek === weekKey() ? (
                  <Chip tone="ok">sent this week</Chip>
                ) : getRagDigestOpts().sendWeekly ? (
                  <Chip tone="lvl">scheduled — sends once this week</Chip>
                ) : (
                  <Chip>auto-send off (enable in Product config)</Chip>
                )}
                {digestSentWeek && <span className="text-[11px] text-fnt">last sent: week {digestSentWeek}</span>}
              </div>
            </div>
          )}
          {/* threshold explorer — reclassify the recent log against any cutoff */}
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line/10 bg-deep/40 px-4 py-3">
            <span className="text-[12.5px] font-bold">🔍 Explorer cutoff</span>
            <input
              type="range" min={0.3} max={0.8} step={0.01}
              value={ragThreshold}
              onChange={e => setRagThreshold(Number(e.target.value))}
              className="min-w-[180px] flex-1 accent-acc1"
            />
            <input
              type="number" min={0.3} max={0.8} step={0.01}
              value={ragThreshold}
              onChange={e => setRagThreshold(Math.max(0.1, Math.min(0.95, Number(e.target.value) || 0.45)))}
              className="inp w-20 py-1 text-center"
            />
            <Chip tone={ragThreshold === effectiveGroundingMinSim() ? "ok" : "warn"}>
              {ragThreshold === effectiveGroundingMinSim() ? "= live cutoff" : "preview only — not saved"}
            </Chip>
          </div>
          {(() => {
            const live = ragHealthSummary(ragRows);
            const s = ragHealthSummary(ragRows, ragThreshold);
            if (!s.total) {
              return <p className="py-6 text-center text-[13px] text-mut">No retrieval events yet — they appear once signed-in users ask the tutor or API coach anything.</p>;
            }
            /* hoisted so the histogram, its drill-down and the query log share one view */
            const bins = ragHistogram(ragRows, ragThreshold);
            const shown = histSel == null
              ? ragRows
              : ragRows.filter(r => r.topSim >= bins[histSel].min && r.topSim < bins[histSel].max);
            const signal = (label: string, value: string, tone: "ok" | "warn" | "bad") => (
              <div className="rounded-xl border border-line/10 bg-wht/5 p-4 text-center">
                <div className={`text-[24px] font-extrabold tabular-nums ${tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-bad"}`}>{value}</div>
                <div className="mt-0.5 text-[11.5px] font-bold text-mut">{label}</div>
              </div>
            );
            return (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {signal("Retrievals (window)", String(s.total), "ok")}
                  {signal("Grounded rate", s.groundedRate + "%", s.groundedRate >= 60 ? "ok" : s.groundedRate >= 30 ? "warn" : "bad")}
                  {signal("Empty hits", s.emptyRate + "%", s.emptyRate <= 20 ? "ok" : s.emptyRate <= 40 ? "warn" : "bad")}
                  {signal("Avg top similarity", s.avgTopSim.toFixed(2), s.avgTopSim >= 0.55 ? "ok" : s.avgTopSim >= 0.4 ? "warn" : "bad")}
                  {(() => {
                    const gateRejects = ragRows.reduce((n, r) => n + (r.gateRejects ?? 0), 0);
                    return signal("Gate rejections", String(gateRejects), gateRejects === 0 ? "ok" : "warn");
                  })()}
                </div>
                {/* similarity histogram — where retrieval quality lands vs the cutoff + hard floor */}
                <div className="mt-4">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-mut">
                    <span>📊 Similarity distribution</span>
                    <span className="normal-case font-bold">cutoff {ragThreshold.toFixed(2)}</span>
                    <span className="normal-case font-bold text-bad">hard floor {effectiveHardFloor().toFixed(2)}</span>
                  </div>
                  {(() => {
                    const max = Math.max(1, ...bins.map(b => b.total));
                    const cutoffBin = bins.findIndex(b => ragThreshold >= b.min && ragThreshold < b.max);
                    const floorBin = bins.findIndex(b => effectiveHardFloor() >= b.min && effectiveHardFloor() < b.max);
                    return (
                      <div className="space-y-1.5">
                        {bins.map((b, i) => (
                          <button
                            key={b.label}
                            type="button"
                            onClick={() => setHistSel(histSel === i ? null : i)}
                            title="Click to see the queries in this band"
                            className={`flex items-center gap-2 text-left text-[12px] transition-opacity hover:opacity-100 ${histSel === i ? "opacity-100" : "opacity-80"}`}
                          >
                            <span className={`w-14 shrink-0 font-bold ${i === floorBin ? "text-bad" : "text-fnt"}`}>
                              {b.label}{i === floorBin ? " 🚫" : ""}
                            </span>
                            <span className={`relative h-5 flex-1 overflow-hidden rounded-md bg-wht/5 ${histSel === i ? "ring-1 ring-co/70" : ""}`}>
                              <span
                                className={`absolute inset-y-0 left-0 ${i === floorBin ? "bg-bad/40" : "bg-acc1/40"}`}
                                style={{ width: `${(b.total / max) * 100}%` }}
                              />
                              <span className="absolute inset-y-0 left-0 bg-ok/50" style={{ width: `${(b.grounded / max) * 100}%` }} />
                              {i === cutoffBin && (
                                <span className="absolute inset-y-0 w-px bg-ink/70" style={{ left: `${((ragThreshold - b.min) / (b.max - b.min)) * 100}%` }} />
                              )}
                              <span className="absolute inset-y-0 right-1 flex items-center text-[10px] font-bold text-ink/80">
                                {b.total} {b.grounded > 0 ? `· ${b.grounded} grounded` : ""}{b.gated > 0 ? ` · 🚫 ${b.gated}` : ""}
                              </span>
                            </span>
                          </button>
                        ))}
                        <p className="text-[11px] text-fnt">
                          Bar = queries whose top hit landed in this similarity band (<span className="text-ok">green</span> = grounded at the explorer cutoff, <span className="text-bad">red band</span> = concept-free citations allowed, <span className="text-ink">tick</span> = explorer cutoff). Click a band to drill into its queries.
                        </p>
                        {(() => {
                          const sug = suggestHardFloor(ragRows, effectiveHardFloor(), effectiveGroundingMinSim());
                          return (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {sug.changed ? (
                                <>
                                  <Chip tone="warn">💡 Suggested hard floor: {sug.value.toFixed(2)}</Chip>
                                  <span className="text-[11.5px] text-fnt">{sug.reason}.</span>
                                  <button className={btnGhost + btnSm} onClick={() => onApplyHardFloor(sug.value)}>
                                    🎚️ Apply to Product config
                                  </button>
                                </>
                              ) : (
                                <span className="text-[11.5px] text-fnt">✅ {sug.reason}.</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>
                {ragRows.some(r => (r.gateRejects ?? 0) > 0) && (
                  <p className="mt-1.5 text-[11.5px] text-fnt">
                    🚫 <span className="font-bold">Concept gate:</span> {ragRows.reduce((n, r) => n + (r.gateRejects ?? 0), 0)} high-sim chunk(s) were dropped for sharing no concepts with the query — tune the hard floor in <span className="font-bold">Product config → 🗄️ RAG retrieval</span>.
                  </p>
                )}
                {ragThreshold !== effectiveGroundingMinSim() && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-fnt">
                    <Chip tone="lvl">at the live cutoff ({effectiveGroundingMinSim()}) this window was {live.groundedRate}% grounded</Chip>
                    <span>— publish a new cutoff in <span className="font-bold">Product config → 🗄️ RAG retrieval</span> to apply it.</span>
                  </div>
                )}

                {/* tuning playground — reclassify the week against any cutoff/hard-floor combo */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-mut">🎚️ Tuning playground — what WOULD the week look like?</div>
                  <p className="mb-2 text-[11.5px] text-fnt">
                    Each cell reclassifies the {ragRows.length} recent retrieval(s) at that cutoff + hard floor.
                    <span className="text-ok"> % </span>= grounded rate, <span className="text-warn">🚫n</span> = concept-gate rejections. Click a cell to stage the pair.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-line/10 bg-deep/40 p-3">
                    <table className="w-full min-w-[620px] text-center text-[12px]">
                      <thead>
                        <tr className="text-[10.5px] uppercase tracking-wider text-mut">
                          <th className="px-2 py-1.5 text-left font-bold">cutoff ↓ / floor →</th>
                          {PLAY_FLOORS.map(f => <th key={f} className="px-1 py-1.5 font-bold tabular-nums">{f.toFixed(2)}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {PLAY_MINSIMS.map(ms => {
                          const liveRow = ms === effectiveGroundingMinSim();
                          return (
                            <tr key={ms}>
                              <td className={`px-2 py-1 text-left font-bold tabular-nums ${liveRow ? "text-co" : ""}`}>{ms.toFixed(2)}</td>
                              {PLAY_FLOORS.map(hf => {
                                const cell = playCells.find(c => c.minSim === ms && c.hardFloor === hf);
                                if (!cell) return <td key={hf} />;
                                const live = liveRow && hf === effectiveHardFloor();
                                const tone = cell.groundedRate >= 60 ? "text-ok" : cell.groundedRate >= 30 ? "text-warn" : "text-bad";
                                return (
                                  <td key={hf} className="p-0.5">
                                    <button
                                      type="button"
                                      title={`cutoff ${ms.toFixed(2)} · floor ${hf.toFixed(2)} → ${cell.groundedRate}% grounded${cell.gateRejects ? ` · 🚫${cell.gateRejects}` : ""}`}
                                      onClick={() => onStageTuning(ms, hf)}
                                      className={`w-full rounded-md px-1 py-1.5 font-bold tabular-nums transition-colors ${live ? "bg-co/25 ring-1 ring-co" : "bg-wht/5 hover:bg-wht/10"} ${tone}`}
                                    >
                                      {cell.groundedRate}%{cell.gateRejects > 0 ? <span className="text-warn"> 🚫{cell.gateRejects}</span> : ""}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1.5 text-[11px] text-fnt">
                    <span className="font-bold text-co">Highlighted</span> = today's live pair ({effectiveGroundingMinSim().toFixed(2)} / {effectiveHardFloor().toFixed(2)}).
                    Simulated only — click to stage, then publish from Product config.
                  </p>
                  {(() => {
                    const best = bestTuningCell(playCells, effectiveGroundingMinSim(), effectiveHardFloor());
                    const liveCell = playCells.find(c => c.minSim === effectiveGroundingMinSim() && c.hardFloor === effectiveHardFloor());
                    if (!best) return null;
                    const same = best === liveCell || (liveCell && best.groundedRate === liveCell.groundedRate && best.gateRejects === liveCell.gateRejects);
                    const delta = liveCell ? best.groundedRate - liveCell.groundedRate : 0;
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {same ? (
                          <Chip tone="ok">⭐ Best = live pair — already optimal for this window</Chip>
                        ) : (
                          <>
                            <Chip tone="lvl">⭐ Best: {best.groundedRate}% @ {best.minSim.toFixed(2)} / {best.hardFloor.toFixed(2)}{best.gateRejects ? ` · 🚫${best.gateRejects}` : ""}</Chip>
                            {liveCell && <span className="text-[11.5px] text-fnt">vs {liveCell.groundedRate}% now {delta > 0 ? `(+${delta}pt)` : `(${delta}pt)`}</span>}
                            <button className={btnGhost + btnSm} onClick={() => onStageTuning(best.minSim, best.hardFloor)}>
                              🎚️ Apply best
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* per-domain breakdown — which fields/levels ground best */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-mut">🌐 Per-field & level</div>
                  <p className="mb-2 text-[11.5px] text-fnt">
                    Retrievals tagged with the goal / interview context they happened in — see where the KB answers well
                    and which domains' questions miss it. Untagged (general) sessions roll up under <span className="font-mono">general</span>.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-line/10">
                    <table className="w-full min-w-[560px] text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                          <th className="px-3 py-2 font-bold">Dimension</th>
                          <th className="px-3 py-2 font-bold">Domain</th>
                          <th className="px-3 py-2 font-bold">Retrievals</th>
                          <th className="px-3 py-2 font-bold">Grounded</th>
                          <th className="px-3 py-2 font-bold">Empty</th>
                          <th className="px-3 py-2 font-bold">Avg sim</th>
                          <th className="px-3 py-2 font-bold">Gate rejects</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ragDomains.length === 0 && (
                          <tr><td colSpan={7} className="px-3 py-6 text-center text-mut">No domain-tagged retrievals yet — they appear once signed-in users ask the tutor/coach inside a goal or interview.</td></tr>
                        )}
                        {ragDomains.map((d, i) => (
                          <tr key={i} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                            <td className="px-3 py-2.5"><Chip tone={d.dimension === "field" ? "lvl" : "ok"}>{d.dimension === "field" ? "field" : "level"}</Chip></td>
                            <td className="px-3 py-2.5 font-bold">{d.name}</td>
                            <td className="px-3 py-2.5 tabular-nums">{d.retrievals}</td>
                            <td className="px-3 py-2.5">
                              <span className={`font-bold tabular-nums ${d.retrievals ? (d.grounded / d.retrievals >= 0.6 ? "text-ok" : d.grounded / d.retrievals >= 0.3 ? "text-warn" : "text-bad") : ""}`}>
                                {d.retrievals ? Math.round((d.grounded / d.retrievals) * 100) + "%" : "—"}
                              </span>
                              <span className="text-[11px] text-fnt"> ({d.grounded})</span>
                            </td>
                            <td className="px-3 py-2.5 tabular-nums">{d.empty}</td>
                            <td className="px-3 py-2.5 tabular-nums">{d.avgTopSim.toFixed(2)}</td>
                            <td className="px-3 py-2.5">{d.gateRejects > 0 ? <Chip tone="warn">🚫 {d.gateRejects}</Chip> : <span className="text-[12px] text-fnt">0</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* KB suggestions — users asked to add these topics */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-mut">💡 KB suggestions ({kbSuggestions.length})</div>
                  <p className="mb-2 text-[11.5px] text-fnt">
                    Users hit a question the knowledge base didn't answer and tapped “Suggest adding it”. Most-requested first —
                    these are the gaps to write deep-dives or upload PDFs for.
                  </p>
                  <div className="max-h-[280px] space-y-1.5 overflow-y-auto">
                    {kbSuggestions.length === 0 && (
                      <p className="rounded-lg border border-line/10 bg-deep/40 px-3 py-4 text-center text-[12.5px] text-mut">
                        No suggestions yet — they appear when users tap “💡 Suggest adding to knowledge base” on an ungrounded coach reply.
                      </p>
                    )}
                    {kbSuggestions.map((s, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                        <span className="min-w-[160px] flex-1 truncate font-bold">{s.topic}</span>
                        <Chip tone={s.requests >= 3 ? "bad" : "warn"}>{s.requests} request{s.requests === 1 ? "" : "s"}</Chip>
                        <Chip tone="lvl">{s.field}</Chip>
                        <Chip>{s.level}</Chip>
                        <span className="text-[11px] text-fnt">last {new Date(s.latest).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* per-document breakdown — which uploaded PDF actually answers */}
                <div className="mt-4">
                  <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wider text-mut">📄 Per-document</div>
                  <div className="overflow-x-auto rounded-xl border border-line/10">
                    <table className="w-full min-w-[560px] text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-line/10 bg-wht/[.04] text-[11px] uppercase tracking-wider text-mut">
                          <th className="px-3 py-2 font-bold">Document</th>
                          <th className="px-3 py-2 font-bold">Retrievals</th>
                          <th className="px-3 py-2 font-bold">Avg sim</th>
                          <th className="px-3 py-2 font-bold">Last cited</th>
                          <th className="px-3 py-2 font-bold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kbDocs.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-6 text-center text-mut">No documents indexed yet — upload PDFs in the Auto-fill section to build the knowledge base.</td></tr>
                        )}
                        {(() => {
                          const stats = new Map(ragDocs.map(d => [d.documentId, d]));
                          const rows = kbDocs
                            .map(k => ({ k, s: stats.get(k.id) }))
                            .sort((a, b) => (b.s?.retrievals ?? 0) - (a.s?.retrievals ?? 0) || a.k.title.localeCompare(b.k.title));
                          return rows.map(({ k, s }) => (
                            <tr key={k.id} className={`border-b border-line/5 last:border-0 hover:bg-wht/5 ${s ? "" : "opacity-70"}`}>
                              <td className="max-w-[300px] px-3 py-2.5">
                                <div className="truncate font-bold">{k.title}</div>
                                <div className="text-[11px] text-fnt">{k.chunk_count} chunk{k.chunk_count === 1 ? "" : "s"}</div>
                              </td>
                              <td className="px-3 py-2.5">
                                {s ? (
                                  <Chip tone={s.retrievals >= 3 ? "ok" : "warn"}>{s.retrievals} retrieval{s.retrievals === 1 ? "" : "s"}</Chip>
                                ) : (
                                  <Chip tone="bad">📭 never retrieved</Chip>
                                )}
                              </td>
                              <td className="px-3 py-2.5 tabular-nums">{s ? s.avgSim.toFixed(2) : "—"}</td>
                              <td className="px-3 py-2.5 text-[12px] text-fnt">{s?.lastSeen ? new Date(s.lastSeen).toLocaleDateString() : "—"}</td>
                              <td className="px-3 py-2.5">
                                <button
                                  className={btnGhost + btnSm}
                                  disabled={reindexBusy || !aiAvailable()}
                                  title="Re-embed this document with the current chunker"
                                  onClick={() => reindexOne(k)}
                                >
                                  ♻️ Re-index
                                </button>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  {kbDocs.some(k => !ragDocs.some(d => d.documentId === k.id)) && (
                    <p className="mt-1.5 text-[11.5px] text-fnt">📭 Documents never retrieved aren't answering user questions — either their content misses the queries being asked, or they need re-uploading with better structure.</p>
                  )}
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-mut">
                    <span>🕘 Query log</span>
                    {histSel != null && (
                      <>
                        <span className="normal-case font-bold text-co">
                          showing {bins[histSel].label} ({shown.length} of {ragRows.length})
                        </span>
                        <button type="button" className={btnGhost + btnSm} onClick={() => setHistSel(null)}>✕ clear band filter</button>
                      </>
                    )}
                  </div>
                  <div className="max-h-[360px] space-y-1.5 overflow-y-auto">
                  {shown.map((r, i) => {
                    const wouldBe = r.topSim >= ragThreshold;
                    const flipped = wouldBe !== r.grounded;
                    return (
                      <div key={i} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] ${flipped ? "border-warn/40 bg-warn/10" : "border-line/10 bg-deep/40"}`}>
                        <span className="min-w-[160px] flex-1 truncate font-bold">{r.query}</span>
                        <Chip tone={wouldBe ? "ok" : "default"}>{wouldBe ? "📚 grounded" : "🧠 general"}</Chip>
                        <Chip>{r.hits} hit{r.hits === 1 ? "" : "s"}</Chip>
                        <Chip>sim {r.topSim.toFixed(2)}</Chip>
                        {(r.gateRejects ?? 0) > 0 && <Chip tone="warn">🚫 gate −{r.gateRejects}</Chip>}
                        {flipped && <Chip tone="warn">↻ flips at {ragThreshold.toFixed(2)}</Chip>}
                        <span className="text-[11px] text-fnt">{new Date(r.at).toLocaleString()}</span>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
