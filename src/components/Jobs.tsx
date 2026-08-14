import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerProfile, JobPosting, UploadedResume } from "../types";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import { getCloudState, getSupabaseClient, isCloudConfigured } from "../services/cloud";
import { CONFIG } from "../config";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from "./ui";
import { UpgradeModal } from "./Upgrade";
import { GapPlanModal } from "./GapPlanModal";
import { ResumeKitModal } from "./ResumeKitModal";
import {
  addImportedJob, defaultCareerProfile, EMPTY_FILTERS, EMPTY_RANK_FILTERS, filterJobs, filterRanks, getCareerProfile,
  lastJobsRefresh, listJobs, listShortlist, loadJobsFromCloud, matchJob, rankCompanies, refreshJobs,
  recommendationsDigest, salaryLabel, saveCareerProfile, skillImpact, sortJobsByMatch, toggleShortlist, VERDICT_META, type CompanyRank, type JobFilters, type RankFilters
} from "../services/jobs";
import { analyzeResume, clearUploadedResume, getUploadedResume, profileHasStaleSkills, resumeToProfile, saveUploadedResume, suggestSkills } from "../services/resume";
import { importFromUrlWithFallback, sourceLabel, splitJobUrls } from "../services/importJob";
import { extractFileText } from "../services/pdf";
import { getRemoteConfig } from "../services/remoteConfig";
import { buildCoverLetter, buildResume, getApplyKit, jdKeywords, saveApplyKit } from "../services/applyKit";
import { applyDigest, dueFollowUps, followUpDraft, getTrack, listTracks, markAppliedVia, markFollowUpNotified, removeRound, saveRound, setFollowUp, setStatus, STATUS_META, STATUS_ORDER, trackSummary, weeklyReport, type ApplyStatus, type ApplyTrack, type InterviewRound } from "../services/applyTrack";
import { BENCHMARK, BENCH_LEVELS, benchLevelForYears, companyBands, detectMarket, fmtAmount, fmtBand, marketBand, MARKETS, negotiationPoints, offerVerdict, ordinal, positionInBand, positionRead, type BenchLevel, type Market } from "../services/salaryBench";
import { fire } from "../services/notifications";
import { downloadZip } from "../services/zip";
import { practiceForRound, type DrillCard } from "../services/drill";
import { getGoal } from "../services/goal";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import { bankFromRound, listBank, removeFromBank, type BankEntry } from "../services/questionBank";

/* verdict tone → text color (matches VERDICT_META tones) */
const verdictToneCls = (tone: string) =>
  tone === "ok" ? "text-ok" : tone === "co" ? "text-acctxt" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-mut";

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

/* real public postings the "✨ Try sample links" button pre-fills — stable
   ATS-board URLs so the flow can be demoed without hunting for a link */
