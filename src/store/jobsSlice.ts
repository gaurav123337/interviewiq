import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { CareerProfile, JobPosting } from "../types";
import {
  EMPTY_FILTERS,
  EMPTY_RANK_FILTERS,
  type JobFilters,
  type RankFilters,
  listJobs,
  listShortlist,
  getCareerProfile,
} from "../services/jobs";
import { getUploadedResume } from "../services/resume";
import type { UploadedResume } from "../types";
import { dueFollowUps, listTracks, type ApplyTrack } from "../services/applyTrack";
import { benchLevelForYears, detectMarket, type BenchLevel, type Market } from "../services/salaryBench";
import { storageGet, STORAGE_KEYS } from "../services/storage";

/* ------------------------------------------------------------------ */
/* Jobs slice — shared state for Jobs page + modals                   */
/* ------------------------------------------------------------------ */

export interface JobsState {
  profile: CareerProfile | null;
  jobs: JobPosting[];
  refreshing: boolean;
  saving: boolean;
  filters: JobFilters;
  resume: UploadedResume | null;
  tracks: Record<string, ApplyTrack>;
  due: ApplyTrack[];
  shortlist: Set<string>;
  rankLimit: number;
  rankFilters: RankFilters;
  // Salary benchmark
  benchLvl: BenchLevel;
  benchCo: string;
  benchOpen: boolean;
  market: Market;
  expected: string;
  offerOpen: boolean;
  // Import
  importOpen: boolean;
  importUrl: string;
  importing: boolean;
  importResults: { url: string; job: JobPosting | null; error: string | null }[];
  importErr: string | null;
  applyQueue: JobPosting[] | null;
  // Resume
  resumeFormOpen: boolean;
  resumeShowAll: boolean;
  resumePaste: string;
  resumeBusy: boolean;
  skillSuggestions: string[];
  resumeBannerDismissed: boolean;
  applyHintShown: boolean;
  showResumeBanner: boolean;
  // Modals
  upgrade: string | null;
  gapJob: { job: JobPosting; missing: string[] } | null;
  kitJob: JobPosting | null;
  reportOpen: boolean;
  draftJob: ApplyTrack | null;
  roundJob: ApplyTrack | null;
  recsDigestOpen: boolean;
}

const initTracks = (): Record<string, ApplyTrack> => {
  const m: Record<string, ApplyTrack> = {};
  for (const t of listTracks()) m[t.jobId] = t;
  return m;
};

const initialState: JobsState = {
  profile: getCareerProfile(),
  jobs: listJobs(),
  refreshing: false,
  saving: false,
  filters: EMPTY_FILTERS,
  resume: getUploadedResume(),
  tracks: initTracks(),
  due: dueFollowUps(),
  shortlist: new Set(listShortlist()),
  rankLimit: 10,
  rankFilters: EMPTY_RANK_FILTERS,
  benchLvl: benchLevelForYears(getCareerProfile()?.years ?? 0),
  benchCo: "",
  benchOpen: false,
  market: detectMarket(getCareerProfile()?.location),
  expected: "",
  offerOpen: false,
  importOpen: false,
  importUrl: "",
  importing: false,
  importResults: [],
  importErr: null,
  applyQueue: null,
  resumeFormOpen: false,
  resumeShowAll: false,
  resumePaste: "",
  resumeBusy: false,
  skillSuggestions: [],
  resumeBannerDismissed: storageGet<boolean>(STORAGE_KEYS.resumeStrictBanner, false),
  applyHintShown: storageGet<boolean>(STORAGE_KEYS.externalApplyHint, false),
  showResumeBanner: false,
  upgrade: null,
  gapJob: null,
  kitJob: null,
  reportOpen: false,
  draftJob: null,
  roundJob: null,
  recsDigestOpen: false,
};

