import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import type { Answer, Config, LevelId, QA, SavedSession, Session, View } from "./types";
import { buildFeedback } from "./engine";
import {
  buildInterviewSession, buildPracticeSession, buildReplaySession, makeSavedSession,
  type OnboardingSelection
} from "./services/session";
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from "./services/storage";

/* ------------------------------------------------------------------ */
/* State                                                                 */
/* ------------------------------------------------------------------ */

export interface Ob extends OnboardingSelection {}

export interface AppState {
  view: View;
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

function initialState(): AppState {
  const ob = initialOb();
  return {
    view: "onboard",
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
      return { ...state, session: a.session, config: a.config, idx: 0, answers: [], feedbackShown: false, viewingHistory: false, view: "interview" };
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
       Runs once per user action — safe from StrictMode double-effects since it's an event handler. */
    const saveOnCompletion = (answers: Answer[]) => {
      const { session, idx, config } = state;
      if (session && idx + 1 >= session.questions.length && answers.length) {
        const s = makeSavedSession(session.meta, config, answers);
        if (s) dispatch({ type: "ADD_SESSION", s });
      }
    };

    return {
      state,
      nav: view => { window.scrollTo({ top: 0 }); dispatch({ type: "NAV", view }); },
      selectLevel: id => dispatch({ type: "SET_OB", patch: { level: id }, step: 2 }),
      selectField: id => dispatch({ type: "SET_OB", patch: { field: id }, step: 3 }),
      selectCompany: id => dispatch({ type: "SET_OB", patch: { company: id }, step: 4 }),
      setStep: n => dispatch({ type: "SET_STEP", step: n }),
      startSession: config => {
        const session = buildInterviewSession(state.ob, config);
        dispatch({ type: "SET_SESSION", session, config });
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
        const { session, answers, config } = state;
        if (session && answers.length) {
          const s = makeSavedSession(session.meta, config, answers);
          if (s) dispatch({ type: "ADD_SESSION", s });
        }
        dispatch({ type: "NAV", view: "results" });
      },
      practice: (fieldId, q) => {
        const session = buildPracticeSession(fieldId, q);
        dispatch({ type: "SET_SESSION", session, config: { ...state.config, count: 1, timing: "none" } });
      },
      retry: () => { dispatch({ type: "RESET_SESSION" }); dispatch({ type: "NAV", view: "interview" }); },
      newSession: () => { dispatch({ type: "RESET_SESSION" }); dispatch({ type: "SET_STEP", step: 1 }); dispatch({ type: "NAV", view: "onboard" }); },
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
              fb: { score: a.score, pct: a.pct, covered: [], missed: [], strengths: ["Replay of a saved session."], gaps: [], words: 0 }
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