const SAMPLE_IMPORT_URLS = [
  "https://jobs.ashbyhq.com/notion/f1f9e19d-cbf3-49eb-9824-d04adf2e3d75",
  "https://jobs.ashbyhq.com/notion/72532ca0-eb7d-4d9e-b982-50f52614fca9",
  "https://app.careerpuck.com/job-board/lyft/job/8603653002?gh_jid=8603653002"
];

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

  /* match feed — filtered, then sorted by match % descending (best first) */
  const visible = useMemo(
    () => sortJobsByMatch(filterJobs(jobs, filters), id => matchOf.get(id)?.score ?? 0),
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

  /* company leaderboard — best match % per company, descending */
  const ranks = useMemo(() => rankCompanies(profile, jobs), [profile, jobs]);
  const filteredRanks = useMemo(() => filterRanks(ranks, rankFilters, shortlist), [ranks, rankFilters, shortlist]);
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

  /* distinct feed sources for the filter chips (M5) */
  const feedSources = useMemo(() => {
    const seen = new Map<string, number>();
    for (const j of jobs) seen.set(j.source, (seen.get(j.source) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => ({ s, n, label: sourceLabel(s) }));
  }, [jobs]);

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

      {showResumeBanner && (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-acc1/30 bg-acc1/10 px-4 py-3 transition-all"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void handleResumeFile(file);
          }}
        >
          <span className="text-[12.5px] text-fnt">
            📎 Your profile has <b>{(() => { const n = (profile?.skills.length ?? 0) - resumeToProfile(resume!.text).skills.length; return `${n} skill${n === 1 ? "" : "s"}`; })()}</b> beyond what this resume mentions.
            Re-upload it to keep skill chips strictly from the resume — anything you still want can be re-added from 💡 Suggestions.
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <label className={`${btnPrimary} ${btnSm} cursor-pointer`} title="Pick your resume file">
              ↺ Re-upload resume
              <input type="file" accept=".pdf,.txt,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleResumeFile(f); e.target.value = ""; }} />
            </label>
            <button className={btnGhost + btnSm} onClick={dismissResumeBanner}>✕ Not now</button>
          </span>
          <span className="w-full text-[10.5px] text-mut">💾 Or drop your .pdf / .txt / .docx anywhere on this banner.</span>
        </div>
      )}

      {/* resume upload — the fastest way to a match profile */}
      <div className={`${cardCls} mt-5 overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">📄 Your resume</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Upload a .pdf / .txt or paste the text — we extract your skills, title and experience, then match you against every company below. Everything stays on your device.</p>
        </div>
        <div className="p-5">
          {resume && !resumeFormOpen ? (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-extrabold">✅ {resume.fileName}</span>
                <Chip tone="ok">{resume.profile.skills.length} skills</Chip>
                <Chip>{resume.profile.years} yrs</Chip>
                <span className="text-[12.5px] font-semibold text-ink">{resume.profile.headline}</span>
              </div>
              {resume.profile.skills.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {resume.profile.skills.slice(0, resumeShowAll ? undefined : 14).map(s => (
                    <span key={s} className="rounded-full border border-acc1/35 bg-acc1/10 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt">{s}</span>
                  ))}
                  {resume.profile.skills.length > 14 && (
                    <button
                      className="cursor-pointer rounded-full border border-acc1/35 bg-acc1/10 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/20"
                      onClick={() => setResumeShowAll(s => !s)}
                      title={resumeShowAll ? "Show fewer skills" : `Show all ${resume.profile.skills.length} extracted skills`}
                    >
                      {resumeShowAll ? "− show less" : `+${resume.profile.skills.length - 14} more`}
                    </button>
                  )}
                </div>
              )}
              <p className="mt-2 text-[11px] text-mut">
                📄 {resume.profile.skills.length} skills extracted from this resume
                {(profile?.skills.length ?? 0) > resume.profile.skills.length
                  ? ` · +${(profile?.skills.length ?? 0) - resume.profile.skills.length} added in your profile`
                  : ""} — the match feed and company ranking below are scored from these. You can still edit the profile card above.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={btnGhost + btnSm} onClick={() => setResumeFormOpen(true)}>↺ Replace resume</button>
                <button className={btnDanger + btnSm} onClick={removeResume}>🗑 Remove</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`${btnOk} ${btnSm} cursor-pointer`}>
                  {resumeBusy ? <><span className="spinner" />Reading…</> : "📎 Upload .pdf / .txt / .docx"}
                  <input
                    type="file" accept=".pdf,.txt,.docx" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) void handleResumeFile(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {resume && <button className={btnGhost + btnSm} onClick={() => { setResumeFormOpen(false); setResumePaste(""); }}>Cancel</button>}
              </div>
              <textarea
                rows={3}
                value={resumePaste}
                onChange={e => setResumePaste(e.target.value)}
                placeholder="…or paste your resume text here (or drop a .pdf / .txt)"
                className="inp mt-3 h-auto w-full resize-y text-[13px]"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-mut">Tip: PDFs with selectable text work best — scanned pages fall back to OCR (needs a connection).</span>
                <button className={btnPrimary + btnSm} disabled={resumeBusy || resumePaste.trim().length < 40} onClick={() => applyResume(resumePaste, "pasted-resume.txt")}>
                  🔍 Analyze &amp; match
                </button>
              </div>
            </div>
          )}
        </div>
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
            {skillSuggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-mut">💡 Suggestions</span>
                {skillSuggestions.slice(0, 8).map(s => (
                  <span key={s} className="inline-flex items-center gap-0.5">
                    <Chip tone="co" title={`“${s}” isn't in your resume — add it if you have this skill`}>{s}</Chip>
                    <button
                      className="grid h-[18px] w-[18px] place-items-center rounded-full border border-acc1/40 bg-acc1/10 text-[12px] font-bold leading-none text-acctxt transition-all hover:bg-acc1/25"
                      onClick={() => addSuggestedSkill(s)}
                      title={`Add “${s}” to my skills — it will appear in generated resumes`}
                    >
                      ＋
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Summary (optional)</span>
            <textarea className="inp h-36 min-h-[120px] resize-y" placeholder="A few lines about you — used for tailored resumes later." value={profile?.summary ?? ""}
              onChange={e => setProfile(p => p ? { ...p, summary: e.target.value } : p)} />
            <span className="mt-1 block text-[10.5px] text-mut">✏️ Extracted from your resume — edit freely; your edits survive re-uploads.</span>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
          <span className="text-[11.5px] text-fnt">{profile ? `${profile.skills.length} skills · ${profile.targetTitles.length} target titles` : "No profile yet — prefill from your diagnostic or fill it in."}</span>
          <button className={btnPrimary + btnSm} onClick={save} disabled={saving || !profile}>💾 Save profile</button>
        </div>
      </div>

      {/* company ranking — best match % per company, descending */}
      <div className={`${cardCls} mt-5 overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">🏆 Best-fit companies ({filteredRanks.length}{filterActive && filteredRanks.length !== ranks.length ? ` of ${ranks.length}` : ""})</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Every company in the feed, ranked by match % — a company's best open role wins. {resume ? "Scored from your uploaded resume." : "Upload your resume above (or save the profile) to score the list."}</p>
        </div>

        {/* ranking filters — narrow the leaderboard without touching the feed */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line/10 bg-wht/[.03] px-5 py-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line/15 bg-deep/40 px-3 py-1.5 text-[12px] font-bold">
            <input type="checkbox" className="h-3.5 w-3.5 accent-[#6366f1]" checked={rankFilters.remoteOnly}
              onChange={e => setRankFilters(f => ({ ...f, remoteOnly: e.target.checked }))} />
            🏠 Remote only
          </label>
          <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-mut">
            Match
            <select
              className="cursor-pointer rounded-full border border-line/20 bg-deep/40 px-2.5 py-1.5 text-[12px] font-bold text-fnt outline-none"
              value={rankFilters.minScore}
              onChange={e => setRankFilters(f => ({ ...f, minScore: Number(e.target.value) }))}
            >
              <option value={0}>any %</option>
              <option value={40}>40%+</option>
              <option value={60}>60%+</option>
              <option value={80}>80%+</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-mut">
            Min salary
            <input
              type="number" min={0} step={5000} className="w-[92px] rounded-full border border-line/20 bg-deep/40 px-2.5 py-1.5 text-[12px] font-bold text-fnt outline-none"
              placeholder="$0"
              value={rankFilters.minSalary || ""}
              onChange={e => setRankFilters(f => ({ ...f, minSalary: e.target.value ? Number(e.target.value) : 0 }))}
              title="Minimum annual salary of the best role (in its own currency)"
            />
          </label>
          <button
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${rankFilters.shortlistOnly ? "grad-bg text-white" : "border border-line/15 bg-deep/40 text-mut hover:text-ink"}`}
            onClick={() => setRankFilters(f => ({ ...f, shortlistOnly: !f.shortlistOnly }))}
            disabled={shortlist.size === 0}
            title="Only companies you've starred"
          >
            ⭐ Shortlist ({shortlist.size})
          </button>
          {filterActive && (
            <button className="rounded-full border border-line/15 px-2.5 py-1.5 text-[11.5px] font-bold text-mut hover:text-ink" onClick={() => setRankFilters(EMPTY_RANK_FILTERS)}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* recommendations — top picks with a concrete next step */}
        {profile && jobs.length > 0 && topPicks.length > 0 && topPicks[0].score > 0 && (
          <div className="border-b border-ok/20 bg-ok/[.07] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] font-extrabold text-ok">🏆 Recommendations — your top {topPicks.length} pick{topPicks.length === 1 ? "" : "s"}</p>
              <div className="flex items-center gap-2">
                {filterActive && (
                  <button className="text-[11px] font-bold text-mut underline-offset-2 hover:text-ink hover:underline" onClick={() => setRankFilters(EMPTY_RANK_FILTERS)}>
                    ✕ show all companies
                  </button>
                )}
                <button
                  className="rounded-full border border-ok/25 bg-ok/10 px-2.5 py-0.5 text-[11.5px] font-bold text-ok transition-all hover:bg-ok/20"
                  onClick={() => setRecsDigestOpen(true)}
                  title="Preview or email this week's top picks"
                >
                  📧 Email digest
                </button>
              </div>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">
              Start with <span className="font-extrabold text-ok">{topPicks[0].company}</span> — {proGated ? "your match % is locked" : `${topPicks[0].score}% match (${VERDICT_META[topPicks[0].verdict].label.toLowerCase()})`} across {topPicks[0].openings} open role{topPicks[0].openings === 1 ? "" : "s"}, best fit: <span className="font-semibold">{topPicks[0].best.title}</span>.{" "}
              {!proGated && topPicks[0].matched.length > 0 && <>You already cover <span className="font-semibold">{topPicks[0].matched.slice(0, 4).join(", ")}</span>.</>}{" "}
              {!proGated && gapImpact && (
                <>Learn <span className="font-bold text-bad">{gapImpact.skill}</span> and {topPicks[0].company} jumps from {gapImpact.from}% → <span className="font-extrabold text-ok">{gapImpact.to}%</span>.</>
              )}
              {proGated && <button className="font-bold text-acc3 underline" onClick={() => setUpgrade("Match verdicts and the company ranking are Pro features.")}>Unlock Pro</button>}
            </p>
            <ul className="mt-3 space-y-1.5">
              {topPicks.map((r, i) => (
                <li key={r.company} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-ok/15 bg-deep/30 px-3 py-2">
                  <span className="w-5 flex-none text-center text-[12px] font-extrabold text-ok">{i + 1}</span>
                  <span className="text-[13px] font-extrabold">{r.company}</span>
                  {proGated ? (
                    <span className="text-[12px] font-bold text-mut">🔒 {r.openings} open role{r.openings === 1 ? "" : "s"}</span>
                  ) : (
                    <>
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${verdictToneCls(r.verdict)}`}>{r.score}% · {VERDICT_META[r.verdict].label}</span>
                      <span className="text-[12px] text-mut">{r.openings} role{r.openings === 1 ? "" : "s"} · {r.best.title}</span>
                    </>
                  )}
                  {(() => { const s = salaryLabel(r.best); return s ? <span className="text-[11.5px] font-bold text-ok">💰 {s}</span> : null; })()}
                  {!proGated && r.missing.length > 0 && (
                    <span className="text-[11.5px] text-mut">gap: <span className="font-bold text-bad">{r.missing.slice(0, 2).join(", ")}</span></span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    <button
                      className="rounded-full border border-ok/30 bg-ok/5 px-2.5 py-0.5 text-[11.5px] font-bold text-ok transition-all hover:bg-ok/15"
                      onClick={() => setKitJob(r.best)}
                      title="Open the resume & cover letter for the best-fit role"
                    >
                      📮 Apply next
                    </button>
                    <button
                      className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
                      onClick={() => showInFeed(r.company)}
                      title="Filter the match feed to this company and jump to it"
                    >
                      🔎 Show in feed
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* nothing clears the bar yet — point at the closest gap */}
        {profile && jobs.length > 0 && topPicks.length > 0 && topPicks[0].score === 0 && (
          <div className="border-b border-warn/20 bg-warn/[.07] px-5 py-4">
            <p className="text-[12.5px] font-extrabold text-warn">🏆 Recommendation</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">
              Nothing in the feed clears a match yet — the closest gap is <span className="font-bold text-bad">{topPicks[0].missing.slice(0, 3).join(", ") || "a skills mismatch"}</span>. Add those skills to your profile and re-rank, or upload a fuller resume.
            </p>
          </div>
        )}

        {!profile ? (
          <div className="p-10 text-center">
            <div className="text-[26px]">📄</div>
            <p className="mt-2 text-[13.5px] font-bold">Upload your resume to rank companies</p>
            <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-mut">Your skills drive the match — drop a .pdf / .txt above and every company in the feed gets a match %, sorted best first.</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-[26px]">🕳️</div>
            <p className="mt-2 text-[13.5px] font-bold">No companies to rank yet</p>
            <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-mut">{cloud ? "Tap “Refresh feed” to pull live jobs and rank them." : "Sign in to fetch the live feed, then come back here."}</p>
          </div>
        ) : filteredRanks.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-[26px]">🔍</div>
            <p className="mt-2 text-[13.5px] font-bold">No companies match these filters</p>
            <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-mut">{rankFilters.shortlistOnly ? "Star some companies with ☆ to build a shortlist, or " : ""}clear the filters to see the full ranking.</p>
            <button className={btnGhost + btnSm + " mt-3"} onClick={() => setRankFilters(EMPTY_RANK_FILTERS)}>✕ Clear filters</button>
          </div>
        ) : (
          <ul className="divide-y divide-line/10">
            {filteredRanks.slice(0, rankLimit).map((r, i) => (
              <li key={r.company} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-6 flex-none text-center text-[13px] font-extrabold text-mut">{i + 1}</span>
                  <div className="min-w-[190px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className={`text-[15px] leading-none transition-all ${isStarred(r.company) ? "text-amber-300" : "text-mut opacity-50 hover:opacity-100"}`}
                        onClick={() => star(r.company)}
                        title={isStarred(r.company) ? "Remove from shortlist" : "Add to shortlist"}
                      >
                        {isStarred(r.company) ? "★" : "☆"}
                      </button>
                      <span className="text-[14px] font-extrabold">{r.company}</span>
                      {i === 0 && <Chip tone="ok">🏆 Best fit</Chip>}
                    </div>
                    <div className="mt-0.5 text-[12px] text-mut">{r.openings} open role{r.openings === 1 ? "" : "s"} · best fit: {r.best.title}</div>
                  </div>
                  <div className="w-[132px] flex-none">
                    {proGated ? (
                      <button
                        className="rounded-full border border-line/15 bg-wht/10 px-3 py-1 text-[12px] font-extrabold text-mut transition-all hover:text-ink"
                        onClick={() => setUpgrade("Match verdicts and the company ranking are Pro features.")}
                        title="Pro feature"
                      >
                        🔒 Match %
                      </button>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-extrabold text-acctxt">{r.score}%</span>
                          <span className={`text-[10px] font-extrabold uppercase tracking-wide ${VERDICT_META[r.verdict].tone === "ok" ? "text-ok" : VERDICT_META[r.verdict].tone === "co" ? "text-acctxt" : VERDICT_META[r.verdict].tone === "warn" ? "text-warn" : VERDICT_META[r.verdict].tone === "bad" ? "text-bad" : "text-mut"}`}>{VERDICT_META[r.verdict].label}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-deep/60">
                          <div className="h-full rounded-full grad-bg" style={{ width: `${Math.max(4, r.score)}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {!proGated && (r.matched.length > 0 || r.missing.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-9 text-[12px]">
                    {r.matched.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-mut">You have:</span>
                        {r.matched.slice(0, 5).map(s => (
                          <Chip key={s} tone="ok" title="Appears in your resume">✓ {s}</Chip>
                        ))}
                        {r.matched.length > 5 && <span className="text-[11.5px] text-mut">+{r.matched.length - 5} more</span>}
                      </span>
                    )}
                    {r.missing.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Gap:</span>
                        {r.missing.slice(0, 4).map(s => (
                          <span key={s} className="inline-flex items-center gap-0.5">
                            <Chip tone="bad" title="In the posting but not in your profile — click ＋ to add it">✗ {s}</Chip>
                            <button
                              className="grid h-[18px] w-[18px] place-items-center rounded-full border border-acc1/40 bg-acc1/10 text-[12px] font-bold leading-none text-acctxt transition-all hover:bg-acc1/25"
                              onClick={() => addSkillToProfile(s)}
                              title={`Add “${s}” to my profile skills`}
                            >
                              ＋
                            </button>
                          </span>
                        ))}
                        {r.missing.length > 4 && <span className="text-[11.5px] text-mut">+{r.missing.length - 4} more</span>}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-2 pl-9">
                  <button
                    className="rounded-full border border-acc1/30 bg-acc1/5 px-2.5 py-0.5 text-[11.5px] font-bold text-acctxt transition-all hover:bg-acc1/15"
                    onClick={() => showInFeed(r.company)}
                    title="Filter the match feed to this company and jump to it"
                  >
                    🔎 Show in feed
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {profile && jobs.length > 0 && filteredRanks.length > rankLimit && (
          <div className="border-t border-line/10 p-4 text-center">
            <button className={btnGhost + btnSm} onClick={() => setRankLimit(l => l + 10)}>
              Show more — {filteredRanks.length - rankLimit} more company{filteredRanks.length - rankLimit === 1 ? "" : "ies"}
            </button>
          </div>
        )}
      </div>

      {/* salary benchmark — market ranges by level + live feed bands */}
      <div className={`${cardCls} mt-5 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 p-5">
          <div>
            <h3 className="text-[14.5px] font-extrabold">📊 Salary benchmark</h3>
            <p className="mt-0.5 text-[11.5px] text-fnt">Indicative annual ranges for your seniority, plus real bands from the live feed.</p>
          </div>
          <button className={btnGhost + btnSm} onClick={() => setBenchOpen(o => !o)}>
            {benchOpen ? "Hide" : "Show"}
          </button>
        </div>
        {benchOpen && (
          <div className="p-5">
            {/* level chips + per-company filter */}
            <div className="flex flex-wrap items-center gap-2">
              {BENCH_LEVELS.map(l => (
                <button
                  key={l}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-all ${benchLvl === l ? "bg-acc1/25 text-acctxt" : "bg-deep/40 text-mut hover:text-ink"}`}
                  onClick={() => setBenchLvl(l)}
                >
                  {BENCHMARK[l].label}
                </button>
              ))}
              <input
                className="inp ml-auto w-[150px] py-1.5 text-[12px]"
                placeholder="Filter by company…"
                value={benchCo}
                onChange={e => setBenchCo(e.target.value)}
              />
            </div>

            {/* market — auto-detected from the profile location, overridable */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Market</span>
              <select
                className="inp w-auto cursor-pointer py-1.5 text-[12px]"
                value={market.id}
                onChange={e => setMarket(MARKETS.find(m => m.id === e.target.value) ?? MARKETS[0])}
                title="Cost-of-living adjustment applied to the indicative ranges"
              >
                {MARKETS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              {market.id !== detectMarket(profile?.location).id && (
                <button
                  className="text-[11px] font-bold text-acctxt hover:underline"
                  onClick={() => setMarket(detectMarket(profile?.location))}
                  title="Reset to the market auto-detected from your profile location"
                >
                  ↺ use my location
                </button>
              )}
              <span className="text-[10.5px] text-mut">{market.note}</span>
            </div>

            {/* expected comp — percentile position within the level band */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Your expected comp</span>
              <input
                className="inp w-[150px] py-1.5 text-[12px]"
                type="number" min={0}
                placeholder={`annual, ${market.currency}`}
                value={expected}
                onChange={e => setExpected(e.target.value)}
                title={`Annual expected compensation in ${market.currency}`}
              />
              {expected && (() => {
                const mb = marketBand(BENCHMARK[benchLvl], market);
                const pct = positionInBand(Number(expected) || 0, mb.min, mb.max);
                const read = positionRead(pct);
                return (
                  <Chip tone={read.tone === "high" ? "ok" : read.tone === "low" ? "bad" : "co"}>
                    {ordinal(pct)} percentile — {read.label}
                  </Chip>
                );
              })()}
            </div>

            {/* the user's level band + all levels for context, adjusted to the market */}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BENCH_LEVELS.map(l => {
                const active = l === benchLvl;
                const band = BENCHMARK[l];
                const mb = marketBand(band, market);
                return (
                  <div key={l} className={`rounded-xl border p-3.5 ${active ? "border-acc1/40 bg-acc1/10" : "border-line/15 bg-deep/30"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-extrabold">{band.label}</span>
                      {active && <Chip tone="co">your level</Chip>}
                    </div>
                    <div className="mt-1 text-[15px] font-extrabold text-acc1">{fmtBand(mb.min, mb.max, mb.currency)}</div>
                    <div className="text-[10.5px] text-mut">{mb.currency} · {market.label} · indicative market range</div>
                  </div>
                );
              })}
            </div>

            {/* offer comparison — verdict + negotiation talking points */}
            <div className="mt-4 rounded-xl border border-line/15 bg-deep/30 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12.5px] font-extrabold">🤝 Compare an offer</p>
                <button className="text-[11px] font-bold text-acctxt hover:underline" onClick={() => setOfferOpen(o => !o)}>
                  {offerOpen ? "Hide" : "Show"}
                </button>
              </div>
              {offerOpen && (
                <div className="mt-3 space-y-2.5">
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="inp w-[170px] py-1.5 text-[12px]"
                      type="number" min={0}
                      placeholder={`Base / yr (${market.currency})`}
                      value={offerBase}
                      onChange={e => setOfferBase(e.target.value)}
                    />
                    <input
                      className="inp w-[170px] py-1.5 text-[12px]"
                      type="number" min={0}
                      placeholder={`Equity / yr (${market.currency})`}
                      value={offerEquity}
                      onChange={e => setOfferEquity(e.target.value)}
                    />
                  </div>
                  {(() => {
                    if (!offerBase) return <p className="text-[11.5px] text-mut">Enter at least a base to compare it against the {BENCHMARK[benchLvl].label} band for {market.label}.</p>;
                    const mb = marketBand(BENCHMARK[benchLvl], market);
                    const offer = { base: Number(offerBase) || 0, equity: Number(offerEquity) || 0, currency: market.currency };
                    const v = offerVerdict(offer, mb);
                    return (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={v.kind === "below" ? "bad" : v.kind === "above" ? "ok" : "co"}>{v.label}</Chip>
                          <span className="text-[12px] text-fnt">Total {fmtAmount(v.total, market.currency)} · {ordinal(v.pct)} percentile of the band</span>
                        </div>
                        {v.kind === "below" && (
                          <p className="text-[11.5px] text-warn">Gap to the low end: {fmtAmount(v.gapToMin, market.currency)}</p>
                        )}
                        <ul className="space-y-1.5">
                          {negotiationPoints(offer, mb, market).map((p, i) => (
                            <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-fnt">
                              <span className="font-extrabold text-acc1">•</span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* live bands from the feed — real data, never invented */}
            {(() => {
              const live = companyBands(jobs).filter(c => !benchCo || c.company.toLowerCase().includes(benchCo.toLowerCase()));
              const postingCount = live.reduce((n, c) => n + c.bands.filter(b => b.source === "posting").length, 0);
              const estCount = live.reduce((n, c) => n + c.bands.filter(b => b.source === "estimate").length, 0);
              if (!live.length) {
                return (
                  <div className="mt-3 rounded-xl border border-dashed border-line/20 p-4 text-center">
                    <p className="text-[12px] font-bold">No live salary data{benchCo ? ` for “${benchCo}”` : " in the feed"} yet</p>
                    <p className="mt-0.5 text-[11px] text-mut">Postings rarely list bands. Add the Adzuna keys in Admin → Salary enrichment and re-ingest to fill estimates (labelled “est.”).</p>
                  </div>
                );
              }
              return (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Live feed bands</span>
                    <Chip tone="lvl">{postingCount} posting{postingCount === 1 ? "" : "s"} · {estCount} est.</Chip>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {live.map(c => (
                      <div key={c.company} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/30 px-3 py-2 text-[12px]">
                        <span className="min-w-[120px] font-extrabold">{c.company}</span>
                        {c.median && <span className="font-bold text-acc1">{fmtBand(c.median.min, c.median.max, c.median.currency)}</span>}
                        <span className="text-[10.5px] text-mut">median of {c.bands.length} band{c.bands.length === 1 ? "" : "s"} {c.bands.some(b => b.source === "estimate") ? "(incl. est.)" : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            <p className="mt-3 text-[10.5px] text-mut">Static ranges are indicative US-market baselines from public salary research, adjusted per market by cost-of-living multipliers and approximate FX — your real offer depends on company, equity and negotiation. Live bands come straight from the feed and are never adjusted.</p>
          </div>
        )}
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

      {/* feed filters */}
      <div className={`${cardCls} mt-5`}>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <input
            className="inp min-w-[160px] flex-1"
            placeholder="🔍 Search title, company, skill…"
            value={filters.query}
            onChange={e => setFilters(f => ({ ...f, query: e.target.value }))}
          />
          <select className="inp w-auto cursor-pointer" value={filters.remote === null ? "" : String(filters.remote)}
            onChange={e => setFilters(f => ({ ...f, remote: e.target.value === "" ? null : e.target.value === "true" }))}>
            <option value="">📍 Any location</option>
            <option value="true">🏠 Remote only</option>
            <option value="false">🏢 On-site only</option>
          </select>
          <select className="inp w-auto cursor-pointer" value={filters.companySize ?? ""}
            onChange={e => setFilters(f => ({ ...f, companySize: e.target.value || null }))}>
            <option value="">🏢 Any size</option>
            <option value="large">Large (1,000+ employees)</option>
            <option value="mid">Mid (50–999)</option>
            <option value="small">Small (&lt;50)</option>
          </select>
          <select className="inp w-auto cursor-pointer" value={filters.currency ?? ""}
            onChange={e => setFilters(f => ({ ...f, currency: e.target.value || null }))}>
            <option value="">💱 Any currency</option>
            <option value="USD">$ USD</option>
            <option value="INR">₹ INR</option>
            <option value="EUR">€ EUR</option>
            <option value="GBP">£ GBP</option>
          </select>
          <input
            type="number" min={0} step={5000}
            className="inp w-[110px]"
            placeholder="Min salary"
            value={filters.salaryMin ?? ""}
            onChange={e => setFilters(f => ({ ...f, salaryMin: e.target.value ? Number(e.target.value) : null }))}
            title="Minimum annual salary (in the chosen currency)"
          />
          {(filters.query || filters.remote !== null || filters.companySize || filters.currency || filters.salaryMin !== null || filters.salaryMax !== null || filters.source) && (
            <button className={btnGhost + btnSm} onClick={() => setFilters(EMPTY_FILTERS)}>✕ Clear</button>
          )}
        </div>
        {/* source chips — every platform with live postings in the feed */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line/10 px-4 py-2.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-mut">Source:</span>
          <button
            className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold transition-all ${!filters.source ? "border-acc1/40 bg-acc1/15 text-acctxt" : "border-line/15 bg-deep/40 text-mut hover:text-ink"}`}
            onClick={() => setFilters(f => ({ ...f, source: null }))}
          >
            📦 All ({jobs.length})
          </button>
          {feedSources.map(({ s, n, label }) => (
            <button
              key={s}
              className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold transition-all ${filters.source === s ? "border-acc1/40 bg-acc1/15 text-acctxt" : "border-line/15 bg-deep/40 text-mut hover:text-ink"}`}
              onClick={() => setFilters(f => ({ ...f, source: f.source === s ? null : s }))}
              title={`Only ${label} postings`}
            >
              {label} ({n})
            </button>
          ))}
        </div>
      </div>

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
                    {(() => { const s = salaryLabel(j); return s ? <span className="font-bold text-ok">💰 {s}</span> : null; })()}
                    <span className="text-[11px]">{j.source}</span>
                    {j.url && <a href={j.url} target="_blank" rel="noreferrer" className="font-bold text-acctxt hover:underline">View →</a>}
                  </div>
                  {!locked && m && (m.matched.length || m.missing.length || m.blockers.length) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
                      {m.matched.length > 0 && (
                        <span className="flex flex-wrap items-center gap-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Matched:</span>
                          {m.matched.map(s => (
                            <Chip key={s} tone="ok" title="Appears in your resume">✓ {s}</Chip>
                          ))}
                        </span>
                      )}
                      {m.missing.length > 0 && (
                        <span className="flex flex-wrap items-center gap-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-mut">Missing:</span>
                          {m.missing.map(s => (
                            <span key={s} className="inline-flex items-center gap-0.5">
                              <Chip tone="bad" title="In the posting but not in your profile — click ＋ to add it">✗ {s}</Chip>
                              <button
                                className="grid h-[18px] w-[18px] place-items-center rounded-full border border-acc1/40 bg-acc1/10 text-[12px] font-bold leading-none text-acctxt transition-all hover:bg-acc1/25"
                                onClick={() => addSkillToProfile(s)}
                                title={`Add “${s}” to my profile skills`}
                              >
                                ＋
                              </button>
                            </span>
                          ))}
                        </span>
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
                      <button
                        className="rounded-full border border-ok/30 bg-ok/10 px-2.5 py-0.5 text-[11.5px] font-bold text-ok transition-all hover:bg-ok/20"
                        onClick={() => applyOnPlatform(j)}
                        title={`Open the official application on ${sourceLabel(j.source)} — you complete it there; InterviewIQ never applies for you`}
                      >
                        🔗 Apply on {sourceLabel(j.source)} ↗
                      </button>
                      {m.blockers.map((b, i) => (
                        <span key={i} className="text-warn">⚠️ {b}</span>
                      ))}
                    </div>
                  )}
                  {!locked && m && m.missing.length === 0 && (() => {
                    /* no missing-skill chips to suggest — offer the posting's own
                       mined vocabulary instead, so skill-less postings stay actionable */
                    const has = new Set((profile?.skills ?? []).map(s => s.toLowerCase()));
                    const skip = new Set([...m.matched, ...m.missing].map(s => s.toLowerCase()));
                    const jd = jdKeywords(j, 6).filter(k => !has.has(k) && !skip.has(k));
                    if (!jd.length) return null;
                    return (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-mut">💡 Leans on</span>
                        {jd.slice(0, 4).map(k => (
                          <span key={k} className="inline-flex items-center gap-0.5">
                            <Chip tone="co" title={`The posting leans on “${k}” — add it to your profile if you have this skill`}>{k}</Chip>
                            <button
                              className="grid h-[18px] w-[18px] place-items-center rounded-full border border-acc1/40 bg-acc1/10 text-[12px] font-bold leading-none text-acctxt transition-all hover:bg-acc1/25"
                              onClick={() => addSkillToProfile(k)}
                              title={`Add “${k}” to my skills`}
                            >
                              ＋
                            </button>
                          </span>
                        ))}
                      </div>
                    );
                  })()}
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
          title="📋 Apply to your imported jobs"
          desc="Work through the batch one at a time — each Apply opens the platform's own page in a new tab, where you complete the submission. InterviewIQ never applies for you; it just tracks progress."
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
                  {done ? (
                    <Chip tone="ok" title={tr.via ? `Applied via ${tr.via}` : "Marked applied"}>
                      ✓ {tr.via ? `Applied via ${tr.via}` : "Applied"}
                    </Chip>
                  ) : (
                    <button
                      className="shrink-0 rounded-full border border-ok/30 bg-ok/10 px-3 py-1.5 text-[12px] font-bold text-ok transition-all hover:bg-ok/20"
                      onClick={() => applyOnPlatform(j)}
                    >
                      🔗 Apply on {sourceLabel(j.source)} ↗
                    </button>
                  )}
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

/* weekly application report — activity, response rate, follow-up completion */
function ReportModal({ onClose }: { onClose: () => void }) {
  const r = weeklyReport();
  const maxApplied = Math.max(1, ...r.byWeek.map(w => w.applied));
  const digest = applyDigest();
  const copyDigest = () => {
    navigator.clipboard?.writeText(digest).then(
      () => toast("📋 Digest copied — paste it into your email or notes"),
      () => toast("✗ Clipboard blocked — copy manually")
    );
  };
  const [sending, setSending] = useState(false);
  const mailDigest = async () => {
    const user = getCloudState().user;
    /* real email via the send-apply-digest Edge Function when signed in;
       falls back to a mailto link so the flow always works */
    const fallback = () => {
      const url = `mailto:?subject=${encodeURIComponent("InterviewIQ — weekly application digest")}&body=${encodeURIComponent(digest)}`;
      window.location.href = url;
    };
    if (!user?.email) { fallback(); return; }
    setSending(true);
    try {
      const client = await getSupabaseClient();
      const { data: session } = await client!.auth.getSession();
      const token = session?.session?.access_token;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        apikey: CONFIG.supabase.anonKey,
        "Content-Type": "application/json"
      };
      const secret = storageGet<string>(STORAGE_KEYS.applyEmailSecret, "");
      if (secret) headers["x-apply-secret"] = secret;
      const key = storageGet<string>(STORAGE_KEYS.ragEmailKey, "");
      if (key) headers["x-resend-key"] = key;
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-apply-digest`, {
        method: "POST",
        headers,
        body: JSON.stringify({ to: user.email, subject: "InterviewIQ — weekly application digest", text: digest })
      });
      const body = await res.json().catch(() => ({}));
      if ((body as { sent?: boolean }).sent) {
        toast(`📧 Digest emailed to ${user.email}`);
      } else {
        toast(`✉️ Email not configured (${(body as { reason?: string }).reason ?? "unknown"}) — opening your mail app instead`);
        fallback();
      }
    } catch {
      toast("✉️ Couldn't reach the email service — opening your mail app instead");
      fallback();
    } finally {
      setSending(false);
    }
  };
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

      <div className="mt-5 rounded-xl border border-acc1/25 bg-acc1/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-extrabold text-acc1">📬 Weekly digest</p>
          <div className="flex gap-2">
            <button className={btnGhost + btnSm} onClick={copyDigest}>📋 Copy</button>
            <button className={btnGhost + btnSm} onClick={() => void mailDigest()} disabled={sending}>
              {sending ? "⏳ Sending…" : "✉️ Email"}
            </button>
          </div>
        </div>
        <pre className="mt-2 max-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-deep/40 p-3 font-sans text-[11.5px] leading-relaxed text-fnt">{digest}</pre>
        <p className="mt-2 text-[10.5px] text-mut">A weekly summary you can share or email — your numbers, follow-ups, and 8-week momentum.</p>
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
  const [bank, setBank] = useState<BankEntry[]>(() => listBank());
  const [bankOpen, setBankOpen] = useState(false);
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
    /* auto-collect the round's questions into the personal bank */
    if (round.questions.trim()) {
      const added = bankFromRound(round.questions, company, jobTitle, round.label);
      setBank(listBank());
      toast(added > 0 ? `🎤 Round saved — ${added} question${added === 1 ? "" : "s"} added to your bank` : "🎤 Round saved");
    } else {
      toast("🎤 Round saved");
    }
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

      <div className="mt-4 rounded-xl border border-line/15 bg-deep/30 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-extrabold">📚 My question bank ({bank.length})</p>
          <button className="text-[11px] font-bold text-acctxt hover:underline" onClick={() => setBankOpen(o => !o)}>
            {bankOpen ? "Hide" : "Browse"}
          </button>
        </div>
        <p className="mt-0.5 text-[11px] text-mut">Every question you record in a round lands here — reuse them across applications or practice the ones you struggled with.</p>
        {bankOpen && (
          <div className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto">
            {bank.length === 0 ? (
              <p className="text-[11.5px] text-mut">Nothing yet — save a round with notes and questions get collected automatically.</p>
            ) : (
              bank.map(b => (
                <div key={b.id} className="rounded-lg border border-line/15 bg-deep/40 p-2.5">
                  <p className="text-[12px] font-bold text-ink">{b.question}</p>
                  <p className="mt-0.5 text-[10.5px] text-mut">{b.company} · {b.jobTitle} · {b.roundLabel}</p>
                  <div className="mt-1.5 flex gap-2">
                    <button className="text-[11px] font-bold text-ok hover:underline" onClick={() => {
                      const cards = practiceForRound(b.question, getGoal()?.fieldId ?? "frontend");
                      if (!cards.length) { toast("No cards found for that question — try a more specific one"); return; }
                      setPractice({ round: { id: b.id, label: "Bank question", at: b.at, questions: b.question, went: null, outcome: "pending" }, cards });
                    }}>🎯 Practice</button>
                    <button className="text-[11px] font-bold text-bad hover:underline" onClick={() => { removeFromBank(b.id); setBank(listBank()); toast("🗑️ Removed from bank"); }}>Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

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

/* weekly recommendations digest — top picks + the learnable gap, emailable */
function RecsDigestModal({ profile, ranks, onClose }: { profile: CareerProfile; ranks: CompanyRank[]; onClose: () => void }) {
  const digest = useMemo(() => recommendationsDigest(profile, ranks), [profile, ranks]);
  const [sending, setSending] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(digest).then(
      () => toast("📋 Digest copied — paste it into your email or notes"),
      () => toast("✗ Clipboard blocked — copy manually")
    );
  };
  const email = async () => {
    const user = getCloudState().user;
    /* real email via the send-apply-digest Edge Function when signed in;
       falls back to a mailto link so the flow always works */
    const fallback = () => {
      const url = `mailto:?subject=${encodeURIComponent("InterviewIQ — weekly company recommendations")}&body=${encodeURIComponent(digest)}`;
      window.location.href = url;
    };
    if (!user?.email) { fallback(); return; }
    setSending(true);
    try {
      const client = await getSupabaseClient();
      const { data: session } = await client!.auth.getSession();
      const token = session?.session?.access_token;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        apikey: CONFIG.supabase.anonKey,
        "Content-Type": "application/json"
      };
      const secret = storageGet<string>(STORAGE_KEYS.applyEmailSecret, "");
      if (secret) headers["x-apply-secret"] = secret;
      const key = storageGet<string>(STORAGE_KEYS.ragEmailKey, "");
      if (key) headers["x-resend-key"] = key;
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-apply-digest`, {
        method: "POST",
        headers,
        body: JSON.stringify({ to: user.email, subject: "InterviewIQ — weekly company recommendations", text: digest })
      });
      const body = await res.json().catch(() => ({}));
      if ((body as { sent?: boolean }).sent) {
        toast(`📧 Digest emailed to ${user.email}`);
      } else {
        toast(`✉️ Email not configured (${(body as { reason?: string }).reason ?? "unknown"}) — opening your mail app instead`);
        fallback();
      }
    } catch {
      toast("✉️ Couldn't reach the email service — opening your mail app instead");
      fallback();
    } finally {
      setSending(false);
    }
  };
  return (
    <Modal onClose={onClose} title="📧 Weekly recommendations digest" desc="Your top picks and the biggest learnable gap — copy it, or email it to yourself each week.">
      <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">
        {digest}
      </pre>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className={btnGhost + btnSm} onClick={copy}>📋 Copy</button>
        <button className={btnPrimary + btnSm} onClick={email} disabled={sending}>
          {sending ? "⏳ Sending…" : "📧 Email to me"}
        </button>
      </div>
    </Modal>
  );
}
