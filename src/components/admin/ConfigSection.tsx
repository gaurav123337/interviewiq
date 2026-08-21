import { useEffect, useState } from "react";
import { COMPANIES, companyById } from "../../data";
import { COMPANY_FREQ, problemsForCompany } from "../../data/codingCompanies";
import { cloudFnHeaders } from "../../services/cloud";
import { CONFIG } from "../../config";
import { getCareerProfile, indiaDigest, lastJobsRefresh, listJobs, rankCompanies, recommendationsDigest, refreshJobs } from "../../services/jobs";
import { applyDigest } from "../../services/applyTrack";
import { saveJobSalaryEnrichment, saveRemoteConfig, getLastJobsFetchReport, type JobsFetchReport } from "../../services/admin";
import { type RemoteConfig } from "../../services/remoteConfig";

import { adminListUsers } from "../../services/admin";
import { toast } from "../../toast";
import { cardCls, btnPrimary, btnGhost, btnSm, Chip, Modal, Switch, NumField, OptRow } from "../ui";

const FEATURE_LABELS: Record<string, string> = {
  paywall: "Freemium paywall (quotas + upsells)",
  roadmap: "Career roadmap",
  playground: "Code playground",
  jd: "Job-description tailoring",
  drill: "Drill mode"
};

/* ------------------------------------------------------------------ */
/* Product config — feature flags, AI capabilities, quotas             */
/* ------------------------------------------------------------------ */

/* Audit trail for company-frequency publishes — drives the weekly digest.
   Kept in the admin's local storage (no schema change); each publish records
   the diff against the previous snapshot plus the new snapshot. */
const FREQ_AUDIT_KEY = "iq.adminFreqAudit";
interface FreqChange { company: string; problem: string; to: number }
interface FreqAuditEntry { at: number; changes: FreqChange[]; snapshot: Record<string, Partial<Record<string, number>>> }

function getFreqAudit(): FreqAuditEntry[] {
  try { return JSON.parse(localStorage.getItem(FREQ_AUDIT_KEY) || "[]") as FreqAuditEntry[]; } catch { return []; }
}
function saveFreqAudit(a: FreqAuditEntry[]): void {
  localStorage.setItem(FREQ_AUDIT_KEY, JSON.stringify(a));
}

