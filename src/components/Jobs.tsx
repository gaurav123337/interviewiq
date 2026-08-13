import { useEffect, useMemo, useState } from "react";
import type { CareerProfile, JobPosting } from "../types";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import { isCloudConfigured } from "../services/cloud";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip, Modal } from "./ui";
import { UpgradeModal } from "./Upgrade";
import { GapPlanModal } from "./GapPlanModal";
import { ResumeKitModal } from "./ResumeKitModal";
import {
  defaultCareerProfile, getCareerProfile, lastJobsRefresh, listJobs, loadJobsFromCloud,
  matchJob, refreshJobs, saveCareerProfile, VERDICT_META
} from "../services/jobs";
import { getRemoteConfig } from "../services/remoteConfig";
import { buildCoverLetter, buildResume, getApplyKit, saveApplyKit } from "../services/applyKit";
import { dueFollowUps, followUpDraft, getTrack, listTracks, markFollowUpNotified, removeRound, saveRound, setFollowUp, setStatus, STATUS_META, STATUS_ORDER, trackSummary, weeklyReport, type ApplyStatus, type ApplyTrack, type InterviewRound } from "../services/applyTrack";
import { fire } from "../services/notifications";
import { downloadZip } from "../services/zip";
import { practiceForRound, type DrillCard } from "../services/drill";
import { getGoal } from "../services/goal";

/* small comma/Enter-driven tag input */
function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const items = draft.split(",").map(s => s.trim()).filter(Boolean);
    if (!items.length) return;
    onChange([...new Set([...value, ...items])]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {value.map(t => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-acc1/35 bg-acc1/10 px-2.5 py-1 text-[12px] font-bold text-acctxt">
            {t}
            <button className="text-[11px] text-mut hover:text-bad" onClick={() => onChange(value.filter(x => x !== t))} aria-label={`Remove ${t}`}>✕</button>
          </span>
        ))}
      </div>
      <input
        className="inp mt-1.5"
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
      />
    </div>
  );
}

