import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CareerProfile, JobPosting, UploadedResume } from "../types";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import { isCloudConfigured } from "../services/cloud";
import { toast } from "../toast";
import {btnGhost, btnPrimary, btnSm, cardCls, Chip, Modal} from "./ui";
import { UpgradeModal } from "./Upgrade";
import { GapPlanModal } from "./GapPlanModal";
import { ResumeKitModal } from "./ResumeKitModal";
import {
  addImportedJob, dedupeJobs, EMPTY_FILTERS, EMPTY_RANK_FILTERS, filterJobs, filterRanks, getCareerProfile,
  lastJobsRefresh, listJobs, listShortlist, loadJobsFromCloud, matchJob, rankCompanies, refreshJobs,
  recommendationReason, salaryLabel, saveCareerProfile, skillImpact, sortJobsByMatch, toggleShortlist, VERDICT_META, type JobFilters, type RankFilters
} from "../services/jobs";
import { analyzeResume, clearUploadedResume, getUploadedResume, profileHasStaleSkills, resumeToProfile, saveUploadedResume, suggestSkills } from "../services/resume";
import { sourceLabel, sourcePriority } from "../services/importJob";
import { getDisplayCurrency, setDisplayCurrency } from "../services/currency";
import { extractFileText } from "../services/pdf";
import { getRemoteConfig } from "../services/remoteConfig";
import { fire } from "../services/notifications";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import {buildCoverLetter, buildResume, getApplyKit, saveApplyKit} from "../services/applyKit";
import {dueFollowUps, getTrack, listTracks, markAppliedVia, markFollowUpNotified, setFollowUp, setStatus, STATUS_META, type ApplyStatus, type ApplyTrack} from "../services/applyTrack";
import {benchLevelForYears, detectMarket, type BenchLevel, type Market} from "../services/salaryBench";

import { downloadZip } from "../services/zip";

import { ReportModal } from "./jobs/ReportModal";
import { ImportModal } from "./jobs/ImportModal";
import { ApplyQueueModal } from "./jobs/ApplyQueueModal";
import { RoundModal } from "./jobs/RoundModal";
import { DraftModal } from "./jobs/DraftModal";
import { RecsDigestModal } from "./jobs/RecsDigestModal";
import { SalaryBenchmarkCard } from "./jobs/SalaryBenchmarkCard";
import { ApplyTrackerCard } from "./jobs/ApplyTrackerCard";
import { ResumeCard } from "./jobs/ResumeCard";
import { CareerProfileCard } from "./jobs/CareerProfileCard";
import { CompanyRankingCard } from "./jobs/CompanyRankingCard";
import { FeedFilters } from "./jobs/FeedFilters";
import { MatchFeedCard } from "./jobs/MatchFeedCard";

/* verdict tone → text color (matches VERDICT_META tones) */
const verdictToneCls = (tone: string) =>
  tone === "ok" ? "text-ok" : tone === "co" ? "text-acctxt" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-mut";
