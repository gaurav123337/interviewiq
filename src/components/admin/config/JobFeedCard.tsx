import { useEffect, useState } from "react";
import { cloudFnHeaders } from "../../../services/cloud";
import { CONFIG } from "../../../config";
import { refreshJobs, lastJobsRefresh, getCareerProfile, listJobs, recommendationsDigest, indiaDigest, rankCompanies } from "../../../services/jobs";
import { applyDigest } from "../../../services/applyTrack";
import { getLastJobsFetchReport, type JobsFetchReport } from "../../../services/admin";
import { type RemoteConfig } from "../../../services/remoteConfig";
import { toast } from "../../../toast";
import { cardCls, btnPrimary, btnGhost, btnSm, NumField, Modal } from "../../ui";

interface JobFeedCardProps {
  config: RemoteConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function JobFeedCard({ config }: JobFeedCardProps) {
  /* job feed (Apply Kit): auto-refresh interval + ATS sources */
  const [jobsHours, setJobsHours] = useState<number>(() => config.jobs?.refreshHours ?? 24);
  const [jobsSources, setJobsSources] = useState<string>(() =>
    (config.jobs?.sources ?? []).map(s => `${s.provider}:${s.board}`).join("\n")
  );
  /* last refresh report */
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

  /* self-heal on view — if the feed is older than the auto-refresh interval */
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

  /* compensation enrichment */
  const [enrProvider, setEnrProvider] = useState<string>(() => config.jobs?.salaryEnrichment?.provider ?? "none");
  const [enrCountry, setEnrCountry] = useState<string>(() => config.jobs?.salaryEnrichment?.country ?? "us");
  const [enrCap, setEnrCap] = useState<number>(() => config.jobs?.salaryEnrichment?.cap ?? 30);

  /* apply digest email */
  const [digestTesting, setDigestTesting] = useState<null | "dryrun" | "send">(null);
  const [applyPreview, setApplyPreview] = useState<string | null>(null);
  const [applyRecipients, setApplyRecipients] = useState<string[] | null>(null);
  const previewApply = () => setApplyPreview(applyDigest());

  /* recommendations digest */
  const [recsBusy, setRecsBusy] = useState<null | "dryrun" | "send">(null);
  const [recsPreview, setRecsPreview] = useState<string | null>(null);
  const [recsRecipients, setRecsRecipients] = useState<string[] | null>(null);

  /* 🇮🇳 India & startup digest */
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
        toast("✗ " + (body.reason ?? "Digest test failed"));
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Digest test failed"));
    } finally {
      setDigestTesting(null);
    }
  };

  return (
    <div className={`${cardCls} p-5`}>
      <h2 className="mb-1 text-[16px] font-extrabold">💼 Job feed (Apply Kit)</h2>
      <p className="mb-3 text-[12.5px] text-mut">How often the app auto-refreshes job postings, and which boards/feeds to pull from (one <code>provider:board</code> per line).</p>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumField label="Auto-refresh every (hours)" value={jobsHours} onChange={v => setJobsHours(Math.max(1, Math.round(v)))} />
      </div>

      {/* last refresh health */}
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
              <button className={btnGhost + btnSm} disabled={jobsRefreshing} onClick={() => void runJobsRefresh()} title="Refresh the feed now">
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
      <p className="mt-2 text-[11.5px] text-mut">Clients refresh on mount when the feed is older than the interval.</p>

      {/* Salary enrichment */}
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
          Fills salary bands only for postings that didn't state one. Provider keys go in function secrets: <span className="font-mono">ADZUNA_APP_ID</span> + <span className="font-mono">ADZUNA_APP_KEY</span>.
        </p>
      </div>

      {/* Apply digest */}
      <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
        <p className="mt-2 text-[11.5px] text-mut">
          🔒 No secrets stored in the browser — authenticated by admin session. The Resend key lives as <span className="font-mono">RESEND_API_KEY</span> function secret.
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
      </div>

      {/* Recommendations digest */}
      <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
        <p className="mt-2 text-[11.5px] text-mut">
          🔒 No secrets in the browser. The weekly pg_cron broadcast uses <span className="font-mono">RECS_DIGEST_SECRET</span>.
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

      {/* India digest */}
      <div className="mt-4 rounded-xl border border-line/10 bg-deep/30 p-4">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">🇮🇳 India & startup digest — same broadcast, kind: "india"</span>
        <p className="mt-1 text-[11.5px] text-mut">Filters the live feed to the Indian market and emails each user their top India picks.</p>
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

      {/* Modals */}
      {recsPreview && (
        <Modal onClose={() => setRecsPreview(null)} title="👀 Recommendations digest preview" desc="What this week's email would look like.">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">{recsPreview}</pre>
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setRecsPreview(null)}>Close</button>
        </Modal>
      )}
      {indiaRecsPreview && (
        <Modal onClose={() => setIndiaRecsPreview(null)} title="👀 🇮🇳 India & startup digest preview" desc="What the India digest would look like.">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">{indiaRecsPreview}</pre>
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setIndiaRecsPreview(null)}>Close</button>
        </Modal>
      )}
      {indiaRecsRecipients && (
        <Modal onClose={() => setIndiaRecsRecipients(null)} title="📡 🇮🇳 India digest — dry-run recipients" desc={`Would email ${indiaRecsRecipients.length} user${indiaRecsRecipients.length === 1 ? "" : "s"}.`}>
          {indiaRecsRecipients.length ? (
            <ul className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
              {indiaRecsRecipients.map((e, i) => <li key={e} className="px-2 py-1.5">{i + 1}. {e}</li>)}
            </ul>
          ) : (
            <p className="text-[12.5px] text-mut">No recipients yet.</p>
          )}
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setIndiaRecsRecipients(null)}>Close</button>
        </Modal>
      )}
      {applyPreview && (
        <Modal onClose={() => setApplyPreview(null)} title="👀 Apply digest preview" desc="What this week's email would look like.">
          <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">{applyPreview}</pre>
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setApplyPreview(null)}>Close</button>
        </Modal>
      )}
      {recsRecipients && (
        <Modal onClose={() => setRecsRecipients(null)} title="📡 Recommendations digest — dry-run recipients" desc={`Would email ${recsRecipients.length} user${recsRecipients.length === 1 ? "" : "s"}.`}>
          {recsRecipients.length ? (
            <ul className="max-h-[320px] divide-y divide-line/10 overflow-auto rounded-xl border border-line/15 bg-deep/50 p-2 text-[12.5px] text-fnt">
              {recsRecipients.map((e, i) => <li key={e} className="px-2 py-1.5">{i + 1}. {e}</li>)}
            </ul>
          ) : (
            <p className="rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] text-mut">No one to email yet.</p>
          )}
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setRecsRecipients(null)}>Close</button>
        </Modal>
      )}
      {applyRecipients && (
        <Modal onClose={() => setApplyRecipients(null)} title="📡 Apply digest — dry-run recipients" desc={`Would email ${applyRecipients.length} user${applyRecipients.length === 1 ? "" : "s"}.`}>
          {applyRecipients.length ? (
            <ul className="max-h-[320px] divide-y divide-line/10 overflow-auto rounded-xl border border-line/15 bg-deep/50 p-2 text-[12.5px] text-fnt">
              {applyRecipients.map((e, i) => <li key={e} className="px-2 py-1.5">{i + 1}. {e}</li>)}
            </ul>
          ) : (
            <p className="rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] text-mut">No one to email yet.</p>
          )}
          <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setApplyRecipients(null)}>Close</button>
        </Modal>
      )}
    </div>
  );
}