export function Jobs() {
  const [profile, setProfile] = useState<CareerProfile | null>(() => getCareerProfile());
  const [jobs, setJobs] = useState<JobPosting[]>(() => listJobs());
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [gapJob, setGapJob] = useState<{ job: JobPosting; missing: string[] } | null>(null);
  const [kitJob, setKitJob] = useState<JobPosting | null>(null);
  const [tracks, setTracks] = useState<Record<string, ApplyTrack>>(() => {
    const m: Record<string, ApplyTrack> = {};
    for (const t of listTracks()) m[t.jobId] = t;
    return m;
  });
  const [due, setDue] = useState<ApplyTrack[]>(() => dueFollowUps());
  const [reportOpen, setReportOpen] = useState(false);
  const [draftJob, setDraftJob] = useState<ApplyTrack | null>(null);
  const [roundJob, setRoundJob] = useState<ApplyTrack | null>(null);

  const proGated = isPaywallEnabled() && getTier() !== "pro";
  const cloud = isCloudConfigured();

  /* pull the latest feed + cloud profile when signed in */
  useEffect(() => {
    if (!cloud) return;
    void loadJobsFromCloud().then(setJobs).catch(() => {});
    void import("../services/jobs").then(({ loadCareerProfileFromCloud }) =>
      loadCareerProfileFromCloud().then(p => { if (p) { setProfile(p); saveCareerProfile(p); } }).catch(() => {})
    );
    /* scheduled refresh — if the feed is older than the admin-tunable
       interval (default 24h), re-ingest so matches never go stale */
    const refreshHours = getRemoteConfig().jobs?.refreshHours ?? 24;
    if (Date.now() - lastJobsRefresh() > refreshHours * 3_600_000) {
      void refresh().catch(() => {});
    }
  }, [cloud]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await refreshJobs();
      setJobs(listJobs());
      toast(`💼 Feed refreshed — ${r.total} jobs (${r.added} new)`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Refresh failed"));
    } finally {
      setRefreshing(false);
    }
  };

  const save = () => {
    if (!profile) return;
    if (!profile.headline.trim()) { toast("Add a headline (e.g. Senior Frontend Engineer)"); return; }
    setSaving(true);
    try {
      saveCareerProfile(profile);
      toast("💾 Career profile saved — matches updated");
    } finally {
      setSaving(false);
    }
  };

  const matchOf = useMemo(() => {
    const m = new Map<string, ReturnType<typeof matchJob>>();
    for (const j of jobs) m.set(j.id, matchJob(profile, j));
    return m;
  }, [profile, jobs]);

  /* due follow-up reminders — surface once per job via notification + banner */
  useEffect(() => {
    const d = dueFollowUps();
    setDue(d);
    if (d.length) {
      void fire("📬 InterviewIQ — follow-up due", `${d.length} job${d.length === 1 ? "" : "s"} waiting on you — tap to review.`);
      d.forEach(t => markFollowUpNotified(t.jobId));
    }
  }, [tracks]);

  const setJobStatus = (jobId: string, status: ApplyStatus) => {
    setStatus(jobId, status);
    setTracks(m => ({ ...m, [jobId]: getTrack(jobId)! }));
    const meta = STATUS_META[status];
    toast(`${meta.emoji} Marked ${meta.label.toLowerCase()}`);
  };

  const setJobFollowUp = (jobId: string, iso: string) => {
    setFollowUp(jobId, iso ? new Date(iso + "T09:00:00").getTime() : null);
    setTracks(m => ({ ...m, [jobId]: getTrack(jobId)! }));
    toast(iso ? `📅 Follow-up set for ${new Date(iso + "T09:00:00").toLocaleDateString()}` : "🗑️ Follow-up cleared");
  };

  /* batch export — generate a kit for every tracked job and ship as a zip */
  const batchExport = () => {
    const ids = Object.keys(tracks);
    if (!ids.length) { toast("Track at least one job first — set its status on the card."); return; }
    if (!profile) { toast("Save your career profile first."); return; }
    const entries: { name: string; content: string }[] = [];
    let n = 0;
    for (const id of ids) {
      const job = jobs.find(j => j.id === id);
      if (!job) continue;
      const m = matchOf.get(id) ?? null;
      const existing = getApplyKit(id);
      const resume = existing?.resume ?? buildResume(profile, job, m);
      const cover = existing?.coverLetter ?? buildCoverLetter(profile, job, m);
      if (!existing) saveApplyKit({ jobId: id, jobTitle: job.title, company: job.company, resume, coverLetter: cover, ai: false, createdAt: Date.now() });
      const safe = job.company.replace(/[^\w-]+/g, "-");
      entries.push({ name: `${safe}/${job.title.replace(/[^\w-]+/g, "-")}-resume.txt`, content: resume });
      entries.push({ name: `${safe}/${job.title.replace(/[^\w-]+/g, "-")}-cover-letter.txt`, content: cover });
      n++;
    }
    if (!n) { toast("No tracked jobs found in the current feed."); return; }
    downloadZip(entries, `interviewiq-apply-kit-${new Date().toISOString().slice(0, 10)}.zip`);
    toast(`📦 ${n} job kit${n === 1 ? "" : "s"} exported (${entries.length} files)`);
  };

  return (
    <div className="anim-view mx-auto w-full max-w-[980px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[11.5px] font-extrabold uppercase tracking-wider text-acc3">Apply kit · Phase 1</span>
          <h1 className="mt-1 text-[clamp(22px,4vw,30px)] font-extrabold tracking-tight">💼 Job Match</h1>
          <p className="mt-1 text-[13px] text-mut">Your career profile drives the match verdict — strong fit, or a gap to close. Live jobs come from Greenhouse &amp; Ashby boards.</p>
        </div>
        <Chip tone={proGated ? "co" : "ok"}>{proGated ? "🔒 Verdicts are Pro" : "✨ Pro active"}</Chip>
      </div>

      {/* career profile */}
      <div className={`${cardCls} mt-5 overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">🧑‍💼 Career profile</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Fill this once — the matcher compares it against every job's required skills. Save anytime; synced to your account when signed in.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Headline</span>
            <input className="inp" placeholder="e.g. Senior Frontend Engineer (React + TypeScript)" value={profile?.headline ?? ""}
              onChange={e => setProfile(p => p ? { ...p, headline: e.target.value } : p)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Years of experience</span>
            <input type="number" min={0} max={40} className="inp" value={profile?.years ?? 0}
              onChange={e => setProfile(p => p ? { ...p, years: Number(e.target.value) || 0 } : p)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Location</span>
            <input className="inp" placeholder="e.g. Bengaluru, India" value={profile?.location ?? ""}
              onChange={e => setProfile(p => p ? { ...p, location: e.target.value } : p)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Work authorization</span>
            <input className="inp" placeholder="e.g. India citizen / Any" value={profile?.workAuth ?? ""}
              onChange={e => setProfile(p => p ? { ...p, workAuth: e.target.value } : p)} />
          </label>
          <div className="flex items-end gap-2">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line/15 bg-wht/10 px-3.5 py-2.5 text-[13px] font-bold">
              <input type="checkbox" checked={profile?.remote ?? true} onChange={e => setProfile(p => p ? { ...p, remote: e.target.checked } : p)} className="h-4 w-4 accent-[#6366f1]" />
              Prefer remote / hybrid
            </label>
            {!profile && (
              <button className={btnGhost + btnSm} onClick={() => setProfile(defaultCareerProfile())}>⚡ Prefill from my skills</button>
            )}
          </div>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Target titles</span>
            <TagInput value={profile?.targetTitles ?? []} onChange={v => setProfile(p => p ? { ...p, targetTitles: v } : p)} placeholder="Frontend Engineer, Full Stack Developer…" />
          </div>
          <div className="sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Skills</span>
            <TagInput value={profile?.skills ?? []} onChange={v => setProfile(p => p ? { ...p, skills: v } : p)} placeholder="react, typescript, node, aws…" />
          </div>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Summary (optional)</span>
            <textarea className="inp h-20 resize-y" placeholder="One or two lines about you — used for tailored resumes later." value={profile?.summary ?? ""}
              onChange={e => setProfile(p => p ? { ...p, summary: e.target.value } : p)} />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
          <span className="text-[11.5px] text-fnt">{profile ? `${profile.skills.length} skills · ${profile.targetTitles.length} target titles` : "No profile yet — prefill from your diagnostic or fill it in."}</span>
          <button className={btnPrimary + btnSm} onClick={save} disabled={saving || !profile}>💾 Save profile</button>
        </div>
      </div>

      {/* tracker strip */}
      <div className={`${cardCls} mt-5 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 p-5">
          <div>
            <h3 className="text-[14.5px] font-extrabold">🗂️ Apply tracker</h3>
            <p className="mt-0.5 text-[11.5px] text-fnt">Statuses + follow-up dates per job. {proGated ? "Pro feature." : "Set a status on any card to start."}</p>
          </div>
          <div className="flex gap-2">
            <button className={btnGhost + btnSm} onClick={() => setReportOpen(true)} disabled={proGated}>
              📊 Weekly report
            </button>
            <button className={btnGhost + btnSm} onClick={batchExport} disabled={proGated}>
              📦 Export all kits (.zip)
            </button>
          </div>
        </div>
        {proGated ? (
          <div className="p-5">
            <button className="w-full rounded-xl border border-acc1/30 bg-acc1/5 px-4 py-3 text-[13px] font-bold text-acctxt transition-all hover:bg-acc1/15"
              onClick={() => setUpgrade("The apply tracker and batch export are Pro features.")}>
              🔒 Unlock the tracker to manage every application
            </button>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map(s => {
                const c = trackSummary()[s];
                return (
                  <Chip key={s} tone={STATUS_META[s].tone}>
                    {STATUS_META[s].emoji} {STATUS_META[s].label}: {c}
                  </Chip>
                );
              })}
            </div>
            {due.length > 0 && (
              <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
                <p className="text-[13px] font-extrabold text-warn">📬 {due.length} follow-up{due.length === 1 ? "" : "s"} due</p>
                <p className="mt-0.5 text-[12px] text-fnt">{due.map(d => d.jobId).join(", ")} — open the card, update the status, or snooze the date.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* match feed */}
      <div className={`${cardCls} mt-5 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 p-5">
          <div>
            <h3 className="text-[14.5px] font-extrabold">🎯 Match feed ({jobs.length})</h3>
            <p className="mt-0.5 text-[11.5px] text-fnt">Verdicts compare the job's required skills against your profile. {proGated ? "Unlock Pro for the full reasons." : ""}</p>
          </div>
          <button className={btnGhost + btnSm} onClick={refresh} disabled={refreshing || !cloud}>
            {refreshing ? "⏳ Refreshing…" : "🔄 Refresh feed"} {!cloud && "(sign in)"}
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-[26px]">🕳️</div>
            <p className="mt-2 text-[13.5px] font-bold">No jobs yet</p>
            <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-mut">
              {cloud ? "Tap “Refresh feed” to pull live jobs from Greenhouse and Ashby boards." : "Sign in to fetch the live feed (jobs come from public ATS boards)."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line/10">
            {jobs.map(j => {
              const m = matchOf.get(j.id);
              const locked = proGated;
              return (
                <li key={j.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className={`rounded-full px-2.5 py-1 text-[12px] font-extrabold transition-all ${locked ? "border border-line/15 bg-wht/10 text-mut hover:text-ink" : ""}`}
                      onClick={() => locked && setUpgrade("Match verdicts, reasons and the skill-gap roadmap are Pro features.")}
                      title={locked ? "Pro feature" : VERDICT_META[m!.verdict].label}
                    >
                      {locked ? "🔒 Match verdict" : `${m!.score}% · ${VERDICT_META[m!.verdict].label}`}
                    </button>
                    <span className="text-[14px] font-extrabold">{j.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-mut">
                    <span className="font-bold text-ink">{j.company}</span>
                    {j.location && <span>📍 {j.location}</span>}
                    {j.remote && <Chip tone="ok">REMOTE</Chip>}
                    {j.level && <span>· {j.level}</span>}
                    <span className="text-[11px]">{j.source}</span>
                    {j.url && <a href={j.url} target="_blank" rel="noreferrer" className="font-bold text-acctxt hover:underline">View →</a>}
                  </div>
                  {!locked && m && (m.matched.length || m.missing.length || m.blockers.length) && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
                      {m.matched.length > 0 && (
                        <span>✓ <span className="text-ok">Matched:</span> {m.matched.join(", ")}</span>
                      )}
                      {m.missing.length > 0 && (
                        <span>✗ <span className="text-bad">Missing:</span> {m.missing.join(", ")}</span>
                      )}
                      {m.missing.length > 0 && (
                        <button
                          className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
                          onClick={() => setGapJob({ job: j, missing: m.missing })}
                        >
                          📈 Gap plan
                        </button>
                      )}
                      <button
                        className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
                        onClick={() => (locked ? setUpgrade("Tailored resumes and cover letters are Pro features.") : setKitJob(j))}
                      >
                        📄 Resume & letter
                      </button>
                      {m.blockers.map((b, i) => (
                        <span key={i} className="text-warn">⚠️ {b}</span>
                      ))}
                    </div>
                  )}
                  {!locked && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line/10 pt-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Track:</span>
                      <select
                        className="cursor-pointer rounded-full border border-line/20 bg-deep/40 px-2.5 py-1 text-[11.5px] font-bold text-fnt outline-none transition-all hover:text-ink"
                        value={tracks[j.id]?.status ?? "saved"}
                        onChange={e => setJobStatus(j.id, e.target.value as ApplyStatus)}
                        title="Application status"
                      >
                        {STATUS_ORDER.map(s => (
                          <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        className="cursor-pointer rounded-full border border-line/20 bg-deep/40 px-2.5 py-1 text-[11.5px] font-bold text-fnt outline-none transition-all hover:text-ink"
                        value={tracks[j.id]?.followUpAt ? new Date(tracks[j.id]!.followUpAt!).toISOString().slice(0, 10) : ""}
                        onChange={e => setJobFollowUp(j.id, e.target.value)}
                        title="Follow-up date — you'll be reminded when it's due"
                      />      {tracks[j.id] && (tracks[j.id]!.status === "applied" || tracks[j.id]!.status === "interview" || tracks[j.id]!.status === "offer") && (
        <button
          className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-1 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
          onClick={() => setDraftJob(tracks[j.id]!)}
          title="Copy a professional follow-up message"
        >
          ✍️ Follow-up
        </button>
      )}
      {tracks[j.id]?.status === "interview" && (
        <button
          className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-1 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
          onClick={() => setRoundJob(tracks[j.id]!)}
          title="Track interview rounds — what was asked and how it went"
        >
          🎤 Rounds {tracks[j.id]!.rounds.length > 0 ? `(${tracks[j.id]!.rounds.length})` : ""}
        </button>
      )}
                    </div>
                  )}
                  {locked && (
                    <p className="mt-2 text-[11.5px] text-mut">Unlock Pro to see why this is or isn't a match — and get a step-by-step plan to close the gaps.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {upgrade && <UpgradeModal onClose={() => setUpgrade(null)} reason={upgrade} />}
      {gapJob && <GapPlanModal job={gapJob.job} missing={gapJob.missing} onClose={() => setGapJob(null)} />}
      {kitJob && profile && <ResumeKitModal job={kitJob} profile={profile} match={matchOf.get(kitJob.id) ?? null} onClose={() => setKitJob(null)} />}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
      {draftJob && (
        <DraftModal
          track={draftJob}
          job={jobs.find(j => j.id === draftJob.jobId) ?? null}
          onClose={() => setDraftJob(null)}
        />
      )}
      {roundJob && (
        <RoundModal
          track={roundJob}
          jobTitle={jobs.find(j => j.id === roundJob.jobId)?.title ?? roundJob.jobId}
          company={jobs.find(j => j.id === roundJob.jobId)?.company ?? ""}
          onClose={() => setRoundJob(null)}
          onChanged={t => setTracks(m => ({ ...m, [t.jobId]: t }))}
        />
      )}
    </div>
  );
}

/* weekly application report — activity, response rate, follow-up completion */
function ReportModal({ onClose }: { onClose: () => void }) {
  const r = weeklyReport();
  const maxApplied = Math.max(1, ...r.byWeek.map(w => w.applied));
  return (
    <Modal onClose={onClose} title="📊 Weekly report" desc="Your last 7 days of application activity — where the funnel moves, and where it stalls.">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Applied", value: r.applied, tone: "text-acc3" },
          { label: "Interviews", value: r.interviews, tone: "text-ok" },
          { label: "Offers", value: r.offers, tone: "text-ok" },
          { label: "Rejections", value: r.rejections, tone: "text-bad" }
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-line/15 bg-deep/30 p-3 text-center">
            <div className={`text-2xl font-extrabold ${c.tone}`}>{c.value}</div>
            <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-mut">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-line/15 bg-deep/30 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Response rate</div>
          <div className="mt-1 text-xl font-extrabold text-acc1">{r.responseRate}%</div>
          <p className="mt-0.5 text-[11px] text-mut">{r.interviews} of {r.applied} applications advanced to an interview.</p>
        </div>
        <div className="rounded-xl border border-line/15 bg-deep/30 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Pipeline funnel</div>
          <div className="mt-2 space-y-1.5">
            {[
              { label: "Applied", n: r.applied, w: 100 },
              { label: "Interviews", n: r.interviews, w: r.applied ? Math.max(8, (r.interviews / r.applied) * 100) : 0 },
              { label: "Offers", n: r.offers, w: r.applied ? Math.max(4, (r.offers / r.applied) * 100) : 0 }
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="w-[64px] text-[10.5px] font-bold text-mut">{s.label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-deep/40">
                  <div className="flex h-full items-center justify-end rounded bg-acc1/40 px-1" style={{ width: `${s.w}%` }}>
                    <span className="text-[10px] font-extrabold text-acctxt">{s.n}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line/15 bg-deep/30 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Follow-ups</div>
          <div className="mt-1 text-xl font-extrabold">{r.followUpsDone}<span className="text-mut">/{r.followUpsDue + r.followUpsDone} done</span></div>
          <p className="mt-0.5 text-[11px] text-mut">{r.followUpsDue > 0 ? `${r.followUpsDue} still due — use the ✍️ Follow-up drafts on each card.` : "All caught up — nice."}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mut">Applications — last 4 weeks</div>
        <div className="space-y-1.5">
          {r.byWeek.map(w => (
            <div key={w.label} className="flex items-center gap-2">
              <span className="w-16 text-[11px] font-bold text-mut">{w.label}</span>
              <div className="h-5 flex-1 overflow-hidden rounded-md bg-deep/40">
                <div className="flex h-full items-center gap-1 rounded-md bg-acc1/30 px-1.5" style={{ width: `${(w.applied / maxApplied) * 100}%` }}>
                  <span className="text-[10px] font-extrabold text-acctxt">{w.applied}</span>
                </div>
              </div>
              <span className="w-16 text-right text-[10.5px] text-mut">{w.interviews} 📞</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mut">Momentum — last 8 weeks</div>
        <div className="flex h-24 items-end gap-1.5">
          {(() => {
            const max = Math.max(1, ...r.momentum.map(w => w.applied));
            return r.momentum.map(w => (
              <div key={w.label} className="flex flex-1 flex-col items-center gap-1" title={`${w.label}: ${w.applied} applied, ${w.interviews} interviews`}>
                <span className="text-[10px] font-extrabold text-acc1">{w.applied > 0 ? w.applied : ""}</span>
                <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-acc1/40" style={{ height: `${(w.applied / max) * 100}%` }} />
                  <div className="w-1/2 rounded-t bg-ok/50" style={{ height: `${((w.interviews || 0) / max) * 100}%` }} />
                </div>
                <span className="w-full truncate text-center text-[9px] font-bold text-mut">{w.label}</span>
              </div>
            ));
          })()}
        </div>
        <div className="mt-1.5 flex justify-center gap-4 text-[10.5px] text-mut">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-acc1/50" /> Applied</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-ok/60" /> Interviews</span>
        </div>
      </div>

      <button className="mt-5 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
        Done — close
      </button>
    </Modal>
  );
}

/* interview rounds — per-round checklist: what was asked, how it went, next-round review */
function RoundModal({ track, jobTitle, company, onClose, onChanged }: {
  track: ApplyTrack;
  jobTitle: string;
  company: string;
  onClose: () => void;
  onChanged: (t: ApplyTrack) => void;
}) {
  const [rounds, setRounds] = useState<InterviewRound[]>(() => track.rounds);
  const [practice, setPractice] = useState<{ round: InterviewRound; cards: DrillCard[] } | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<InterviewRound | null>(null);
  const [label, setLabel] = useState("");
  const [at, setAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [questions, setQuestions] = useState("");
  const [went, setWent] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<InterviewRound["outcome"]>("pending");

  const startEdit = (r: InterviewRound | null) => {
    /* null = create a new round; editing must hold a truthy stub so the form opens */
    setEditing(r ?? { id: "", label: "", at: Date.now(), questions: "", went: null, outcome: "pending" });
    setLabel(r?.label ?? `Round ${rounds.length + 1}`);
    setAt(r ? new Date(r.at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setQuestions(r?.questions ?? "");
    setWent(r?.went ?? null);
    setOutcome(r?.outcome ?? "pending");
  };

  const save = () => {
    if (!label.trim()) { toast("Name the round (e.g. Phone screen, System design)"); return; }
    const round: InterviewRound = {
      id: editing?.id ?? `r${Date.now()}`,
      label: label.trim(),
      at: new Date(at + "T12:00:00").getTime(),
      questions: questions.trim(),
      went,
      outcome
    };
    const next = saveRound(track.jobId, round);
    setRounds(next.rounds);
    onChanged(next);
    setEditing(null);
    toast("🎤 Round saved");
  };

  const del = (id: string) => {
    const next = removeRound(track.jobId, id);
    if (!next) return;
    setRounds(next.rounds);
    onChanged(next);
    toast("🗑️ Round removed");
  };

  /* a failed/low-rated round → a targeted drill deck from its own notes */
  const startPractice = (r: InterviewRound) => {
    const field = getGoal()?.fieldId ?? "frontend";
    const cards = practiceForRound(r.questions || r.label, field);
    if (!cards.length) { toast("No practice cards found for those topics — try more specific round notes."); return; }
    setPractice({ round: r, cards });
    setFlipped({});
  };

  return (
    <Modal onClose={onClose} title="🎤 Interview rounds" desc={`What was asked, how it went, and what to review next — for ${jobTitle}${company ? ` at ${company}` : ""}.`}>
      {rounds.length === 0 && !editing && (
        <div className="rounded-xl border border-line/15 bg-deep/30 p-4 text-center">
          <p className="text-[12.5px] text-mut">No rounds yet. Add the first one — the prep checklist lives here so you walk into each round knowing what to review.</p>
          <button className={`${btnGhost} ${btnSm} mt-3`} onClick={() => startEdit(null)}>+ Add round</button>
        </div>
      )}

      <div className="space-y-2.5">
        {rounds.map(r => (
          <div key={r.id} className="rounded-xl border border-line/15 bg-deep/30 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-extrabold">{r.label}</span>
                <Chip tone={r.outcome === "passed" ? "ok" : r.outcome === "failed" ? "bad" : "default"}>
                  {r.outcome === "passed" ? "✅ Passed" : r.outcome === "failed" ? "❌ Failed" : "⏳ Pending"}
                </Chip>
                {r.went !== null && <Chip tone="co">{"⭐".repeat(Math.max(1, Math.min(5, r.went)))}</Chip>}
              </div>
              <span className="text-[11px] text-mut">{new Date(r.at).toLocaleDateString()}</span>
            </div>
            {r.questions && <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-fnt">{r.questions}</p>}
            <div className="mt-2 flex gap-3">
              <button className="text-[11.5px] font-bold text-acctxt hover:underline" onClick={() => startEdit(r)}>✏️ Edit</button>
              <button className="text-[11.5px] font-bold text-bad hover:underline" onClick={() => del(r.id)}>🗑️ Remove</button>
              {(r.outcome === "failed" || (r.went !== null && r.went <= 2)) && r.questions.trim() && (
                <button className="text-[11.5px] font-extrabold text-ok hover:underline" onClick={() => startPractice(r)}>🎯 Practice these</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {rounds.length > 0 && !editing && !practice && (
        <button className={`${btnGhost} ${btnSm} mt-3 w-full`} onClick={() => startEdit(null)}>+ Add round</button>
      )}

      {practice && (
        <div className="mt-3 rounded-xl border border-ok/25 bg-ok/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-extrabold text-ok">🎯 Practice deck — “{practice.round.label}”</p>
            <button className="text-[11.5px] font-bold text-mut hover:text-ink" onClick={() => setPractice(null)}>✕ Close</button>
          </div>
          <p className="mt-0.5 text-[11.5px] text-fnt">Rehearse exactly what this round covered — {practice.cards.length} cards pulled from the question bank by your round's notes.</p>
          <div className="mt-3 space-y-2">
            {practice.cards.map(c => {
              const show = flipped[c.q];
              return (
                <div key={c.q} className="rounded-xl border border-line/15 bg-deep/30 p-3">
                  <button className="w-full text-left" onClick={() => setFlipped(f => ({ ...f, [c.q]: !f[c.q] }))}>
                    <span className="text-[12.5px] font-bold text-ink">{c.q}</span>
                    {show && (
                      <span className="mt-1.5 block whitespace-pre-wrap text-[12px] leading-relaxed text-fnt">
                        <span className="font-bold text-ok">Answer:</span> {c.a}
                        {c.kp?.length ? <span className="mt-1 block text-[11px] text-mut">Key points: {c.kp.join(" · ")}</span> : null}
                      </span>
                    )}
                  </button>
                  <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-mut">{show ? "Tap question to hide" : "Tap to reveal the answer"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-3 rounded-xl border border-acc1/25 bg-acc1/5 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Round name</span>
              <input className="inp" value={label} onChange={e => setLabel(e.target.value)} placeholder="Phone screen" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Date</span>
              <input type="date" className="inp" value={at} onChange={e => setAt(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">What was asked / what to review</span>
            <textarea className="inp h-20 resize-y" value={questions} onChange={e => setQuestions(e.target.value)} placeholder="Questions asked, topics to review before the next round…" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-mut">How it went</span>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} className={`text-[16px] transition-all ${went === n ? "scale-125" : "opacity-40 hover:opacity-80"}`} onClick={() => setWent(went === n ? null : n)}>⭐</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["pending", "passed", "failed"] as const).map(o => (
              <button
                key={o}
                className={`rounded-full px-3 py-1 text-[12px] font-extrabold transition-all ${outcome === o ? "bg-acc1/20 text-acctxt" : "bg-deep/40 text-mut hover:text-ink"}`}
                onClick={() => setOutcome(o)}
              >
                {o === "pending" ? "⏳ Pending" : o === "passed" ? "✅ Passed" : "❌ Failed"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary + btnSm} onClick={save}>💾 Save round</button>
            <button className={btnGhost + btnSm} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <p className="mt-4 text-[11.5px] text-mut">Rounds sync to your account like the rest of the tracker — review this checklist before each round and you'll walk in knowing exactly what to brush up.</p>
      <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
        Done — close
      </button>
    </Modal>
  );
}

/* follow-up message draft — stage-specific, copy-ready */
function DraftModal({ track, job, onClose }: { track: ApplyTrack; job: JobPosting | null; onClose: () => void }) {
  const title = job?.title ?? track.jobId;
  const company = job?.company ?? "";
  const daysSince = track.appliedAt ? Math.max(1, Math.round((Date.now() - track.appliedAt) / 86_400_000)) : 7;
  const draft = followUpDraft(track.status, title, company, daysSince);
  const copy = () => {
    navigator.clipboard?.writeText(draft).then(
      () => toast("📋 Draft copied — paste it into your email"),
      () => toast("✗ Clipboard blocked — copy manually")
    );
  };
  return (
    <Modal onClose={onClose} title="✍️ Follow-up draft" desc={`A ${STATUS_META[track.status].label.toLowerCase()}-stage nudge for ${title}${company ? ` at ${company}` : ""}.`}>
      <pre className="max-h-[44vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/40 p-4 font-sans text-[13px] leading-relaxed text-fnt">
        {draft}
      </pre>
      <p className="mt-3 text-[11.5px] text-mut">Customize the placeholders (names, dates) before sending — then mark the stage on the card so the tracker stays honest.</p>
      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-xl bg-acc1/15 py-2.5 text-[13px] font-extrabold text-acctxt transition-all hover:bg-acc1/25" onClick={copy}>
                          📋 Copy draft
        </button>
        <button className="flex-1 rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
                          Close
        </button>
      </div>
    </Modal>
  );
}
