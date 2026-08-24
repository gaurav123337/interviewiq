import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import type { Answer, Config, LevelId, QA, SavedSession, Session, View } from "./types";
import { buildFeedback, composeRelevantSession } from "./engine";
import {
  buildInterviewSession, buildJdSession, buildPracticeSession, buildReplaySession,
  buildWeakTopicSession, makeSavedSession, type OnboardingSelection
} from "./services/session";
import { analyzeJd, type JdResult } from "./services/jd";
import { composeDiagnostic, persistDiagnostic } from "./services/diagnostic";
import { recordSession } from "./services/entitlements";
import { notifyStreak } from "./services/notifications";
import { streaks } from "./services/progress";
import { applySessionToProgress } from "./services/roadmap";
import { getGoal } from "./services/goal";
import { queueEvent, recordProfileSession } from "./services/events";
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "./services/storage";
import { toast } from "./toast";

/* ------------------------------------------------------------------ */
/* State                                                                 */
/* ------------------------------------------------------------------ */

export interface Ob extends OnboardingSelection {
  /** Raw job description text when the user tailors by pasting a JD. */
  jd?: string;
}

export interface AppState {
  view: View;
  prevView: View;
  ob: Ob;
  step: number;
  config: Config;
  session: Session | null;
  idx: number;
  answers: Answer[];
  feedbackShown: boolean;
  viewingHistory: boolean;
  sessions: SavedSession[];
}

const DEFAULT_CONFIG: Config = { count: 8, mode: "standard", timing: "relaxed", voice: true };

const initialOb = (): Ob => ({ level: null, field: null, company: null, ...storageGet(STORAGE_KEYS.onboard, {}) });
const initialStep = (ob: Ob): number => (ob.level ? (ob.field ? (ob.company ? 4 : 3) : 2) : 1);

/* ── URL ↔ View sync ──────────────────────────────────────────────── */
/** Map View names to URL path segments */
const VIEW_TO_HASH: Record<string, string> = {
  landing: "", onboard: "practice", interview: "interview", results: "results",
  drill: "drill", bank: "bank", history: "history", settings: "settings",
  planner: "planner", roadmap: "roadmap", playground: "playground", admin: "admin",
  progress: "progress", team: "team", account: "account", legal: "legal",
  jobs: "jobs", articles: "articles", resources: "resources", counselor: "counselor",
  systemDesign: "system-design", learn: "learn", "learn-detail": "learn",
};
const HASH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_TO_HASH).map(([v, h]) => [h, v])
);

/** Read the initial view from the URL.
    Hash is primary (#/planner). Clean URL (/planner) is a fallback
    for when the service worker serves index.html for unknown paths. */