export const jobsSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {
    setJobs(state, action: PayloadAction<JobPosting[]>) {
      state.jobs = action.payload;
    },
    setProfile(state, action: PayloadAction<CareerProfile | null>) {
      state.profile = action.payload;
    },
    setRefreshing(state, action: PayloadAction<boolean>) {
      state.refreshing = action.payload;
    },
    setSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    },
    setFilters(state, action: PayloadAction<JobFilters>) {
      state.filters = action.payload;
    },
    setResume(state, action: PayloadAction<UploadedResume | null>) {
      state.resume = action.payload;
    },
    setTracks(state, action: PayloadAction<Record<string, ApplyTrack>>) {
      state.tracks = action.payload;
    },
    setDue(state, action: PayloadAction<ApplyTrack[]>) {
      state.due = action.payload;
    },
    toggleShortlist(state, action: PayloadAction<string>) {
      const id = action.payload;
      const next = new Set(state.shortlist);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      state.shortlist = next;
    },
    setShortlist(state, action: PayloadAction<Set<string>>) {
      state.shortlist = action.payload;
    },
    setRankLimit(state, action: PayloadAction<number>) {
      state.rankLimit = action.payload;
    },
    setRankFilters(state, action: PayloadAction<RankFilters>) {
      state.rankFilters = action.payload;
    },
    // Salary benchmark
    setBenchLvl(state, action: PayloadAction<BenchLevel>) {
      state.benchLvl = action.payload;
    },
    setBenchCo(state, action: PayloadAction<string>) {
      state.benchCo = action.payload;
    },
    setBenchOpen(state, action: PayloadAction<boolean>) {
      state.benchOpen = action.payload;
    },
    setMarket(state, action: PayloadAction<Market>) {
      state.market = action.payload;
    },
    setExpected(state, action: PayloadAction<string>) {
      state.expected = action.payload;
    },
    setOfferOpen(state, action: PayloadAction<boolean>) {
      state.offerOpen = action.payload;
    },
    // Import
    setImportOpen(state, action: PayloadAction<boolean>) {
      state.importOpen = action.payload;
    },
    setImportUrl(state, action: PayloadAction<string>) {
      state.importUrl = action.payload;
    },
    setImporting(state, action: PayloadAction<boolean>) {
      state.importing = action.payload;
    },
    setImportResults(state, action: PayloadAction<{ url: string; job: JobPosting | null; error: string | null }[]>) {
      state.importResults = action.payload;
    },
    setImportErr(state, action: PayloadAction<string | null>) {
      state.importErr = action.payload;
    },
    setApplyQueue(state, action: PayloadAction<JobPosting[] | null>) {
      state.applyQueue = action.payload;
    },
    // Resume
    setResumeFormOpen(state, action: PayloadAction<boolean>) {
      state.resumeFormOpen = action.payload;
    },
    setResumeShowAll(state, action: PayloadAction<boolean>) {
      state.resumeShowAll = action.payload;
    },
    setResumePaste(state, action: PayloadAction<string>) {
      state.resumePaste = action.payload;
    },
    setResumeBusy(state, action: PayloadAction<boolean>) {
      state.resumeBusy = action.payload;
    },
    setSkillSuggestions(state, action: PayloadAction<string[]>) {
      state.skillSuggestions = action.payload;
    },
    setResumeBannerDismissed(state, action: PayloadAction<boolean>) {
      state.resumeBannerDismissed = action.payload;
    },
    setApplyHintShown(state, action: PayloadAction<boolean>) {
      state.applyHintShown = action.payload;
    },
    setShowResumeBanner(state, action: PayloadAction<boolean>) {
      state.showResumeBanner = action.payload;
    },
    // Modals
    setUpgrade(state, action: PayloadAction<string | null>) {
      state.upgrade = action.payload;
    },
    setGapJob(state, action: PayloadAction<{ job: JobPosting; missing: string[] } | null>) {
      state.gapJob = action.payload;
    },
    setKitJob(state, action: PayloadAction<JobPosting | null>) {
      state.kitJob = action.payload;
    },
    setReportOpen(state, action: PayloadAction<boolean>) {
      state.reportOpen = action.payload;
    },
    setDraftJob(state, action: PayloadAction<ApplyTrack | null>) {
      state.draftJob = action.payload;
    },
    setRoundJob(state, action: PayloadAction<ApplyTrack | null>) {
      state.roundJob = action.payload;
    },
    setRecsDigestOpen(state, action: PayloadAction<boolean>) {
      state.recsDigestOpen = action.payload;
    },
  },
});

export const {
  setJobs, setProfile, setRefreshing, setSaving, setFilters, setResume,
  setTracks, setDue, toggleShortlist, setShortlist, setRankLimit, setRankFilters,
  setBenchLvl, setBenchCo, setBenchOpen, setMarket, setExpected, setOfferOpen,
  setImportOpen, setImportUrl, setImporting, setImportResults, setImportErr, setApplyQueue,
  setResumeFormOpen, setResumeShowAll, setResumePaste, setResumeBusy, setSkillSuggestions,
  setResumeBannerDismissed, setApplyHintShown, setShowResumeBanner,
  setUpgrade, setGapJob, setKitJob, setReportOpen, setDraftJob, setRoundJob, setRecsDigestOpen,
} = jobsSlice.actions;
