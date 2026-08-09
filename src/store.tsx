import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import type { Answer, Config, LevelId, QA, SavedSession, Session } from "./types";
import { composeSession, buildFeedback, grade } from "./engine";
import { fieldById, levelById } from "./data";
import { uid } from "./util";

export type View = "onboard" | "interview" | "results" | "bank" | "history" | "settings";

export interface Ob {
  level: LevelId | null;
  field: string | null;
  company: string | null;
}

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

const read = <T,>(k: string, d: T): T => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || "null");
    return v === null || v === undefined ? d : (v as T);
  } catch {
    return d;
  }
};

const initialOb = (): Ob => ({ level: null, field: null, company: null, ...read("iq.onboard", {}) });
const initialStep = (ob: Ob): number => (ob.level ? (ob.field ? (ob.company ? 4 : 3) : 2) : 1);

function initialState(): AppState {
  const ob = initialOb();
  return {
    view: "onboard",
    ob,
    step: initialStep(ob),
    config: { ...DEFAULT_CONFIG, ...read("iq.settings", {}) },
    session: null,
    idx: 0,
    answers: [],
    feedbackShown: false,
    viewingHistory: false,
    sessions: read("iq.sessions", [])
  };
}

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
    case "SET_SESSION": return { ...state, session: a.session, config: a.config, idx: 0, answers: [], feedbackShown: false, viewingHistory: false, view: "interview" };
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
  saveSession: () => void;
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

  /* persistence */
  useEffect(() => { localStorage.setItem("iq.onboard", JSON.stringify(state.ob)); }, [state.ob]);
  useEffect(() => { localStorage.setItem("iq.settings", JSON.stringify(state.config)); }, [state.config]);
  useEffect(() => { localStorage.setItem("iq.sessions", JSON.stringify(state.sessions)); }, [state.sessions]);

  const api = useMemo<AppApi>(() => ({
    state,
    nav: view => { window.scrollTo({ top: 0 }); dispatch({ type: "NAV", view }); },
    selectLevel: id => dispatch({ type: "SET_OB", patch: { level: id }, step: 2 }),
    selectField: id => dispatch({ type: "SET_OB", patch: { field: id }, step: 3 }),
    selectCompany: id => dispatch({ type: "SET_OB", patch: { company: id }, step: 4 }),
    setStep: n => dispatch({ type: "SET_STEP", step: n }),
    startSession: config => {
      const { ob } = state;
      const session = composeSession({
        fieldId: ob.field, companyId: ob.company, levelId: ob.level, count: config.count, mode: config.mode
      });
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
      if (!state.feedbackShown) {
        const fb = buildFeedback("", q);
        dispatch({ type: "ADD_ANSWER", answer: { q, user: "", fb } });
      }
      dispatch({ type: "NEXT" });
    },
    nextQuestion: () => dispatch({ type: "NEXT" }),
    exitToResults: () => dispatch({ type: "NAV", view: "results" }),
    practice: (fieldId, q) => {
      const field = fieldById(fieldId);
      const session: Session = {
        questions: [{ ...q, cat: "field", catLabel: "Technical", catColor: "#22d3ee", level: q.lvl, src: "bank" }],
        meta: {
          field: field?.name ?? "Question Bank", fieldId,
          company: "Question Bank", companyId: "bank",
          level: levelById(q.lvl).name, levelId: q.lvl, mode: "standard"
        }
      };
      dispatch({ type: "SET_SESSION", session, config: { ...state.config, count: 1, timing: "none" } });
    },
    saveSession: () => {
      const s = makeSavedSession(state);
      if (s) dispatch({ type: "ADD_SESSION", s });
    },
    retry: () => { dispatch({ type: "RESET_SESSION" }); dispatch({ type: "NAV", view: "interview" }); },
    newSession: () => { dispatch({ type: "RESET_SESSION" }); dispatch({ type: "SET_STEP", step: 1 }); dispatch({ type: "NAV", view: "onboard" }); },
    openHistory: id => {
      const s = state.sessions.find(x => x.id === id);
      if (!s) return;
      const session: Session = { questions: s.answers.map(a => a.q), meta: s.meta };
      dispatch({ type: "SET_SESSION", session, config: s.config });
      dispatch({ type: "SET_VIEWING_HISTORY", v: true });
      /* replay answers as readonly */
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
      ["iq.sessions", "iq.onboard", "iq.settings", "iq.apiKey", "iq.apiBase", "iq.apiModel"].forEach(k => localStorage.removeItem(k));
      dispatch({ type: "RESET_ALL" });
    }
  }), [state]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

/* helpers used by store */
export function makeSavedSession(state: AppState): SavedSession | null {
  if (!state.session || !state.answers.length) return null;
  const sum = state.answers.reduce((acc, a) => acc + a.fb.score, 0);
  const pct = sum / (state.answers.length * 5);
  return {
    id: uid(),
    date: Date.now(),
    meta: state.session.meta,
    config: state.config,
    agg: { score: +(pct * 5).toFixed(1), pct, grade: grade(pct) },
    answers: state.answers.map(a => ({ q: a.q, user: a.user, score: a.fb.score, pct: a.fb.pct }))
  };
}