function viewFromHash(): string | null {
  // 1. Hash (primary): #/planner → "planner"
  const hash = window.location.hash.replace(/^#\//, "").replace(/\?.*$/, "");
  if (hash && HASH_TO_VIEW[hash]) return HASH_TO_VIEW[hash];
  // 2. Clean URL fallback: /interviewiq/planner → "planner"
  const pathname = window.location.pathname.replace(/^\/interviewiq\/?/, "").replace(/^\//, "");
  if (pathname && HASH_TO_VIEW[pathname]) return HASH_TO_VIEW[pathname];
  return null;
}

/** Set the URL hash AND show a clean URL via replaceState.
    Hash is the source of truth for routing; replaceState is cosmetic. */
function pushViewToHash(view: string) {
  const path = VIEW_TO_HASH[view];
  if (path === undefined) return;
  // Set hash (source of truth for routing)
  window.location.hash = path ? "/" + path : "";
  // Show clean URL (cosmetic)
  window.history.replaceState(null, "", "/interviewiq/" + (path || ""));
}

function initialState(): AppState {
  const ob = initialOb();
  const onboarded = !!ob.level;
  /* Check URL hash first — enables bookmarking/sharing */
  const urlView = viewFromHash();
  const defaultView = onboarded ? "onboard" : "landing";
  return {
    view: (urlView ?? defaultView) as View,
    prevView: onboarded ? "onboard" : "landing",
    ob,
    step: initialStep(ob),
    config: { ...DEFAULT_CONFIG, ...storageGet(STORAGE_KEYS.settings, {}) },
    session: null,
    idx: 0,
    answers: [],
    feedbackShown: false,
    viewingHistory: false,
    sessions: storageGet(STORAGE_KEYS.sessions, [])
  };
}

/* ------------------------------------------------------------------ */
/* Reducer (pure — no side effects)                                     */
/* ------------------------------------------------------------------ */

type Action =
  | { type: "NAV"; view: View }
  | { type: "SET_OB"; patch: Partial<Ob>; step: number }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_SESSION"; session: Session; config: Config }
  | { type: "ADD_ANSWER"; answer: Answer }
  | { type: "SET_FEEDBACK_SHOWN"; v: boolean }
  | { type: "NEXT" }
  | { type: "RESET_SESSION" }
  | { type: "SET_VIEWING_HISTORY"; v: boolean }
  | { type: "ADD_SESSION"; s: SavedSession }
  | { type: "DELETE_SESSION"; id: string }
  | { type: "UPDATE_CONFIG"; patch: Partial<Config> }
  | { type: "CLEAR_SESSIONS" }
  | { type: "RESET_ALL" };

function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case "NAV": return { ...state, view: a.view };
    case "SET_OB": return { ...state, ob: { ...state.ob, ...a.patch }, step: a.step };
    case "SET_STEP": return { ...state, step: a.step };
    case "SET_SESSION":
      return { ...state, prevView: state.view, session: a.session, config: a.config, idx: 0, answers: [], feedbackShown: false, viewingHistory: false, view: "interview" };
    case "ADD_ANSWER": return { ...state, answers: [...state.answers, a.answer] };
    case "SET_FEEDBACK_SHOWN": return { ...state, feedbackShown: a.v };
    case "NEXT": {
      const next = state.idx + 1;
      if (!state.session || next >= state.session.questions.length) return { ...state, view: "results" };
      return { ...state, idx: next, feedbackShown: false };
    }
    case "RESET_SESSION": return { ...state, session: null, idx: 0, answers: [], feedbackShown: false, viewingHistory: false };
    case "SET_VIEWING_HISTORY": return { ...state, viewingHistory: a.v };
    case "ADD_SESSION": {
      const list = state.sessions.filter(s => s.id !== a.s.id);
      list.unshift(a.s);
      return { ...state, sessions: list.slice(0, 30) };
    }
    case "DELETE_SESSION": return { ...state, sessions: state.sessions.filter(s => s.id !== a.id) };
    case "UPDATE_CONFIG": return { ...state, config: { ...state.config, ...a.patch } };
    case "CLEAR_SESSIONS": return { ...state, sessions: [] };
    case "RESET_ALL":
      return { ...initialState(), ob: { level: null, field: null, company: null }, step: 1 };
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* API facade                                                           */
/* ------------------------------------------------------------------ */

interface AppApi {
  state: AppState;
  nav: (view: View) => void;
  selectLevel: (id: LevelId) => void;
  selectField: (id: string) => void;
  selectCompany: (id: string) => void;
  setStep: (n: number) => void;
  startSession: (config: Config) => void;
  startDiagnostic: (fieldId: string, targetLevel: LevelId) => void;
  startPlannedSession: (sel: OnboardingSelection, config: Config, keywords?: string[]) => void;
  startWeakSession: (fieldId: string, levelId: LevelId, topics: string[], config: Config) => void;
  applyJd: (r: JdResult & { text: string }) => void;
  practiceWeakTopics: () => void;
  submitAnswer: (user: string) => void;
  skipQuestion: () => void;
  nextQuestion: () => void;
  exitToResults: () => void;
  practice: (fieldId: string, q: QA & { lvl: LevelId }) => void;
  retry: () => void;
  newSession: () => void;
  openHistory: (id: string) => void;
  deleteHistory: (id: string) => void;
  updateConfig: (patch: Partial<Config>) => void;
  clearHistory: () => void;
  resetAll: () => void;
}

const Ctx = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  /* persistence — declarative effects at the app boundary (the only side effects here) */
  useEffect(() => { storageSet(STORAGE_KEYS.onboard, state.ob); }, [state.ob]);
  useEffect(() => { storageSet(STORAGE_KEYS.settings, state.config); }, [state.config]);
  useEffect(() => { storageSet(STORAGE_KEYS.sessions, state.sessions); }, [state.sessions]);

  const api = useMemo<AppApi>(() => {
    /* Saves the session to history exactly when it completes (last question or manual end).
       Runs once per user action — safe from StrictMode double-effects since it's an event handler.
       Diagnostic sessions are NOT saved to history: they persist the skill-gap result instead. */
    const saveOnCompletion = (answers: Answer[]) => {
      const { session, idx, config, sessions } = state;
      if (session && idx + 1 >= session.questions.length && answers.length) {
        if (config.mode === "diagnostic") {
          persistDiagnostic(answers, session.meta.fieldId);
          return;
        }
        const s = makeSavedSession(session.meta, config, answers);
        if (s) {
          dispatch({ type: "ADD_SESSION", s });
          recordSession(); /* usage metering for the freemium quota */
          recordProfileSession(); /* admin dashboard counter */
          void queueEvent("session", { pct: s.agg.pct, level: s.meta.levelId, field: s.meta.fieldId, mode: s.config.mode });
          /* harvest feed: per-question scores so admins can spot systemic weak spots */
          void queueEvent("session_answers", {
            fieldId: s.meta.fieldId, levelId: s.meta.levelId,
            items: answers.slice(0, 15).map(a => ({ q: a.q.q, score: a.fb.score, missed: a.fb.missed ?? [] }))
          });
          notifyStreak(streaks([s, ...sessions], new Date()).current); /* streak milestone alerts */
          /* roadmap feedback loop: strong answers mark matching topics done */
          const goal = getGoal();
          if (goal) {
            try { applySessionToProgress(goal, answers.map(a => ({ q: a.q, user: a.user, score: a.fb.score, pct: a.fb.pct, missed: a.fb.missed }))); } catch { /* never break a session save */ }
          }
        }
      }
    };

    return {
      state,
      nav: view => { window.scrollTo({ top: 0 }); pushViewToHash(view); dispatch({ type: "NAV", view }); },
      selectLevel: id => dispatch({ type: "SET_OB", patch: { level: id, jd: undefined }, step: 2 }),
      selectField: id => dispatch({ type: "SET_OB", patch: { field: id, jd: undefined }, step: 3 }),
      selectCompany: id => dispatch({ type: "SET_OB", patch: { company: id, jd: undefined }, step: 4 }),
      setStep: n => dispatch({ type: "SET_STEP", step: n }),
      applyJd: r => dispatch({
        type: "SET_OB",
        patch: { level: r.levelId, field: r.fieldId, company: r.companyId ?? "general", jd: r.text },
        step: 4
      }),
      startPlannedSession: (sel, config, keywords) => {
        const session = keywords?.length
          ? composeRelevantSession({ fieldId: sel.field, companyId: sel.company, levelId: sel.level, keywords, count: config.count, mode: config.mode })
          : buildInterviewSession(sel, config);
        dispatch({ type: "SET_SESSION", session, config });
      },
      startWeakSession: (fieldId, levelId, topics, config) => {
        const s = buildWeakTopicSession(fieldId, levelId, topics, config);
        dispatch({ type: "SET_SESSION", session: s, config });
      },
      startSession: config => {
        const session = state.ob.jd
          ? buildJdSession(analyzeJd(state.ob.jd), config)
          : buildInterviewSession(state.ob, config);
        dispatch({ type: "SET_SESSION", session, config });
      },
      startDiagnostic: (fieldId, targetLevel) => {
        const session = composeDiagnostic(fieldId, targetLevel);
        dispatch({ type: "SET_SESSION", session, config: { ...state.config, count: session.questions.length, mode: "diagnostic", timing: "none" } });
      },
      practiceWeakTopics: () => {
        const { session, answers, config } = state;
        if (!session) return;
        const topics = [...new Set(answers.flatMap(a => a.fb.missed ?? []))].slice(0, 12);
        const s = buildWeakTopicSession(session.meta.fieldId, session.meta.levelId, topics, config);
        dispatch({ type: "SET_SESSION", session: s, config });
      },
      submitAnswer: user => {
        if (!state.session) return;
        const q = state.session.questions[state.idx];
        const fb = buildFeedback(user, q);
        dispatch({ type: "ADD_ANSWER", answer: { q, user, fb } });
        dispatch({ type: "SET_FEEDBACK_SHOWN", v: true });
      },
      skipQuestion: () => {
        if (!state.session) return;
        const q = state.session.questions[state.idx];
        let answers = state.answers;
        if (!state.feedbackShown) {
          const fb = buildFeedback("", q);
          const answer = { q, user: "", fb };
          dispatch({ type: "ADD_ANSWER", answer });
          answers = [...answers, answer];
        }
        saveOnCompletion(answers);
        dispatch({ type: "NEXT" });
      },
      nextQuestion: () => {
        saveOnCompletion(state.answers);
        dispatch({ type: "NEXT" });
      },
      exitToResults: () => {
        const { session, answers, config, prevView } = state;
        if (session && answers.length) {
          if (config.mode === "diagnostic") {
            persistDiagnostic(answers, session.meta.fieldId);
          } else {
            const s = makeSavedSession(session.meta, config, answers);
            if (s) {
              dispatch({ type: "ADD_SESSION", s });
              /* harvest feed for the admin miss-candidate view */
              void queueEvent("session_answers", {
                fieldId: s.meta.fieldId, levelId: s.meta.levelId,
                items: answers.slice(0, 15).map(a => ({ q: a.q.q, score: a.fb.score, missed: a.fb.missed ?? [] }))
              });
            }
          }
          dispatch({ type: "NAV", view: "results" });
        } else {
          /* no answers recorded — never land on a blank results screen */
          toast("No answers recorded — answer at least one question to see results");
          dispatch({ type: "NAV", view: prevView });
        }
      },
      practice: (fieldId, q) => {
        const session = buildPracticeSession(fieldId, q);
        dispatch({ type: "SET_SESSION", session, config: { ...state.config, count: 1, timing: "none" } });
      },
      retry: () => { dispatch({ type: "RESET_SESSION" }); dispatch({ type: "NAV", view: "interview" }); },
      newSession: () => { dispatch({ type: "RESET_SESSION" }); dispatch({ type: "SET_OB", patch: { jd: undefined }, step: 1 }); dispatch({ type: "NAV", view: "onboard" }); },
      openHistory: id => {
        const s = state.sessions.find(x => x.id === id);
        if (!s) return;
        const session = buildReplaySession(s);
        dispatch({ type: "SET_SESSION", session, config: s.config });
        dispatch({ type: "SET_VIEWING_HISTORY", v: true });
        /* replay answers as readonly feedback */
        for (const a of s.answers) {
          dispatch({
            type: "ADD_ANSWER",
            answer: {
              q: a.q, user: a.user,
              fb: { score: a.score, pct: a.pct, covered: [], missed: a.missed ?? [], strengths: ["Replay of a saved session."], gaps: a.missed ?? [], words: 0 }
            }
          });
        }
        dispatch({ type: "SET_FEEDBACK_SHOWN", v: true });
        dispatch({ type: "NAV", view: "results" });
      },
      deleteHistory: id => dispatch({ type: "DELETE_SESSION", id }),
      updateConfig: patch => dispatch({ type: "UPDATE_CONFIG", patch }),
      clearHistory: () => dispatch({ type: "CLEAR_SESSIONS" }),
      resetAll: () => {
        Object.values(STORAGE_KEYS).forEach(k => storageRemove(k));
        dispatch({ type: "RESET_ALL" });
      }
    };
  }, [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
