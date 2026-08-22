import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerProfile, JobPosting, UploadedResume } from "../types";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import { getSupabaseClient, isCloudConfigured } from "../services/cloud";
import { CONFIG } from "../config";
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
import {importFromUrlWithFallback, sourceLabel, sourcePriority, splitJobUrls} from "../services/importJob";
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
/* real public postings the "✨ Try sample links" button pre-fills — stable
   ATS-board URLs so the flow can be demoed without hunting for a link */
const SAMPLE_IMPORT_URLS = [
  "https://jobs.ashbyhq.com/notion/f1f9e19d-cbf3-49eb-9824-d04adf2e3d75",
  "https://jobs.ashbyhq.com/notion/72532ca0-eb7d-4d9e-b982-50f52614fca9",
  "https://app.careerpuck.com/job-board/lyft/job/8603653002?gh_jid=8603653002"
];

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
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  /* one result row per pasted URL — multiple jobs in a single shot */
  const [importResults, setImportResults] = useState<{ url: string; job: JobPosting | null; error: string | null }[]>([]);
  const [importErr, setImportErr] = useState<string | null>(null);
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

  const refresh = async () => {
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

  /* --- platform import: paste one or more job URLs → preview → add ----- */
  const previewImport = async () => {
    const urls = splitJobUrls(importUrl);
    if (!urls.length) { setImportErr("Paste at least one job link — one per line."); return; }
    setImporting(true);
    setImportErr(null);
    setImportResults([]);
    try {
      const client = await getSupabaseClient();
      const session = await client?.auth.getSession().catch(() => null);
      const token = session?.data?.session?.access_token ?? undefined;
      /* sequential on purpose — polite fetching, rate-limited per host */
      const results: { url: string; job: JobPosting | null; error: string | null }[] = [];
      for (const raw of urls) {
        const out = await importFromUrlWithFallback(raw, { supabaseUrl: CONFIG.supabase.url, token });
        results.push(out.ok ? { url: raw, job: out.job, error: null } : { url: raw, job: null, error: out.message });
      }
      setImportResults(results);
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = () => {
    const jobs = importResults.filter(r => r.job).map(r => r.job!);
    if (!jobs.length) return;
    for (const j of jobs) addImportedJob(j);
    setJobs(listJobs());
    toast(`➕ Imported ${jobs.length} job${jobs.length === 1 ? "" : "s"} — now in your match feed`);
    setImportOpen(false);
    setImportUrl("");
    setImportResults([]);
    setImportErr(null);
    /* hand straight into the batch apply queue so users can work through
       the apply hand-offs instead of hunting cards one at a time */
    if (jobs.length) setApplyQueue(jobs);
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
        <Modal
          onClose={() => { setImportOpen(false); setImportUrl(""); setImportResults([]); setImportErr(null); }}
          title="➕ Add jobs from platforms"
          desc="Paste one or more job links (one per line) from Naukri, LinkedIn, Indeed — or any company page. We read the public postings and score them like any feed job. Applying always happens on the platform's own page; InterviewIQ never applies for you."
        >
          <div className="flex items-start gap-2">
            <textarea
              className="inp h-24 w-full flex-1"
              placeholder={"https://www.naukri.com/job/…\nhttps://www.linkedin.com/jobs/view/…\nhttps://in.indeed.com/viewjob?jk=…"}
              value={importUrl}
              onChange={e => { setImportUrl(e.target.value); setImportErr(null); setImportResults([]); }}
              spellCheck={false}
            />
            <button className={btnPrimary + btnSm} onClick={() => void previewImport()} disabled={importing || !importUrl.trim()}>
              {importing ? "⏳ Reading…" : "🔎 Preview"}
            </button>
          </div>
          <button
            className="mt-2 text-[11.5px] font-bold text-acctxt underline-offset-2 hover:underline"
            onClick={() => setImportUrl(SAMPLE_IMPORT_URLS.join("\n"))}
            title="Fill the box with a few real public postings to try the flow"
          >
            ✨ Try sample links
          </button>

          {importing && <p className="mt-3 text-[12px] text-mut">⏳ Reading postings… (public fetch, rate-limited per site)</p>}

          {importErr && !importing && (
            <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 p-3.5">
              <p className="text-[12.5px] text-fnt">✗ {importErr}</p>
            </div>
          )}

          {importResults.length > 0 && !importing && (
            <div className="mt-3 space-y-2">
              {importResults.map((r, i) => (
                <div key={i} className={`rounded-xl border p-3.5 ${r.job ? "border-line/15 bg-deep/30" : "border-warn/30 bg-warn/10"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {r.job ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <Chip tone="co">{sourceLabel(r.job.source)}</Chip>
                            {r.job.remote && <Chip tone="ok">REMOTE</Chip>}
                            {r.job.level && <span className="text-[11px] font-bold uppercase tracking-wider text-mut">· {r.job.level}</span>}
                          </div>
                          <div className="mt-1.5 text-[13.5px] font-extrabold text-ink">{r.job.title}</div>
                          {r.job.company && <div className="text-[12px] font-bold text-fnt">{r.job.company}</div>}
                          {r.job.location && <div className="text-[11.5px] text-mut">📍 {r.job.location}</div>}
                          {r.job.skills.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {r.job.skills.slice(0, 6).map(s => <Chip key={s} tone="default">{s}</Chip>)}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-[12.5px] font-bold text-warn">✗ Couldn't read this link</p>
                          <p className="mt-0.5 break-all text-[11.5px] text-fnt">{r.error}</p>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] font-bold text-acctxt underline">
                            Open the job page manually ↗
                          </a>
                        </>
                      )}
                    </div>
                    {r.job && (
                      <button
                        className="shrink-0 text-[12px] font-bold text-mut hover:text-ink"
                        onClick={() => setImportResults(list => list.filter((_, x) => x !== i))}
                        title="Remove from this import"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  className={btnPrimary + btnSm}
                  onClick={confirmImport}
                  disabled={!importResults.some(r => r.job)}
                >
                  ➕ Add {importResults.filter(r => r.job).length} to feed
                </button>
                <button className={btnGhost + btnSm} onClick={() => { setImportResults([]); setImportUrl(""); setImportErr(null); }}>
                  ↺ Start over
                </button>
              </div>
              <p className="mt-1 text-[11px] text-mut">The apply button on each job opens its page on the platform — you complete it there.</p>
            </div>
          )}
        </Modal>
      )}
      {applyQueue && applyQueue.length > 0 && (
        <Modal
          onClose={() => setApplyQueue(null)}
          title="📋 Apply queue"
          desc="Work through the batch one at a time — each Apply opens the platform's own page in a new tab, where you complete the submission. InterviewIQ never applies for you; it just tracks progress. Use 📄 Kit to review the tailored resume & cover letter first."
        >
          <div className="space-y-2">
            {applyQueue.map((j, i) => {
              const tr = tracks[j.id];
              const done = tr && (tr.status === "applied" || tr.status === "interview" || tr.status === "offer" || tr.status === "rejected");
              return (
                <div key={j.id} className="flex items-start justify-between gap-3 rounded-xl border border-line/15 bg-deep/30 p-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip tone="co">{sourceLabel(j.source)}</Chip>
                      <span className="text-[11px] font-bold text-mut">{i + 1}/{applyQueue.length}</span>
                    </div>
                    <div className="mt-1 truncate text-[13px] font-extrabold text-ink">{j.title}</div>
                    {j.company && <div className="text-[11.5px] font-bold text-fnt">{j.company}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button
                      className="rounded-full border border-line/20 bg-deep/40 px-2.5 py-1 text-[11.5px] font-bold text-mut transition-all hover:text-ink"
                      onClick={() => setKitJob(j)}
                      title="Open the tailored resume & cover letter for this role"
                    >
                      📄 Kit
                    </button>
                    {done ? (
                      <Chip tone="ok" title={tr.via ? `Applied via ${tr.via}` : "Marked applied"}>
                        ✓ {tr.via ? `Applied via ${tr.via}` : "Applied"}
                      </Chip>
                    ) : (
                      <button
                        className="rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-[11.5px] font-bold text-ok transition-all hover:bg-ok/20"
                        onClick={() => applyOnPlatform(j)}
                      >
                        🔗 Apply on {sourceLabel(j.source)} ↗
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-mut">Each apply is also tracked on its feed card — follow-ups land in the apply tracker.</p>
          <button className="mt-3 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={() => setApplyQueue(null)}>
            Done — close
          </button>
        </Modal>
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