export function Jobs() {
  const [profile, setProfile] = useState<CareerProfile | null>(() => getCareerProfile());
  /* one currency everywhere — persisted preference, defaults from location */
  const displayCurrency = getDisplayCurrency(profile?.location);
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
  const dueIds = useMemo(() => new Set(due.map(d => d.jobId)), [due]);
  const [reportOpen, setReportOpen] = useState(false);
  const [draftJob, setDraftJob] = useState<ApplyTrack | null>(null);
  const [roundJob, setRoundJob] = useState<ApplyTrack | null>(null);
  const [filters, setFilters] = useState<JobFilters>(EMPTY_FILTERS);
  const [resume, setResume] = useState<UploadedResume | null>(() => getUploadedResume());
  const [resumeFormOpen, setResumeFormOpen] = useState(false);
  const [resumeShowAll, setResumeShowAll] = useState(false);
  const [resumePaste, setResumePaste] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  /* skills offered after an upload — the user opts in with ＋, nothing merges */
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([]);
  /* one-time banner: resume was uploaded before strict resume-based skills */
  const [resumeBannerDismissed, setResumeBannerDismissed] = useState(() => storageGet<boolean>(STORAGE_KEYS.resumeStrictBanner, false));
  /* platform import (Lane B) — paste a job URL from any site */
  const [importOpen, setImportOpen] = useState(false);
  /* batch apply queue — work through the just-imported jobs one by one */
  const [applyQueue, setApplyQueue] = useState<JobPosting[] | null>(null);
  /* apply hand-off (Lane C) — first-use explainer shown once */
  const [applyHintShown, setApplyHintShown] = useState(() => storageGet<boolean>(STORAGE_KEYS.externalApplyHint, false));
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [recsDigestOpen, setRecsDigestOpen] = useState(false);
  const [rankLimit, setRankLimit] = useState(10);
  const [rankFilters, setRankFilters] = useState<RankFilters>(EMPTY_RANK_FILTERS);
  const [shortlist, setShortlist] = useState<Set<string>>(() => new Set(listShortlist()));
  const [benchLvl, setBenchLvl] = useState<BenchLevel>(() => benchLevelForYears(profile?.years ?? 0));
  const [benchCo, setBenchCo] = useState("");
  const [benchOpen, setBenchOpen] = useState(false);
  const [market, setMarket] = useState<Market>(() => detectMarket(profile?.location));
  const [expected, setExpected] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerBase, setOfferBase] = useState("");
  const [offerEquity, setOfferEquity] = useState("");

  const proGated = isPaywallEnabled() && getTier() !== "pro";
  const cloud = isCloudConfigured();

  /* pull the latest feed + cloud profile when signed in */
  useEffect(() => {
    if (!cloud) return;
    void loadJobsFromCloud().then(setJobs).catch(() => {});
    void import("../services/jobs").then(({ loadCareerProfileFromCloud }) =>
      loadCareerProfileFromCloud().then(p => { if (p) { setProfile(p); saveCareerProfile(p); } }).catch(() => {})
    );
    /* restore the uploaded resume from the account (it carries its own
       extracted profile — the same data as the career profile above) */
    void import("../services/resume").then(({ loadUploadedResumeFromCloud }) =>
      loadUploadedResumeFromCloud().then(r => {
        if (!r) return;
        setResume(r);
        saveCareerProfile(r.profile);
        setProfile(r.profile);
      }).catch(() => {})
    );
    /* scheduled refresh — if the feed is older than the admin-tunable
       interval (default 24h), re-ingest so matches never go stale */
    const refreshHours = getRemoteConfig().jobs?.refreshHours ?? 24;
    if (Date.now() - lastJobsRefresh() > refreshHours * 3_600_000) {
      void refresh().catch(() => {});
    }
  }, [cloud]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await refreshJobs();
      setJobs(listJobs());
      const fails = Object.keys(r.errors);
      toast(fails.length
        ? `💼 Feed refreshed — ${r.total} jobs (${r.added} new), ⚠️ ${fails.length} source${fails.length > 1 ? "s" : ""} failed: ${fails.join(", ")}`
        : `💼 Feed refreshed — ${r.total} jobs (${r.added} new)`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Refresh failed"));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const save = useCallback(() => {
    if (!profile) return;
    if (!profile.headline.trim()) { toast("Add a headline (e.g. Senior Frontend Engineer)"); return; }
    setSaving(true);
    try {
      saveCareerProfile(profile);
      toast("💾 Career profile saved — matches updated");
    } finally {
      setSaving(false);
    }
  }, [profile]);

  /* one-click ATS fix — add a missing posting skill to the profile; matches
     recompute instantly so the chip flips from ✗ to ✓ where true */
  const addSkillToProfile = (skill: string) => {
    if (!profile) { toast("Save your career profile first."); return; }
    const k = skill.trim();
    if (!k) return;
    if (profile.skills.some(s => s.toLowerCase() === k.toLowerCase())) { toast(`✓ “${k}” is already in your skills`); return; }
    const next = { ...profile, skills: [...profile.skills, k] };
    setProfile(next);
    saveCareerProfile(next);
    toast(`➕ Added “${k}” to your skills — matches updated`);
  };

  const matchOf = useMemo(() => {
    const m = new Map<string, ReturnType<typeof matchJob>>();
    for (const j of jobs) m.set(j.id, matchJob(profile, j));
    return m;
  }, [profile, jobs]);

  /* match feed — cross-source duplicates collapsed, then filtered, then
     sorted by match % descending (best first) */
  const visible = useMemo(
    () => sortJobsByMatch(dedupeJobs(filterJobs(jobs, filters)), id => matchOf.get(id)?.score ?? 0),
    [jobs, filters, matchOf]
  );
  /* pagination — page size persists across sessions; 0 = show all */
  const [feedPageSize, setFeedPageSize] = useState<number>(() => {
    const v = storageGet<number>(STORAGE_KEYS.feedPageSize, 15);
    return [15, 25, 50, 0].includes(v) ? v : 15;
  });
  const [feedLimit, setFeedLimit] = useState<number>(feedPageSize === 0 ? Infinity : feedPageSize);
  /* the page resets to the chosen size whenever filters change */
  useEffect(() => { setFeedLimit(feedPageSize === 0 ? Infinity : feedPageSize); }, [filters, feedPageSize]);
  const pickPageSize = (v: number) => {
    setFeedPageSize(v);
    storageSet(STORAGE_KEYS.feedPageSize, v);
    setFeedLimit(v === 0 ? Infinity : v);
  };

  /* company leaderboard — best match % per company, descending (deduped so
     the same role on Greenhouse + RSS doesn't double-count a company) */
  const ranks = useMemo(() => rankCompanies(profile, dedupeJobs(jobs)), [profile, jobs]);
  const filteredRanks = useMemo(() => filterRanks(ranks, rankFilters, shortlist, displayCurrency), [ranks, rankFilters, shortlist, displayCurrency]);
  /* recommendations — the top picks, with a concrete next step for #1 */
  const topPicks = useMemo(() => filteredRanks.slice(0, 3), [filteredRanks]);
  /* what learning the #1 pick's most-missing skill is worth */
  const gapImpact = useMemo(
    () => (topPicks[0] && !proGated ? skillImpact(profile, topPicks[0]) : null),
    [topPicks, profile, proGated]
  );

  /* one-click add from a suggestion chip — add the skill and drop it from the list */
  const addSuggestedSkill = (s: string) => {
    addSkillToProfile(s);
    setSkillSuggestions(list => list.filter(x => x.toLowerCase() !== s.toLowerCase()));
  };

  /* initial suggestions for a resume already stored from a previous session:
     profile skills the stored resume didn't extract (e.g. from an older
     merged upload) plus typical field skills */
  useEffect(() => {
    if (resume && skillSuggestions.length === 0) {
      const added = (profile?.skills ?? []).filter(s => !resume.profile.skills.some(x => x.toLowerCase() === s.toLowerCase()));
      setSkillSuggestions(suggestSkills(resume.profile.skills, added, analyzeResume(resume.text).fieldId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* show the re-upload banner only while the stored profile carries skills
     the current resume no longer supports (the old merging behavior) — and
     clear it the moment a re-upload resolves the difference */
  useEffect(() => {
    if (resumeBannerDismissed || !resume || !profile) { setShowResumeBanner(false); return; }
    setShowResumeBanner(profileHasStaleSkills(profile, resume.text));
  }, [resume, profile, resumeBannerDismissed]);
  const dismissResumeBanner = () => {
    setShowResumeBanner(false);
    setResumeBannerDismissed(true);
    storageSet(STORAGE_KEYS.resumeStrictBanner, true);
  };

  /* 🔎 Show in feed — filter the match feed to a company, scroll to it, flash it */
  const feedRef = useRef<HTMLDivElement | null>(null);
  const [feedFlash, setFeedFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const showInFeed = (company: string) => {
    setFilters(f => ({ ...f, query: company }));
    setFeedFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFeedFlash(false), 2200);
    feedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const star = (company: string) => setShortlist(new Set(toggleShortlist(company)));
  const isStarred = (company: string) => shortlist.has(company.toLowerCase());
  const filterActive = rankFilters.remoteOnly || rankFilters.minScore > 0 || rankFilters.minSalary > 0 || rankFilters.shortlistOnly;

  const applyResume = (text: string, fileName: string) => {
    try {
      const p = resumeToProfile(text);
      /* skills are STRICTLY what this resume mentions — nothing is merged in.
         Skills you used to have are offered as suggestions instead, so the
         profile always reflects the actual resume. */
      const prevSkills = profile?.skills ?? [];
      /* keep a hand-edited summary across re-uploads (extraction only wins
         when the current summary is still the old extraction) */
      const prevSummary = profile?.summary ?? "";
      const prevExtracted = resume?.profile?.summary ?? "";
      const merged: CareerProfile = {
        ...p,
        location: profile?.location ?? "",
        remote: profile?.remote ?? true,
        workAuth: profile?.workAuth ?? "",
        skills: p.skills,
        summary: prevSummary && prevSummary !== prevExtracted ? prevSummary : p.summary,
        updatedAt: Date.now()
      };
      saveCareerProfile(merged);
      const rec: UploadedResume = { fileName, text, extractedAt: Date.now(), profile: merged };
      saveUploadedResume(rec);
      setResume(rec);
      setProfile(merged);
      setSkillSuggestions(suggestSkills(p.skills, prevSkills, analyzeResume(text).fieldId));
      setResumePaste("");
      setResumeFormOpen(false);
      toast(`📄 ${fileName} analyzed — ${merged.skills.length} skills extracted · ${merged.years} yrs · “${merged.headline}”`);
    } catch (e) {
      toast("✗ Could not read the resume — try pasting the text");
    }
  };

  const removeResume = () => {
    clearUploadedResume();
    setResume(null);
    setResumePaste("");
    setResumeFormOpen(false);
    toast("🗑 Resume removed — your saved profile stays as-is");
  };

  const handleResumeFile = async (file: File) => {
    setResumeBusy(true);
    try {
      const text = await extractFileText(file);
      if (text.trim().length < 40) { toast("✗ That file looks empty — try a different one or paste the text"); return; }
      applyResume(text, file.name);
    } catch {
      toast("✗ Could not read the file — try pasting the text");
    } finally {
      setResumeBusy(false);
    }
  };

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

  /* --- apply hand-off: open the platform's own page, track locally ----- */
  const applyOnPlatform = (j: JobPosting) => {
    const via = sourceLabel(j.source);
    window.open(j.url || "#", "_blank", "noopener");
    markAppliedVia(j.id, via);
    setTracks(m => ({ ...m, [j.id]: getTrack(j.id)! }));
    if (!applyHintShown) {
      toast(`🔗 Opened ${via} in a new tab — you complete the application there. InterviewIQ never applies for you.`);
      setApplyHintShown(true);
      storageSet(STORAGE_KEYS.externalApplyHint, true);
    } else {
      toast(`🔗 Opened the application on ${via} — marked as applied (follow-up in 2 weeks)`);
    }
  };

  /* distinct feed sources for the filter chips (M5) — region-aware: the
     platforms the user's location favors (Naukri for India, LinkedIn/Indeed
     elsewhere) sort ahead of the raw count order */
  const feedSources = useMemo(() => {
    const pri = sourcePriority(profile?.location ?? "");
    const seen = new Map<string, number>();
    for (const j of jobs) seen.set(j.source, (seen.get(j.source) ?? 0) + 1);
    return [...seen.entries()]
      .sort((a, b) => (pri[a[0]] ?? 99) - (pri[b[0]] ?? 99) || b[1] - a[1])
      .map(([s, n]) => ({ s, n, label: sourceLabel(s) }));
  }, [jobs, profile]);

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
      const cover = existing?.coverLetter ?? buildCoverLetter(profile, job, m, displayCurrency);
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

      <ResumeCard
        profile={profile}
        resume={resume}
        resumeFormOpen={resumeFormOpen}
        resumeShowAll={resumeShowAll}
        resumePaste={resumePaste}
        resumeBusy={resumeBusy}
        showResumeBanner={showResumeBanner}
        setResumeFormOpen={setResumeFormOpen}
        setResumeShowAll={setResumeShowAll}
        setResumePaste={setResumePaste}
        handleResumeFile={handleResumeFile}
        applyResume={applyResume}
        removeResume={removeResume}
        dismissResumeBanner={dismissResumeBanner}
      />

      <CareerProfileCard
        profile={profile}
        skillSuggestions={skillSuggestions}
        saving={saving}
        setProfile={setProfile}
        save={save}
        addSuggestedSkill={addSuggestedSkill}
      />

      <CompanyRankingCard
        profile={profile}
        jobs={jobs}
        filteredRanks={filteredRanks}
        ranks={ranks}
        topPicks={topPicks}
        gapImpact={gapImpact}
        rankFilters={rankFilters}
        rankLimit={rankLimit}
        shortlist={shortlist}
        displayCurrency={displayCurrency}
        proGated={proGated}
        cloud={cloud}
        filterActive={filterActive}
        addSkillToProfile={addSkillToProfile}
        setRankFilters={setRankFilters}
        setRankLimit={setRankLimit}
        setUpgrade={setUpgrade}
        setApplyQueue={setApplyQueue}
        setRecsDigestOpen={setRecsDigestOpen}
        showInFeed={showInFeed}
      />

                  <SalaryBenchmarkCard
        profile={profile}
        jobs={jobs}
        displayCurrency={displayCurrency}
        benchLvl={benchLvl}
        benchCo={benchCo}
        benchOpen={benchOpen}
        market={market}
        expected={expected}
        offerOpen={offerOpen}
        offerBase={offerBase}
        offerEquity={offerEquity}
        setBenchLvl={setBenchLvl}
        setBenchCo={setBenchCo}
        setBenchOpen={setBenchOpen}
        setMarket={setMarket}
        setExpected={setExpected}
        setOfferOpen={setOfferOpen}
        setOfferBase={setOfferBase}
        setOfferEquity={setOfferEquity}
      />

            <ApplyTrackerCard
        proGated={proGated}
        due={due}
        setReportOpen={setReportOpen}
        setUpgrade={setUpgrade}
        batchExport={batchExport}
      />

      {/* feed filters */}
      <FeedFilters
        filters={filters} setFilters={setFilters}
        displayCurrency={displayCurrency} setDisplayCurrency={setDisplayCurrency}
        feedSources={feedSources} jobCount={jobs.length}
      />
      {/* match feed */}
      <div id="match-feed" ref={feedRef} className={`${cardCls} mt-5 scroll-mt-3 overflow-hidden transition-shadow ${feedFlash ? "ring-2 ring-acc1/70" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 p-5">
          <div>
            <h3 className="text-[14.5px] font-extrabold">🎯 Match feed ({visible.length > feedLimit ? `${feedLimit} of ${visible.length}` : visible.length !== jobs.length ? `${visible.length} of ${jobs.length}` : visible.length})</h3>
            <p className="mt-0.5 text-[11.5px] text-fnt">Sorted by match %, best first. Verdicts compare the job's required skills against your profile. {proGated ? "Unlock Pro for the full reasons." : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">
              Show
              <select
                className="inp w-auto cursor-pointer py-1.5 text-[12px]"
                value={feedPageSize === 0 ? "0" : String(feedPageSize)}
                onChange={e => pickPageSize(Number(e.target.value))}
                title="Jobs shown per page — your choice is remembered"
              >
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="0">All</option>
              </select>
            </label>
            <button className={btnGhost + btnSm} onClick={() => setImportOpen(true)} title="Paste a job URL from Naukri, LinkedIn, Indeed or any site — it joins your match feed">
              ➕ Add job from a link
            </button>
            <button className={btnGhost + btnSm} onClick={refresh} disabled={refreshing || !cloud}>
              {refreshing ? "⏳ Refreshing…" : "🔄 Refresh feed"} {!cloud && "(sign in)"}
            </button>
          </div>
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
            {visible.slice(0, feedLimit).map(j => {
              const m = matchOf.get(j.id);
              const locked = proGated;
              return (
                <MatchFeedCard
                  key={j.id}
                  job={j}
                  match={m!}
                  locked={locked}
                  track={tracks[j.id]}
                  displayCurrency={displayCurrency}
                  profile={profile}
                  onAddSkill={addSkillToProfile}
                  onGapPlan={(job, missing) => setGapJob({ job, missing })}
                  onKit={setKitJob}
                  onApply={applyOnPlatform}
                  onStatusChange={(jobId, status) => setJobStatus(jobId, status)}
                  onFollowUpDate={(jobId, date) => setJobFollowUp(jobId, date)}
                  onDraft={setDraftJob}
                  onRound={setRoundJob}
                  onUpgrade={setUpgrade}
                  isDue={dueIds.has(j.id)}
                />
              );
            })}
          </ul>
        )}
        {visible.length > feedLimit && (
          <div className="border-t border-line/10 p-4 text-center">
            <button className={btnGhost + btnSm} onClick={() => setFeedLimit(l => l + feedPageSize)}>
              Show more — {visible.length - feedLimit} more job{visible.length - feedLimit === 1 ? "" : "s"} (sorted by match %)
            </button>
          </div>
        )}
      </div>

      {upgrade && <UpgradeModal onClose={() => setUpgrade(null)} reason={upgrade} />}
      {gapJob && <GapPlanModal job={gapJob.job} missing={gapJob.missing} onClose={() => setGapJob(null)} />}
      {kitJob && profile && <ResumeKitModal job={kitJob} profile={profile} match={matchOf.get(kitJob.id) ?? null} onAddSkill={addSkillToProfile} onClose={() => setKitJob(null)} />}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} />}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={setJobs}
          onApplyQueue={setApplyQueue}
        />
      )}
      {applyQueue && applyQueue.length > 0 && (
        <ApplyQueueModal
          queue={applyQueue}
          tracks={tracks}
          jobs={jobs}
          onApply={applyOnPlatform}
          onKit={setKitJob}
          onClose={() => setApplyQueue(null)}
        />
      )}
      {recsDigestOpen && profile && <RecsDigestModal profile={profile} ranks={ranks} onClose={() => setRecsDigestOpen(false)} />}
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