/** Parse the resume-branding JSON editor, dropping malformed entries. */
function parseBrandJson(json: string): Record<string, { accent?: string; fontFamily?: string }> {
  try {
    const v = JSON.parse(json || "{}");
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const out: Record<string, { accent?: string; fontFamily?: string }> = {};
    for (const [k, entry] of Object.entries(v)) {
      const e = entry as { accent?: unknown; fontFamily?: unknown };
      out[k] = {
        accent: typeof e.accent === "string" && /^#[0-9a-fA-F]{3,6}$/.test(e.accent) ? e.accent : undefined,
        fontFamily: typeof e.fontFamily === "string" ? e.fontFamily : undefined
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function ConfigSection({ config, setConfig, busy, setBusy }: {
  config: RemoteConfig; setConfig: (c: RemoteConfig) => void; busy: boolean; setBusy: (b: boolean) => void;
}) {
  const setFeature = (f: keyof NonNullable<RemoteConfig["features"]>, v: boolean) =>
    setConfig({ ...config, features: { ...config.features, [f]: v } });
  const setAi = (k: keyof NonNullable<RemoteConfig["ai"]>, v: number | string | boolean) =>
    setConfig({ ...config, ai: { ...config.ai, [k]: v } });
  const setLimit = (k: keyof NonNullable<RemoteConfig["limits"]>, v: number) =>
    setConfig({ ...config, limits: { ...config.limits, [k]: v } });
  const setRag = (k: keyof NonNullable<RemoteConfig["rag"]>, v: number) =>
    setConfig({ ...config, rag: { ...config.rag, [k]: v } });
  const setRagDigest = (k: keyof NonNullable<NonNullable<RemoteConfig["rag"]>["digest"]>, v: number | string | boolean) =>
    setConfig({ ...config, rag: { ...config.rag, digest: { ...config.rag?.digest, [k]: v } } });
  /* coach vocabulary JSON editor (families + misconceptions) */
  const [vocabJson, setVocabJson] = useState<string>(() => JSON.stringify(config.coachVocab ?? {}, null, 2));
  /* resume branding (Apply Kit): per-company accent + font for the designed one-pager */
  const [brandJson, setBrandJson] = useState<string>(() => JSON.stringify(config.resumeBranding ?? {}, null, 2));
  const [brandCo, setBrandCo] = useState<string>("_default");
  const [brandAccent, setBrandAccent] = useState<string>(() => config.resumeBranding?._default?.accent ?? "#4f46e5");
  const [brandFont, setBrandFont] = useState<string>(() => config.resumeBranding?._default?.fontFamily ?? "system");
  /* companies seen in the configured job sources (boards), plus _default */
  const brandList = () => [
    "_default",
    ...jobsSources.split(/\n/).map(l => l.trim()).filter(Boolean)
      .map(l => l.split(":").slice(1).join(":").trim())
      .filter(Boolean)
  ].filter((v, i, a) => a.indexOf(v) === i);
  const pickBrand = (co: string) => {
    setBrandCo(co);
    setBrandAccent(config.resumeBranding?.[co]?.accent ?? "#4f46e5");
    setBrandFont(config.resumeBranding?.[co]?.fontFamily ?? "system");
  };
  const setBrandField = (co: string, accent: string, font: string) => {
    const next = { ...(config.resumeBranding ?? {}) };
    const entry: { accent?: string; fontFamily?: string } = { accent, fontFamily: font === "system" ? undefined : font };
    if (accent === "#4f46e5" && !entry.fontFamily) delete next[co];
    else next[co] = entry;
    setConfig({ ...config, resumeBranding: next });
    /* keep the raw-JSON editor in sync so publish never loses a picker edit */
    setBrandJson(JSON.stringify(next, null, 2));
  };
  /* job feed (Apply Kit): auto-refresh interval + ATS sources */
  const [jobsHours, setJobsHours] = useState<number>(() => config.jobs?.refreshHours ?? 24);
  const [jobsSources, setJobsSources] = useState<string>(() =>
    (config.jobs?.sources ?? []).map(s => `${s.provider}:${s.board}`).join("\n")
  );
  /* last refresh report — per-source counts + failures, so a broken board
     surfaces here instead of only in the function logs */
  const [jobsReport, setJobsReport] = useState<JobsFetchReport | null>(null);
  const [jobsReportErr, setJobsReportErr] = useState<string | null>(null);
  const [jobsRefreshing, setJobsRefreshing] = useState(false);
  const loadJobsReport = async () => {
    try {
      setJobsReport(await getLastJobsFetchReport());
      setJobsReportErr(null);
    } catch (e) {
      setJobsReportErr((e as Error).message || "Failed to load refresh report");
    }
  };
  useEffect(() => { void loadJobsReport(); }, []);
  /* self-heal on view — if the feed is older than the auto-refresh interval,
     kick a refresh right here (same rule as the Jobs page), so stale data
     fixes itself instead of waiting for the next scheduled run */
  useEffect(() => {
    if (!jobsReport) return;
    const hours = Math.max(1, Math.round(jobsHours) || 24);
    const stale = Date.now() - new Date(jobsReport.ran_at).getTime() > hours * 3_600_000
      && Date.now() - lastJobsRefresh() > hours * 3_600_000;
    if (stale) void runJobsRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsReport]);
  const runJobsRefresh = async () => {
    if (jobsRefreshing) return;
    setJobsRefreshing(true);
    try {
      const r = await refreshJobs();
      const fails = Object.keys(r.errors);
      toast(fails.length
        ? `🩺 Feed self-healed — ${r.total} jobs (${r.added} new), ⚠️ ${fails.length} source${fails.length > 1 ? "s" : ""} still failing: ${fails.join(", ")}`
        : `🩺 Feed self-healed — ${r.total} jobs (${r.added} new), all sources clean`);
      await loadJobsReport();
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Refresh failed"));
    } finally {
      setJobsRefreshing(false);
    }
  };
  /* compensation enrichment — provider + country for jobs the posting didn't price */
  const [enrProvider, setEnrProvider] = useState<string>(() => config.jobs?.salaryEnrichment?.provider ?? "none");
  const [enrCountry, setEnrCountry] = useState<string>(() => config.jobs?.salaryEnrichment?.country ?? "us");
  const [enrCap, setEnrCap] = useState<number>(() => config.jobs?.salaryEnrichment?.cap ?? 30);
  /* apply digest email — authenticated by the admin session; no local secrets */
  const [digestTesting, setDigestTesting] = useState<null | "dryrun" | "send">(null);
  const [applyPreview, setApplyPreview] = useState<string | null>(null);
  const [applyRecipients, setApplyRecipients] = useState<string[] | null>(null);
  const previewApply = () => setApplyPreview(applyDigest());
  /* recommendations digest — admin-session broadcast, with a dry-run preview */
  const [recsBusy, setRecsBusy] = useState<null | "dryrun" | "send">(null);
  const [recsPreview, setRecsPreview] = useState<string | null>(null);
  const [recsRecipients, setRecsRecipients] = useState<string[] | null>(null);
  /* 🇮🇳 India & startup digest — the same broadcast with kind: "india" */
  const [indiaRecsBusy, setIndiaRecsBusy] = useState<null | "dryrun" | "send">(null);
  const [indiaRecsPreview, setIndiaRecsPreview] = useState<string | null>(null);
  const [indiaRecsRecipients, setIndiaRecsRecipients] = useState<string[] | null>(null);
  const recsHeaders = (): Promise<Record<string, string>> => cloudFnHeaders();
  const previewRecs = () => {
    const p = getCareerProfile();
    const jobs = listJobs();
    if (!p) { toast("No career profile in this browser — upload a resume or save the profile first"); return; }
    if (!jobs.length) { toast("No jobs cached — refresh the feed first"); return; }
    setRecsPreview(recommendationsDigest(p, rankCompanies(p, jobs)));
  };
  const runRecsBroadcast = async (dryRun: boolean) => {
    setRecsBusy(dryRun ? "dryrun" : "send");
    try {
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-recommendations-digest`, {
        method: "POST", headers: await recsHeaders(), body: dryRun ? JSON.stringify({ dryRun: true }) : "{}"
      });
      const body = await res.json().catch(() => ({})) as { sent?: boolean; dryRun?: boolean; wouldEmail?: number; emailsSent?: number; recipients?: string[]; reason?: string };
      if (dryRun && body.dryRun) {
        setRecsRecipients(body.recipients ?? []);
        toast(`📡 Dry run — would email ${body.wouldEmail ?? 0} user${(body.wouldEmail ?? 0) === 1 ? "" : "s"} (nothing sent)`);
      } else if (body.sent) {
        toast(`📬 Recommendations digest sent — ${body.emailsSent ?? 0} email${body.emailsSent === 1 ? "" : "s"}`);
      } else {
        toast("✗ " + (body.reason ?? "Broadcast failed"));
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Broadcast failed"));
    } finally {
      setRecsBusy(null);
    }
  };
  const previewIndiaRecs = () => {
    const p = getCareerProfile();
    const jobs = listJobs();
    if (!p) { toast("No career profile in this browser — upload a resume or save the profile first"); return; }
    if (!jobs.length) { toast("No jobs cached — refresh the feed first"); return; }
    setIndiaRecsPreview(indiaDigest(p, jobs));
  };
  const runIndiaRecsBroadcast = async (dryRun: boolean) => {
    setIndiaRecsBusy(dryRun ? "dryrun" : "send");
    try {
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-recommendations-digest`, {
        method: "POST", headers: await recsHeaders(), body: JSON.stringify({ dryRun, kind: "india" })
      });
      const body = await res.json().catch(() => ({})) as { sent?: boolean; dryRun?: boolean; wouldEmail?: number; emailsSent?: number; recipients?: string[]; reason?: string };
      if (dryRun && body.dryRun) {
        setIndiaRecsRecipients(body.recipients ?? []);
        toast(`📡 Dry run — would email ${body.wouldEmail ?? 0} user${(body.wouldEmail ?? 0) === 1 ? "" : "s"} (nothing sent)`);
      } else if (body.sent) {
        toast(`📬 🇮🇳 India digest sent — ${body.emailsSent ?? 0} email${body.emailsSent === 1 ? "" : "s"}`);
      } else {
        toast("✗ " + (body.reason ?? "Broadcast failed"));
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Broadcast failed"));
    } finally {
      setIndiaRecsBusy(null);
    }
  };
  const runApplyDigest = async (dryRun: boolean) => {
    setDigestTesting(dryRun ? "dryrun" : "send");
    try {
      const headers = await cloudFnHeaders();
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-apply-digest`, {
        method: "POST", headers, body: dryRun ? JSON.stringify({ dryRun: true }) : "{}"
      });
      const body = await res.json().catch(() => ({})) as { sent?: boolean; dryRun?: boolean; wouldEmail?: number; emailsSent?: number; recipients?: string[]; reason?: string };
      if (dryRun && body.dryRun) {
        setApplyRecipients(body.recipients ?? []);
        toast(`📡 Dry run — would email ${body.wouldEmail ?? 0} user${(body.wouldEmail ?? 0) === 1 ? "" : "s"} (nothing sent)`);
      } else if (body.sent) {
        toast(`📬 Digest broadcast OK — ${body.emailsSent ?? 0} email${body.emailsSent === 1 ? "" : "s"} sent`);
      } else {
        toast("✗ " + (body.reason ?? "Broadcast failed"));
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Digest test failed"));
    } finally {
      setDigestTesting(null);
    }
  };
  /* native digest email — authenticated by the admin session; no local secrets */
  /* company question-frequency editor + publish audit (weekly digest) */
  const [freqCo, setFreqCo] = useState<string | null>(null);
  const freqCompanies = COMPANIES.filter(c => c.id !== "general");
  const setFreq = (pid: string, v: number) => {
    if (!freqCo) return;
    const next = { ...(config.companyFreq ?? {}) };
    const co = { ...(next[freqCo] ?? {}) };
    if (v === 0) delete co[pid];
    else co[pid] = v as 1 | 2 | 3;
    next[freqCo] = co;
    setConfig({ ...config, companyFreq: next });
  };
  const [audit, setAudit] = useState<FreqAuditEntry[]>(() => getFreqAudit());
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  useEffect(() => {
    let on = true;
    adminListUsers()
      .then(rows => { if (on) setActiveWeek(rows.filter(r => r.last_seen && Date.now() - new Date(r.last_seen).getTime() < 7 * 86_400_000).length); })
      .catch(() => {});
    return () => { on = false; };
  }, []);

  const publish = async () => {
    setBusy(true);
    try {
      await saveRemoteConfig({
        features: config.features, ai: config.ai, limits: config.limits,
        companyFreq: config.companyFreq ?? {},        coachVocab: config.coachVocab, rag: config.rag,
        /* visual picker writes straight into config.resumeBranding; the raw
           JSON textarea is a merge-on-top override for advanced edits */
        resumeBranding: { ...(config.resumeBranding ?? {}), ...parseBrandJson(brandJson) },
        jobs: {
          refreshHours: Math.max(1, Math.round(jobsHours) || 24),
          sources: jobsSources.split(/\n/).map(l => l.trim()).filter(Boolean).map(l => {
            const [provider, ...rest] = l.split(":");
            return { provider: provider.trim(), board: rest.join(":").trim() };
          }),
          salaryEnrichment: {
            provider: enrProvider === "none" ? "none" : (enrProvider as "adzuna" | "adzuna-jobsworth"),
            country: enrCountry || "us",
            cap: Math.max(1, Math.min(200, enrCap || 30))
          }
        }
      });
      /* the enrichment row is server-read by jobs-fetch (client cache only
         holds the RemoteConfig copy) */
      if (enrProvider !== "none") {
        await saveJobSalaryEnrichment({ provider: enrProvider, country: enrCountry || "us", cap: Math.max(1, Math.min(200, enrCap || 30)) });
      }
      /* record what changed since the last publish for the weekly digest */
      const prev = audit[0]?.snapshot ?? {};
      const next = config.companyFreq ?? {};
      const changes: FreqChange[] = [];
      for (const [co, entries] of Object.entries(next)) {
        for (const [pid, raw] of Object.entries(entries)) {
          const to = raw as number;
          if (prev[co]?.[pid] !== to) changes.push({ company: co, problem: pid, to });
        }
      }
      for (const [co, entries] of Object.entries(prev)) {
        for (const pid of Object.keys(entries)) {
          if (!next[co]?.[pid]) changes.push({ company: co, problem: pid, to: 0 });
        }
      }
      const entry: FreqAuditEntry = { at: Date.now(), changes, snapshot: JSON.parse(JSON.stringify(next)) };
      const nextAudit = [entry, ...audit].slice(0, 50);
      saveFreqAudit(nextAudit);
      setAudit(nextAudit);
      toast("🎛️ Config published — clients pick it up on next sync");
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🚩 Feature flags</h2>
        <p className="mb-3 text-[12.5px] text-mut">Turn product areas on/off without shipping code. Clients hide the nav entry when a feature is off.</p>
        <div className="space-y-1">
          {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map(f => (
            <OptRow key={f} title={FEATURE_LABELS[f]} sub={config.features[f as keyof NonNullable<RemoteConfig["features"]>] === false ? "Off" : "On"}>
              <Switch checked={config.features[f as keyof NonNullable<RemoteConfig["features"]>] !== false} onChange={v => setFeature(f as keyof NonNullable<RemoteConfig["features"]>, v)} />
            </OptRow>
          ))}
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">✨ AI capabilities</h2>
        <p className="mb-3 text-[12.5px] text-mut">Server-side defaults the product team controls. Users can still override model/base URL locally.</p>
        <div className="space-y-3">
          <OptRow title="AI coaching enabled" sub="Master switch for generative feedback, hints and the tutor">
            <Switch checked={config.ai.enabled !== false} onChange={v => setAi("enabled", v)} />
          </OptRow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumField label="Max tokens" value={config.ai.maxTokens ?? 700} onChange={v => setAi("maxTokens", v)} />
            <NumField label="Temperature (0–2)" value={config.ai.temperature ?? 0.6} step={0.1} onChange={v => setAi("temperature", v)} />
            <label className="block">
              <span className="mb-1 block text-[12px] font-bold text-mut">Suggested model</span>
              <input value={config.ai.model ?? ""} onChange={e => setAi("model", e.target.value)} placeholder="gpt-4o-mini" className="inp w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-bold text-mut">Embeddings model (RAG)</span>
              <input value={config.ai.embeddingsModel ?? ""} onChange={e => setAi("embeddingsModel", e.target.value)} placeholder="text-embedding-3-small" className="inp w-full" />
            </label>
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🎟️ Free quotas</h2>
        <p className="mb-3 text-[12.5px] text-mut">Applied when the paywall is on. Existing sessionsLeft/aiCallsLeft meters read these live.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumField label="Free sessions / month" value={config.limits.sessionsPerMonth ?? 3} onChange={v => setLimit("sessionsPerMonth", v)} />
          <NumField label="Free AI calls / day" value={config.limits.aiPerDay ?? 5} onChange={v => setLimit("aiPerDay", v)} />
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🎨 Resume branding (Apply Kit)</h2>
        <p className="mb-3 text-[12.5px] text-mut">Brand the designed resume per company — accent color + font. <code>_default</code> covers every company without its own entry. Clients apply it on their next sync, no deploy.</p>

        <div className="flex flex-wrap gap-2">
          {brandList().map(co => (
            <button
              key={co}
              onClick={() => pickBrand(co)}
              className={`rounded-full border px-3 py-1 text-[12px] font-extrabold transition-all ${brandCo === co ? "border-acc1/50 bg-acc1/15 text-acctxt" : "border-line/20 bg-deep/40 text-mut hover:text-ink"}`}
            >
              {co === "_default" ? "🌐 Default" : co}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mut">Accent color — {brandCo === "_default" ? "default" : brandCo}</span>
            <div className="flex flex-wrap gap-2">
              {["#4f46e5", "#0ea5e9", "#16a34a", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#111827"].map(hex => (
                <button
                  key={hex}
                  onClick={() => { setBrandAccent(hex); setBrandField(brandCo, hex, brandFont); }}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${brandAccent === hex ? "scale-110 border-ink" : "border-transparent opacity-80 hover:opacity-100"}`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                  aria-label={`Accent ${hex}`}
                />
              ))}
              <label className="relative flex h-8 cursor-pointer items-center gap-1 rounded-full border border-line/25 bg-deep/40 px-2 text-[10.5px] font-bold text-mut" title="Custom color">
                🎨
                <input type="color" className="h-5 w-7 cursor-pointer border-0 bg-transparent p-0" value={/^#[0-9a-f]{6}$/i.test(brandAccent) ? brandAccent : "#4f46e5"}
                  onChange={e => { setBrandAccent(e.target.value); setBrandField(brandCo, e.target.value, brandFont); }} />
              </label>
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mut">Font family</span>
            <select
              className="inp w-full cursor-pointer"
              value={brandFont}
              onChange={e => { setBrandFont(e.target.value); setBrandField(brandCo, brandAccent, e.target.value); }}
            >
              <option value="system">System default</option>
              <option value="Georgia, 'Times New Roman', serif">Serif (classic)</option>
              <option value="'Segoe UI', Arial, sans-serif">Sans (modern)</option>
              <option value="'Courier New', monospace">Mono (technical)</option>
            </select>
            <p className="mt-1 text-[10.5px] text-mut">Applied to the HTML one-pager; the PDF renderer uses its built-in typefaces.</p>
          </div>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-[11.5px] font-bold text-mut hover:text-ink">Raw JSON (advanced)</summary>
          <textarea
            value={brandJson}
            onChange={e => setBrandJson(e.target.value)}
            rows={5}
            placeholder={'{\n  "_default": { "accent": "#4f46e5" },\n  "Airbnb": { "accent": "#ff5a5f" }\n}'}
            className="inp mt-2 w-full font-mono text-[12px]"
          />
        </details>
        <p className="mt-2 text-[11.5px] text-mut">Pick a company above to edit its entry — swatches + font dropdown write back to the same config the publish button sends.</p>
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">💼 Job feed (Apply Kit)</h2>
        <p className="mb-3 text-[12.5px] text-mut">How often the app auto-refreshes job postings, and which boards/feeds to pull from (one <code>provider:board</code> per line — greenhouse, ashby, lever, <code>remoteok:remoteok</code> for RemoteOK's official API, or <code>rss:https://…</code> for public job feeds like We Work Remotely or Himalayas).</p>
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumField label="Auto-refresh every (hours)" value={jobsHours} onChange={v => setJobsHours(Math.max(1, Math.round(v)))} />
        </div>

        {/* last refresh health — a failing board shows up here, not just in logs */}
        {jobsReport && (
          <div className={`mb-3 rounded-xl border p-3 ${Object.keys(jobsReport.errors).length ? "border-warn/30 bg-warn/[.07]" : "border-ok/25 bg-ok/[.06]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-extrabold">
                {Object.keys(jobsReport.errors).length
                  ? `⚠️ Last refresh (${new Date(jobsReport.ran_at).toLocaleString()}) — ${Object.keys(jobsReport.errors).length} source${Object.keys(jobsReport.errors).length > 1 ? "s" : ""} failed`
                  : `✅ Last refresh (${new Date(jobsReport.ran_at).toLocaleString()}) — ${jobsReport.total} jobs (${jobsReport.added} new, ${jobsReport.updated} updated)`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const ageMs = Date.now() - new Date(jobsReport.ran_at).getTime();
                  const hours = Math.max(1, Math.round(jobsHours) || 24);
                  const stale = ageMs > hours * 3_600_000;
                  const mins = Math.round(ageMs / 60_000);
                  const label = mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
                  return (
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${stale ? "bg-warn/15 text-warn" : "bg-ok/10 text-ok"}`}>
                      {stale ? `⚠️ ${label} (stale)` : `🟢 ${label}`}
                    </span>
                  );
                })()}
                <button className={btnGhost + btnSm} disabled={jobsRefreshing} onClick={() => void runJobsRefresh()} title="Refresh the feed now (self-heal)">
                  {jobsRefreshing ? "Refreshing…" : "🔄 Refresh now"}
                </button>
                <button className={btnGhost + btnSm} onClick={() => void loadJobsReport()} title="Re-read the latest refresh report">↻</button>
              </div>
            </div>
            {Object.keys(jobsReport.errors).length > 0 && (
              <div className="mt-2 space-y-1">
                {Object.entries(jobsReport.errors).map(([src, err]) => (
                  <p key={src} className="text-[11.5px] text-warn">
                    <span className="font-mono font-bold">{src}</span> — {err}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(jobsReport.per_source).map(([src, n]) => (
                <span key={src} className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${jobsReport.errors[src] ? "bg-warn/15 text-warn" : "bg-ok/10 text-ok"}`}>
                  {src.replace(/^https?:\/\/[^/]+\//, "")}: {n}
                </span>
              ))}
            </div>
          </div>
        )}
        {jobsReportErr && <p className="mb-2 text-[11.5px] text-warn">⚠️ Couldn't load refresh report — {jobsReportErr}</p>}

        <label className="block">
          <span className="mb-1 block text-[12px] font-bold text-mut">Sources</span>
          <textarea
            value={jobsSources}
            onChange={e => setJobsSources(e.target.value)}
            rows={5}
            placeholder={"greenhouse:lyft\ngreenhouse:airbnb\ngreenhouse:dropbox\nashby:linear\nashby:notion\nrss:https://remotive.com/feed/software-dev\nrss:https://weworkremotely.com/categories/remote-programming-jobs.rss"}
            className="inp w-full font-mono text-[12px]"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { label: "➕ WWR programming", src: "rss:https://weworkremotely.com/categories/remote-programming-jobs.rss" },
            { label: "➕ WWR full-stack", src: "rss:https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss" },
            { label: "➕ 🏔 Himalayas (curated remote)", src: "rss:https://himalayas.app/jobs/rss" },
            { label: "➕ 🚀 RemoteOK (official API)", src: "remoteok:remoteok" },
            { label: "➕ 🇮🇳 fampay (startup)", src: "lever:fampay" },
            { label: "➕ 🇮🇳 cred (startup)", src: "lever:cred" },
            { label: "➕ 🇮🇳 groww (startup)", src: "greenhouse:groww" }
          ].map(o => (
            <button
              key={o.src}
              className="rounded-full border border-line/20 bg-deep/40 px-2.5 py-1 text-[11.5px] font-bold text-mut transition-all hover:text-ink"
              onClick={() => setJobsSources(s => (s.trim() ? s.trim() + "\n" : "") + o.src)}
              title={`Add ${o.src}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-mut">Clients refresh on mount when the feed is older than the interval. The refresh button in the app also re-ingests on demand.</p>
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Salary enrichment</span>
              <select className="inp w-auto cursor-pointer" value={enrProvider} onChange={e => setEnrProvider(e.target.value)}>
                <option value="none">Off — only explicit posting ranges</option>
                <option value="adzuna">Adzuna search (posting data)</option>
                <option value="adzuna-jobsworth">Adzuna Jobsworth (title prediction)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Country code</span>
              <input className="inp w-20" value={enrCountry} onChange={e => setEnrCountry(e.target.value)} placeholder="us" disabled={enrProvider === "none"} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Max jobs / refresh</span>
              <input type="number" min={1} max={200} className="inp w-24" value={enrCap} onChange={e => setEnrCap(Number(e.target.value) || 30)} disabled={enrProvider === "none"} />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-mut">
            Fills salary bands only for postings that didn't state one — explicit ranges are never overwritten, and estimates show
            as “est.” in the app. Provider keys go in the function secrets: <span className="font-mono">ADZUNA_APP_ID</span> + <span className="font-mono">ADZUNA_APP_KEY</span> (Supabase dashboard → Edge Functions → jobs-fetch → Secrets).
          </p>
        </div>
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
          <p className="mt-2 text-[11.5px] text-mut">
            🔒 No secrets are stored in the browser — sends are authenticated by your admin session. The Resend key lives
            only as the function secret <span className="font-mono">RESEND_API_KEY</span> (Supabase → Edge Functions → send-apply-digest → Secrets),
            and the weekly pg_cron broadcast uses <span className="font-mono">APPLY_DIGEST_SECRET</span>.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className={btnGhost + btnSm} onClick={previewApply}>👀 Preview my digest</button>
            <button className={btnGhost + btnSm} disabled={!!digestTesting} onClick={() => void runApplyDigest(true)}>
              {digestTesting === "dryrun" ? "⏳ Counting…" : "📡 Dry-run broadcast"}
            </button>
            <button className={btnPrimary + btnSm} disabled={!!digestTesting} onClick={() => void runApplyDigest(false)}>
              {digestTesting === "send" ? "⏳ Sending…" : "📤 Send broadcast now"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-mut">Dry run counts recipients and shows their emails without sending — the broadcast fires the same empty-body request the pg_cron job sends every Monday.</p>
        </div>
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
          <p className="mt-2 text-[11.5px] text-mut">
            🔒 No secrets in the browser — sends are authenticated by your admin session. The weekly pg_cron broadcast
            uses <span className="font-mono">RECS_DIGEST_SECRET</span> and delivery needs <span className="font-mono">RESEND_API_KEY</span> (function secrets).
            Preview, dry-run, then send the blast here before the cron goes live.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className={btnGhost + btnSm} onClick={previewRecs}>👀 Preview my digest</button>
            <button className={btnGhost + btnSm} disabled={!!recsBusy} onClick={() => void runRecsBroadcast(true)}>
              {recsBusy === "dryrun" ? "⏳ Counting…" : "📡 Dry-run broadcast"}
            </button>
            <button className={btnPrimary + btnSm} disabled={!!recsBusy} onClick={() => void runRecsBroadcast(false)}>
              {recsBusy === "send" ? "⏳ Sending…" : "📤 Send broadcast now"}
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">🇮🇳 India & startup digest — same broadcast, kind: "india"</span>
          <p className="mt-1 text-[11.5px] text-mut">Filters the live feed to the Indian market (India locations, known Indian startups like fampay/cred/groww, and remote roles) and emails each user their top India picks — same secret guard, separate subject line.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className={btnGhost + btnSm} onClick={previewIndiaRecs}>👀 Preview 🇮🇳 digest</button>
            <button className={btnGhost + btnSm} disabled={!!indiaRecsBusy} onClick={() => void runIndiaRecsBroadcast(true)}>
              {indiaRecsBusy === "dryrun" ? "⏳ Counting…" : "📡 Dry-run broadcast"}
            </button>
            <button className={btnPrimary + btnSm} disabled={!!indiaRecsBusy} onClick={() => void runIndiaRecsBroadcast(false)}>
              {indiaRecsBusy === "send" ? "⏳ Sending…" : "📤 Send broadcast now"}
            </button>
          </div>
        </div>
      </div>
      {recsPreview && (
        <Modal onClose={() => setRecsPreview(null)} title="👀 Recommendations digest preview" desc="What this week's email would look like for the profile saved in this browser.">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">{recsPreview}</pre>
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setRecsPreview(null)}>Close</button>
        </Modal>
      )}
      {indiaRecsPreview && (
        <Modal onClose={() => setIndiaRecsPreview(null)} title="👀 🇮🇳 India & startup digest preview" desc="What the India digest would look like for the profile saved in this browser.">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">{indiaRecsPreview}</pre>
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setIndiaRecsPreview(null)}>Close</button>
        </Modal>
      )}
      {indiaRecsRecipients && (
        <Modal onClose={() => setIndiaRecsRecipients(null)} title="📡 🇮🇳 India digest — dry-run recipients" desc={`Would email ${indiaRecsRecipients.length} user${indiaRecsRecipients.length === 1 ? "" : "s"} (nothing sent).`}>
          {indiaRecsRecipients.length ? (
            <ul className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
              {indiaRecsRecipients.map((e, i) => <li key={e} className="px-2 py-1.5">{i + 1}. {e}</li>)}
            </ul>
          ) : (
            <p className="text-[12.5px] text-mut">No recipients — nobody has an uploaded resume with a profile yet.</p>
          )}
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setIndiaRecsRecipients(null)}>Close</button>
        </Modal>
      )}
      {applyPreview && (
        <Modal onClose={() => setApplyPreview(null)} title="👀 Apply digest preview" desc="What this week's email would look like for the tracker in this browser.">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">{applyPreview}</pre>
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setApplyPreview(null)}>Close</button>
        </Modal>
      )}
      {recsRecipients && (
        <Modal onClose={() => setRecsRecipients(null)} title="📡 Recommendations digest — dry-run recipients" desc={`Would email ${recsRecipients.length} user${recsRecipients.length === 1 ? "" : "s"} (nothing sent).`}>
          {recsRecipients.length ? (
            <ul className="max-h-[320px] divide-y divide-line/10 overflow-auto rounded-xl border border-line/15 bg-deep/50 p-2 text-[12.5px] text-fnt">
              {recsRecipients.map((e, i) => <li key={e} className="px-2 py-1.5">{i + 1}. {e}</li>)}
            </ul>
          ) : (
            <p className="rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] text-mut">No one to email yet — users need a synced uploaded resume with a saved profile.</p>
          )}
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setRecsRecipients(null)}>Close</button>
        </Modal>
      )}
      {applyRecipients && (
        <Modal onClose={() => setApplyRecipients(null)} title="📡 Apply digest — dry-run recipients" desc={`Would email ${applyRecipients.length} user${applyRecipients.length === 1 ? "" : "s"} (nothing sent).`}>
          {applyRecipients.length ? (
            <ul className="max-h-[320px] divide-y divide-line/10 overflow-auto rounded-xl border border-line/15 bg-deep/50 p-2 text-[12.5px] text-fnt">
              {applyRecipients.map((e, i) => <li key={e} className="px-2 py-1.5">{i + 1}. {e}</li>)}
            </ul>
          ) : (
            <p className="rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] text-mut">No one to email yet — users need a synced tracker.</p>
          )}
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setApplyRecipients(null)}>Close</button>
        </Modal>
      )}

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">📬 Weekly digest</h2>
        <p className="mb-3 text-[12.5px] text-mut">What changed in the company-frequency rankings over the last 7 days, and how many users are active (they pick up config on their next sync).</p>
        {(() => {
          const week = audit.filter(e => Date.now() - e.at < 7 * 86_400_000);
          const all = week.flatMap(e => e.changes.map(c => ({ ...c, at: e.at })));
          return (
            <div className="text-[12.5px]">
              <div className="mb-2 flex flex-wrap gap-2">
                <Chip tone="co">{all.length} change{all.length === 1 ? "" : "s"} this week</Chip>
                <Chip tone="lvl">👥 {activeWeek ?? "…"} user{activeWeek === 1 ? "" : "s"} active this week</Chip>
              </div>
              {all.length === 0 ? (
                <p className="text-mut">No frequency changes published in the last 7 days.</p>
              ) : (
                <ul className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
                  {all.slice(0, 20).map((c, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-deep/40 px-2.5 py-1">
                      <span className="font-semibold">{companyById(c.company).icon} {companyById(c.company).name} · {c.problem}</span>
                      <span className="text-[11px] font-bold text-acctxt">{c.to === 0 ? "↩ reset to default" : `→ 🔥${c.to}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}
      </div>

      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🔥 Company question frequency</h2>
        <p className="mb-3 text-[12.5px] text-mut">Rank how often each company asks a problem (1 occasional · 2 common · 3 very common). Published overrides merge on top of the baked-in table — no deploy needed, clients pick it up on next sync.</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {freqCompanies.map(c => (
            <button
              key={c.id}
              onClick={() => setFreqCo(freqCo === c.id ? null : c.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${freqCo === c.id ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        {freqCo && (
          <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
            {problemsForCompany(freqCo).map(p => {
              const base = COMPANY_FREQ[freqCo]?.[p.id] ?? 1;
              const cur = config.companyFreq?.[freqCo]?.[p.id];
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-2.5 py-1.5 text-[12px]">
                  <span className="flex-1 truncate font-semibold">{p.title}</span>
                  <span className={`text-[10px] font-extrabold uppercase ${p.difficulty === 1 ? "text-ok" : p.difficulty === 2 ? "text-warn" : "text-bad"}`}>
                    {["Easy", "Medium", "Hard"][p.difficulty - 1]}
                  </span>
                  <span className="text-[10px] font-bold text-mut">base 🔥{base}</span>
                  <select
                    value={cur ?? 0}
                    onChange={e => setFreq(p.id, Number(e.target.value))}
                    className="rounded-lg border border-line/15 bg-deep px-1.5 py-1 text-[11px] font-bold text-ink outline-none"
                  >
                    <option value={0}>Default ({base})</option>
                    <option value={1}>1 · Occasional</option>
                    <option value={2}>2 · Common</option>
                    <option value={3}>3 · Very common</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RAG retrieval — grounding threshold + candidate pool + hard floor the
          tutor and API coach use; published like the frequency table */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🗄️ RAG retrieval</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          How strictly the tutor/coach ground answers in the knowledge base. A higher similarity cutoff means
          fewer (but safer) citations — answers then come from general knowledge and say so. The candidate pool is
          how many vector hits the hybrid re-ranker considers. The hard floor is the similarity at which a chunk is
          cited even with zero shared concepts — the escape hatch when the concept gate is too strict.
          Clients pick these up on next sync.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumField
            label={`Grounding similarity cutoff (0.30–0.80) — current ${config.rag?.minSim ?? 0.45}`}
            value={config.rag?.minSim ?? 0.45} step={0.01}
            onChange={v => setRag("minSim", Math.max(0.1, Math.min(0.95, v)))}
          />
          <NumField
            label={`Vector candidate pool (4–50) — current ${config.rag?.candidatePool ?? 24}`}
            value={config.rag?.candidatePool ?? 24} step={1}
            onChange={v => setRag("candidatePool", Math.max(2, Math.min(50, Math.round(v))))}
          />
          <NumField
            label={`Hard floor, concept-free cite (0.80–0.95) — current ${config.rag?.hardFloor ?? 0.85}`}
            value={config.rag?.hardFloor ?? 0.85} step={0.01}
            onChange={v => setRag("hardFloor", Math.max(0.7, Math.min(0.99, v)))}
          />
        </div>
        <p className="mt-2 text-[11.5px] text-fnt">
          💡 Preview the effect on real retrieval events in <span className="font-bold">Quality → 🛰️ RAG health</span> before publishing.
        </p>
      </div>

      {/* RAG digest alerts — weekly threshold breaches surface in the Quality RAG
          tab and can be delivered via webhook (Slack / email bridge) once a week */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🔔 RAG digest alerts</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Every week the RAG health tab evaluates the last 7 days against these thresholds. A breach shows an
          in-app alert banner; if a delivery webhook is set (Slack incoming webhook or an email bridge), it is
          also delivered once per week. Published like the rest of the config.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumField
            label={`Alert when grounded rate below (%) — current ${config.rag?.digest?.minGroundedRate ?? 60}`}
            value={config.rag?.digest?.minGroundedRate ?? 60} step={1}
            onChange={v => setRagDigest("minGroundedRate", Math.max(0, Math.min(100, Math.round(v))))}
          />
          <NumField
            label={`Alert when empty-hit rate above (%) — current ${config.rag?.digest?.maxEmptyRate ?? 40}`}
            value={config.rag?.digest?.maxEmptyRate ?? 40} step={1}
            onChange={v => setRagDigest("maxEmptyRate", Math.max(0, Math.min(100, Math.round(v))))}
          />
          <NumField
            label={`Alert when gate rejects above — current ${config.rag?.digest?.maxGateRejects ?? 10}`}
            value={config.rag?.digest?.maxGateRejects ?? 10} step={1}
            onChange={v => setRagDigest("maxGateRejects", Math.max(0, Math.round(v)))}
          />
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[12px] font-bold text-mut">
            Delivery webhook URL (Slack / email bridge) — {config.rag?.digest?.webhook ? "set" : "not set"}
          </span>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/…"
            value={config.rag?.digest?.webhook ?? ""}
            onChange={e => setRagDigest("webhook", e.target.value)}
            className="inp w-full"
          />
        </label>
        <p className="mt-2 text-[11.5px] text-fnt">
          💡 Leave the webhook empty for in-app alerts only — the banner shows whenever an alert fires.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold">
            <Switch
              checked={config.rag?.digest?.sendWeekly ?? false}
              onChange={v => setRagDigest("sendWeekly", v)}
            />
            Send the full weekly digest (not just breaches) once per week
          </label>
          <span className="text-[11px] text-mut">— delivered to the webhook each Monday with metrics, top queries and top documents.</span>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-[12px] font-bold text-mut">
            Digest recipients (emails the bridge should mail) — {config.rag?.digest?.email ? "set" : "not set"}
          </span>
          <input
            type="text"
            placeholder="ops@company.com, you@company.com"
            value={config.rag?.digest?.email ?? ""}
            onChange={e => setRagDigest("email", e.target.value)}
            className="inp w-full"
          />
        </label>
        <p className="mt-1 text-[11.5px] text-fnt">
          Passed to the bridge as <span className="font-mono">to</span> — point the webhook at an email bridge (e.g. Zapier → Gmail) to receive the digest by mail.
        </p>
        <div className="mt-3 rounded-xl border border-line/10 bg-deep/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold">
              <Switch
                checked={config.rag?.digest?.nativeEmail ?? false}
                onChange={v => setRagDigest("nativeEmail", v)}
              />
              📧 Native email — send via the <span className="font-mono">send-rag-digest</span> Edge Function (no webhook)
            </label>
          </div>
          {config.rag?.digest?.nativeEmail && (
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-bold text-mut">From address — {config.rag?.digest?.from ? "set" : "default InterviewIQ <digest@interviewiq.app>"}</span>
                <input
                  type="text"
                  placeholder="InterviewIQ <digest@interviewiq.app>"
                  value={config.rag?.digest?.from ?? ""}
                  onChange={e => setRagDigest("from", e.target.value)}
                  className="inp w-full"
                />
              </label>
              <p className="text-[11px] text-fnt">
                🔒 No secrets are stored in the browser — this digest is sent with your admin session and the
                <span className="font-mono"> RESEND_API_KEY</span> function secret (Supabase → Edge Functions → send-rag-digest → Secrets).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* coach vocabulary — concept families + misconception corrections the
          offline tutor uses; published to every client like the frequency table */}
      <div className={`${cardCls} p-5`}>
        <h2 className="mb-1 text-[16px] font-extrabold">🧠 Coach vocabulary</h2>
        <p className="mb-3 text-[12.5px] text-mut">
          Teach the offline tutor new concepts and misconception corrections without a deploy. JSON:
          <span className="font-mono"> {"{"} families: {"{"} family: ["word", "…"] {"}"}, misconceptions: [{"{"} re: "regex", correction: "…" {"}"}] {"}"} </span>
          Family words make answers match (e.g. <span className="font-mono">micro-frontend</span> ≈ splitting); misconception
          regexes settle debates (e.g. <span className="font-mono">"graphql is always better"</span>). Clients apply these on next sync.
        </p>
        <textarea
          value={vocabJson}
          onChange={e => setVocabJson(e.target.value)}
          rows={8}
          spellCheck={false}
          className="inp w-full resize-y font-mono text-[12px] leading-relaxed"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            className={btnGhost + btnSm}
            onClick={() => {
              try {
                const parsed = JSON.parse(vocabJson || "{}") as Record<string, unknown>;
                if (parsed.families !== undefined && (typeof parsed.families !== "object" || Array.isArray(parsed.families))) throw new Error("families must be an object of arrays");
                if (parsed.misconceptions !== undefined && !Array.isArray(parsed.misconceptions)) throw new Error("misconceptions must be an array");
                setConfig({ ...config, coachVocab: (parsed.families || parsed.misconceptions) ? parsed as RemoteConfig["coachVocab"] : undefined });
                toast("✅ Vocabulary staged — hit “Publish config to all clients” to ship it");
              } catch (e) {
                toast("✗ Invalid JSON: " + ((e as Error).message || "parse error"));
              }
            }}
          >
            💾 Validate & stage
          </button>
          {config.coachVocab && (
            <span className="text-[11.5px] text-fnt">
              Staged: {Object.keys(config.coachVocab.families ?? {}).length} famil{(Object.keys(config.coachVocab.families ?? {}).length === 1 ? "y" : "ies")} · {(config.coachVocab.misconceptions ?? []).length} correction{(config.coachVocab.misconceptions ?? []).length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button className={btnPrimary} onClick={publish} disabled={busy}>
          {busy ? <><span className="spinner" /> Publishing…</> : "🚀 Publish config to all clients"}
        </button>
      </div>
    </div>
  );
}

