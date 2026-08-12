import { useEffect, useMemo, useState } from "react";
import type { CareerProfile, JobPosting } from "../types";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import { isCloudConfigured } from "../services/cloud";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip } from "./ui";
import { UpgradeModal } from "./Upgrade";
import { GapPlanModal } from "./GapPlanModal";
import {
  defaultCareerProfile, getCareerProfile, lastJobsRefresh, listJobs, loadJobsFromCloud,
  matchJob, refreshJobs, saveCareerProfile, VERDICT_META
} from "../services/jobs";
import { getRemoteConfig } from "../services/remoteConfig";

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
                      {m.blockers.map((b, i) => (
                        <span key={i} className="text-warn">⚠️ {b}</span>
                      ))}
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
    </div>
  );
}
