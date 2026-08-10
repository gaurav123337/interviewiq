import { useEffect, useMemo, useRef, useState } from "react";
import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { go } from "@codemirror/lang-go";
import { html as htmlLang } from "@codemirror/lang-html";
import { css as cssLang } from "@codemirror/lang-css";
import { CODING_PROBLEMS, RUNNER_LANGS, codingProblemById, type CodingProblem, type LangId } from "../data/coding";
import { companyById } from "../data";
import { companyFrequency, companyInterviewPlan, freqForProblem, hasPersonalSignals, personalPlan, problemIsForCompany } from "../data/codingCompanies";
import { useApp } from "../store";
import { buildProgram, runCase, runFnTests, runLocalJavaScript, runTests, runUiTests, type FnCaseResult, type UiCaseResult } from "../services/runner";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import { getTheme, type Theme } from "../services/theme";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import { recordCodingAttempt } from "../services/codingTrack";
import { getGoal } from "../services/goal";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip, Difficulty, Seg } from "./ui";
import { UpgradeModal } from "./Upgrade";
import { CoachChat } from "./CoachChat";

type CodeCache = Record<string, Partial<Record<LangId, string>>>;
/* UI problems persist three sources per problem id. */
type UiCache = Record<string, { html: string; css: string; js: string }>;

const loadCache = (): CodeCache => storageGet<CodeCache>(STORAGE_KEYS.code, {});
const loadUiCache = (): UiCache => storageGet<UiCache>(STORAGE_KEYS.uiCode, {});
const cacheFor = (id: string, lang: LangId): string => loadCache()[id]?.[lang] ?? "";
const uiCacheFor = (id: string): { html: string; css: string; js: string } | undefined => loadUiCache()[id];

const DIFF_COLOR: Record<number, string> = { 1: "text-ok", 2: "text-warn", 3: "text-bad" };

/* Function-mode problems always run JavaScript in the browser (offline). */
const starterFor = (p: CodingProblem, lang: LangId): string =>
  p.kind === "fn" ? p.starter : p.kind === "cli" ? (p.starters[lang] ?? "") : "";

/* Compact value formatting for the fn-mode results table. */
const fmt = (v: unknown): string => {
  if (typeof v === "function") return `ƒ ${v.name || "anonymous"}`;
  if (v === undefined) return "undefined";
  if (typeof v === "number" && Number.isNaN(v)) return "NaN";
  if (v instanceof Date) return v.toISOString();
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
};

/* Language → CodeMirror grammar (TS builds on the JS grammar with types). */
const LANG_EXT: Record<LangId, () => Extension> = {
  python: () => python(),
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  cpp: () => cpp(),
  java: () => java(),
  go: () => go()
};

const UI_PANELS = [
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "js", label: "JS" }
] as const;

type UiPanel = (typeof UI_PANELS)[number]["id"];

/* P3 taxonomy — every problem belongs to a filterable category + searchable title */
const catOf = (p: CodingProblem): string =>
  p.kind === "cli" ? "Algorithms" : p.kind === "fn" ? "Functions" : "UI components";

const ALL_CATS = ["All", "Algorithms", "Functions", "UI components"] as const;
type CatFilter = (typeof ALL_CATS)[number];

/* deterministic daily pick — cycles the whole bank, one problem per day */
const dailyProblemId = (): string => {
  const day = Math.floor(Date.now() / 86_400_000);
  return CODING_PROBLEMS[day % CODING_PROBLEMS.length].id;
};

export function Playground() {
  const [problemId, setProblemId] = useState(CODING_PROBLEMS[0].id);
  const [lang, setLang] = useState<LangId>("python");
  const [code, setCode] = useState(() => cacheFor(CODING_PROBLEMS[0].id, "python"));
  /* UI-mode sources */
  const [uiPanel, setUiPanel] = useState<UiPanel>("html");
  const [uiSrc, setUiSrc] = useState<{ html: string; css: string; js: string }>(() => {
    const p = CODING_PROBLEMS[0];
    return p.kind === "ui" ? { html: p.html, css: p.css, js: p.js } : { html: "", css: "", js: "" };
  });
  const [previewTick, setPreviewTick] = useState(0);
  const [customIn, setCustomIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [runOut, setRunOut] = useState<{ stdout: string; error?: string; ok: boolean } | null>(null);
  const [cases, setCases] = useState<{ pass: boolean; stdin: string; expect: string; got: string; error?: string }[] | null>(null);
  const [fnCases, setFnCases] = useState<FnCaseResult[] | null>(null);
  const [uiCases, setUiCases] = useState<UiCaseResult[] | null>(null);
  /* Pro gating for hints + solutions */
  const [hintOpen, setHintOpen] = useState(false);
  const [solOpen, setSolOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState<string | null>(null);
  /* P3 — search + category filter + daily pick */
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<CatFilter>("All");
  const dailyId = useMemo(dailyProblemId, []);
  /* company surfacing — the user's target company highlights + filters its tagged problems */
  const { state } = useApp();
  const goal = getGoal();
  const goalCompanyId = state.ob.company && state.ob.company !== "general" ? state.ob.company : null;
  const goalCompany = goalCompanyId ? companyById(goalCompanyId) : null;
  const [companyFilter, setCompanyFilter] = useState<string | null>(goalCompanyId);
  /* difficulty-aware plan for the filtered company — one easy + one medium pick */
  const companyPlan = useMemo(
    () => (companyFilter ? companyInterviewPlan(companyFilter) : []),
    [companyFilter]
  );
  /* personalized focus — company heat blended with the user's misses + weak skills */
  const personalSignals = hasPersonalSignals();
  const focusRanks = useMemo(
    () => (companyFilter && personalSignals ? personalPlan(companyFilter) : []),
    [companyFilter, personalSignals]
  );
  /* frequency breakdown by difficulty + topic for the filtered company */
  const companyFreq = useMemo(
    () => (companyFilter ? companyFrequency(companyFilter) : null),
    [companyFilter]
  );
  const [online, setOnline] = useState(navigator.onLine);
  const theme = getTheme();

  const problem = useMemo(() => codingProblemById(problemId) ?? CODING_PROBLEMS[0], [problemId]);
  const isFn = problem.kind === "fn";
  const isUi = problem.kind === "ui";
  /* fn problems always edit JavaScript; the language picker is hidden for them */
  const effLang: LangId = isFn ? "javascript" : lang;
  const langMeta = RUNNER_LANGS.find(l => l.id === effLang)!;
  const proGated = isPaywallEnabled() && getTier() !== "pro";

  /* persist the current code per problem+language */
  useEffect(() => {
    const cache = loadCache();
    const entry = { ...(cache[problemId] ?? {}), [effLang]: code };
    storageSet(STORAGE_KEYS.code, { ...cache, [problemId]: entry });
  }, [code, problemId, effLang]);

  /* persist UI sources per problem */
  useEffect(() => {
    if (!isUi) return;
    const cache = loadUiCache();
    storageSet(STORAGE_KEYS.uiCode, { ...cache, [problemId]: uiSrc });
  }, [uiSrc, problemId, isUi]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  const pickProblem = (id: string) => {
    const p = codingProblemById(id);
    /* P4 gating — the UI bank is a Pro feature when the paywall is on */
    if (p?.kind === "ui" && proGated) {
      setShowUpgrade("🎨 UI component challenges are a Pro feature — build real components judged on the rendered DOM.");
      return;
    }
    if (p?.kind === "fn") setLang("javascript");
    setProblemId(id);
    setCode(cacheFor(id, p?.kind === "fn" ? "javascript" : lang) || starterFor(p ?? CODING_PROBLEMS[0], p?.kind === "fn" ? "javascript" : lang));
    if (p?.kind === "ui") {
      const cached = uiCacheFor(id);
      setUiSrc(cached ?? { html: p.html, css: p.css, js: p.js });
      setPreviewTick(t => t + 1);
    }
    setRunOut(null);
    setCases(null);
    setFnCases(null);
    setUiCases(null);
    setHintOpen(false);
    setSolOpen(false);
  };

  const pickLang = (l: LangId) => {
    setLang(l);
    const p = codingProblemById(problemId);
    setCode(cacheFor(problemId, l) || starterFor(p ?? CODING_PROBLEMS[0], l));
    setRunOut(null);
    setCases(null);
    setFnCases(null);
  };

  const runOnce = async () => {
    setBusy(true);
    setCases(null);
    setFnCases(null);
    setUiCases(null);
    try {
      if (problem.kind === "fn") {
        /* run the first visible test through the function judge */
        const results = await runFnTests(code, [problem.tests[0]], problem.fn.name);
        setFnCases(results);
        const r = results[0];
        if (r.pass) toast(`✅ ${r.label || "Test"} passed`);
        else if (r.error) toast("✗ " + r.error);
        else toast("✗ Test failed — check expected vs got");
      } else if (problem.kind === "ui") {
        setPreviewTick(t => t + 1);
        const results = await runUiTests(uiSrc.html, uiSrc.css, uiSrc.js, problem.assertions, problem.libs);
        setUiCases(results);
        const passed = results.filter(r => r.pass).length;
        toast(passed === results.length ? "✅ All checks passed" : `${passed}/${results.length} checks passed`);
      } else {
        const program = buildProgram(langMeta, code);
        const stdin = customIn || problem.tests[0]?.stdin || "";
        const r = langMeta.offline ? runLocalJavaScript(program, stdin) : await runCase(langMeta, program, stdin);
        setRunOut({ stdout: r.stdout, error: r.error, ok: r.ok });
        if (!r.ok && r.error) toast("✗ " + r.error);
      }
    } catch (e) {
      setRunOut({ stdout: "", error: (e as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const runAll = async () => {
    setBusy(true);
    setRunOut(null);
    setCases(null);
    setFnCases(null);
    setUiCases(null);
    try {
      if (problem.kind === "fn") {
        const suite = [...problem.tests, ...(problem.hidden ?? [])];
        const results = await runFnTests(code, suite, problem.fn.name);
        setFnCases(results);
        const passed = results.filter(r => r.pass).length;
        const solved = passed === suite.length;
        recordCodingAttempt(problem.id, solved);
        toast(solved
          ? `✅ Solved — all ${suite.length} tests passed (${problem.hidden?.length ?? 0} hidden)`
          : `${passed}/${suite.length} tests passed (${results.slice(problem.tests.length).filter(r => !r.pass).length} hidden failing)`);
      } else if (problem.kind === "ui") {
        setPreviewTick(t => t + 1);
        const suite = [...problem.assertions, ...(problem.hiddenAssertions ?? [])];
        const results = await runUiTests(uiSrc.html, uiSrc.css, uiSrc.js, suite, problem.libs);
        setUiCases(results);
        const passed = results.filter(r => r.pass).length;
        const solved = passed === suite.length;
        recordCodingAttempt(problem.id, solved);
        toast(solved
          ? `✅ Solved — all ${suite.length} checks passed (${problem.hiddenAssertions?.length ?? 0} hidden)`
          : `${passed}/${suite.length} checks passed (${results.slice(problem.assertions.length).filter(r => !r.pass).length} hidden failing)`);
      } else {
        const suite = [...problem.tests, ...(problem.hidden ?? [])];
        const program = buildProgram(langMeta, code);
        const results = await runTests(langMeta, program, suite);
        setCases(results);
        const passed = results.filter(r => r.pass).length;
        const solved = passed === suite.length;
        recordCodingAttempt(problem.id, solved);
        toast(solved
          ? `✅ Solved — all ${suite.length} tests passed (${problem.hidden?.length ?? 0} hidden)`
          : `${passed}/${suite.length} tests passed (${results.slice(problem.tests.length).filter(r => !r.pass).length} hidden failing)`);
      }
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Could not run"));
    } finally {
      setBusy(false);
    }
  };

  const resetCode = () => {
    if (isUi) {
      setUiSrc({ html: problem.html, css: problem.css, js: problem.js });
      setPreviewTick(t => t + 1);
    } else {
      setCode(starterFor(problem, effLang));
    }
    setRunOut(null);
    setCases(null);
    setFnCases(null);
    setUiCases(null);
    toast("↺ Starter restored");
  };

  const showHint = () => {
    if (proGated) { setShowUpgrade("💡 Hints are a Pro feature — unlock them to get a nudge without spoiling the solution."); return; }
    setHintOpen(o => !o);
  };

  const showSolution = () => {
    if (proGated) { setShowUpgrade("🔓 Full reference solutions are a Pro feature."); return; }
    setSolOpen(o => !o);
  };

  const uiSolutionText = problem.kind === "ui"
    ? `<!-- HTML -->\n${problem.reference.html}\n\n/* CSS */\n${problem.reference.css}\n\n// JS\n${problem.reference.js}`
    : "";

  /* Pro-gated solution for fn/cli problems (reference impl) */
  const refSolution = problem.kind === "ui" ? uiSolutionText : problem.reference;

  return (
    <div className="anim-view mx-auto max-w-[1080px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">💻 Code playground</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Solve it in <span className="grad-text">any language</span>.</h1>
        <p className="mx-auto mt-2 max-w-[600px] text-[14.5px] text-mut">
          Classic stdin/stdout problems in 6 languages · JavaScript function challenges (debounce, Promise.all, …) · and real UI components judged on the rendered DOM — all in your browser.
        </p>
      </div>

      {!online && (
        <div className="mx-auto mt-4 max-w-[560px] rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-center text-[12.5px] text-warn">
          You're offline — JavaScript, functions and UI components run locally; other languages need a connection.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* problem list */}
        <div className="space-y-2">
          <div className="rounded-2xl border border-line/10 bg-gradient-to-b from-panel to-panel2 p-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search problems…"
              className="editor-surface w-full rounded-xl px-3 py-2 text-[13px] placeholder:text-fnt"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {ALL_CATS.map(c => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${cat === c ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            {goalCompany && (
              <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-line/10 pt-2">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-fnt">Target:</span>
                <button
                  onClick={() => setCompanyFilter(null)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${companyFilter === null ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setCompanyFilter(goalCompany.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${companyFilter === goalCompany.id ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`}
                >
                  {goalCompany.icon} For {goalCompany.name}
                </button>
              </div>
            )}
          </div>
          {companyFilter && goalCompany && companyPlan.length > 0 && companyFreq && (
            <div className="rounded-2xl border border-acc1/30 bg-acc1/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-extrabold text-acctxt">🎯 Your {goalCompany.name} plan</div>
                <div className="rounded-full bg-acc1/15 px-2 py-0.5 text-[10.5px] font-bold text-acctxt">
                  {companyFreq.total} problems · 🔥{companyFreq.heat}
                </div>
              </div>
              {/* frequency by difficulty */}
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {([1, 2, 3] as const).map(d => (
                  <div key={d} className="rounded-lg border border-line/10 bg-deep/60 px-2 py-1.5">
                    <div className={`text-[10px] font-extrabold uppercase ${DIFF_COLOR[d]}`}>
                      {["Easy", "Medium", "Hard"][d - 1]}
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between">
                      <span className="text-[13px] font-extrabold text-ink">{companyFreq.byDifficulty[d].count}</span>
                      <span className="text-[10px] font-bold text-acctxt">🔥{companyFreq.byDifficulty[d].heat}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* frequency by topic — sorted by heat; hottest topic is the focus signal */}
              {companyFreq.byTopic.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-mut">By topic</div>
                  {companyFreq.byTopic.slice(0, 4).map(t => {
                    const max = companyFreq.byTopic[0].heat;
                    return (
                      <div key={t.topic} className="mt-1 flex items-center gap-2 text-[11px]">
                        <span className="w-[92px] shrink-0 truncate font-semibold text-ink">{t.topic}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-deep">
                          <div
                            className={`h-full rounded-full ${t.hottest && freqForProblem(companyFilter, t.hottest.id) >= 3 ? "grad-bg" : "bg-acc1/60"}`}
                            style={{ width: `${Math.max(10, Math.round((t.heat / max) * 100))}%` }}
                          />
                        </div>
                        <span className="w-3 text-right font-bold text-mut">{t.count}</span>
                        <span className="w-7 text-right font-bold text-acctxt">🔥{t.heat}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* focus picks — personalized (company heat + your gaps) or frequency-only */}
              <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-mut">
                {focusRanks.length ? "🎯 Your focus plan — personalized" : "🔥 Focus first"}
              </div>
              {!personalSignals && (
                <div className="mt-0.5 text-[10px] text-mut">Complete sessions and practice to personalize this.</div>
              )}
              <div className="mt-1 flex flex-col gap-1.5">
                {(focusRanks.length
                  ? focusRanks.map(r => ({ id: r.problem.id, title: r.problem.title, kind: r.problem.kind, difficulty: r.problem.difficulty, freq: r.freq, tag: r.misses >= 2 ? `missed ×${r.misses}` : r.misses === 1 ? "missed" : r.weakSrc === "skill" ? "weak skill" : r.weakSrc === "session" ? "missed in interviews" : r.weakSrc === "coach" ? "discussed with coach" : null }))
                  : companyPlan.map(p => ({ id: p.id, title: p.title, kind: p.kind, difficulty: p.difficulty, freq: freqForProblem(companyFilter, p.id), tag: null }))
                ).map(item => (
                  <button
                    key={item.id}
                    onClick={() => pickProblem(item.id)}
                    className="flex items-center gap-2 rounded-xl border border-line/10 bg-deep/60 px-3 py-2 text-left text-[12.5px] font-bold text-ink transition-all hover:border-acc1/40"
                  >
                    <span>{item.kind === "fn" ? "🧩" : "⚙️"}</span>
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.tag && (
                      <span className="rounded-full bg-warn/15 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-warn">🎯 {item.tag}</span>
                    )}
                    <span className="text-[10px] font-bold text-acctxt">🔥{item.freq}</span>
                    <span className={`text-[10.5px] font-extrabold uppercase ${DIFF_COLOR[item.difficulty]}`}>
                      {["Easy", "Medium", "Hard"][item.difficulty - 1]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {CODING_PROBLEMS.filter(p =>
            (cat === "All" || catOf(p) === cat) &&
            (!companyFilter || problemIsForCompany(p, companyFilter)) &&
            p.title.toLowerCase().includes(search.trim().toLowerCase())
          ).map(p => (
            <button
              key={p.id}
              onClick={() => pickProblem(p.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${p.id === problemId ? "grad-bg-soft border-acc1/40" : "border-line/10 bg-gradient-to-b from-panel to-panel2 hover:border-acc1/30"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`flex items-center gap-1.5 text-[13.5px] font-bold ${p.id === problemId ? "text-acctxt" : "text-ink"}`}>
                  <span className="text-[11px]">{p.kind === "fn" ? "🧩" : p.kind === "ui" ? "🎨" : "⚙️"}</span>
                  {p.title}
                  {p.id === dailyId && <span className="rounded-full bg-acc2/15 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-acc2">🎯 Daily</span>}
                </span>
                <span className="flex items-center gap-1">
                  {goalCompany && problemIsForCompany(p, goalCompany.id) && (
                    <span className="text-[10px]" title={`Asked at ${goalCompany.name}`}>{goalCompany.icon}</span>
                  )}
                  <span className={`text-[11px] font-extrabold uppercase ${DIFF_COLOR[p.difficulty]}`}>
                    {["Easy", "Medium", "Hard"][p.difficulty - 1]}
                  </span>
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <Difficulty level={p.difficulty} />
                <span className="text-[10px] uppercase tracking-wide text-fnt">
                  {p.kind === "ui" && proGated ? "🎨 UI · 🔒 Pro" : catOf(p)}
                </span>
              </div>
            </button>
          ))}
          <p className="px-1 pt-1 text-[11.5px] leading-relaxed text-fnt">
            {CODING_PROBLEMS.length} problems · ⚙️ compile on the free Wandbox API · 🧩 functions run locally in your browser · 🎨 UI components are judged on the rendered DOM, fully offline{goalCompany ? ` · problems tagged ${goalCompany.icon} are asked at ${goalCompany.name}` : ""}.
          </p>
        </div>

        {/* editor */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line/10 bg-wht/5 px-4 py-3">
            <span className="text-[14.5px] font-extrabold">{problem.title}</span>
            <span className={`text-[11px] font-extrabold uppercase ${DIFF_COLOR[problem.difficulty]}`}>{["Easy", "Medium", "Hard"][problem.difficulty - 1]}</span>
            {!isFn && problem.kind !== "cli" && <Chip tone="acc">{problem.category}</Chip>}
            {isFn && <Chip tone="acc">{problem.category}</Chip>}
            <span className="flex-1" />
            {isFn || isUi ? (
              <span className="text-[12px] text-mut">
                {isUi ? (problem.libs?.length ? `${problem.libs[0].global} · ${problem.libs.length > 1 ? problem.libs[1].global : ""} — loads in the sandbox` : "HTML · CSS · JS — judged in your browser") : "JavaScript · runs in your browser"}
              </span>
            ) : (
              <Seg
                options={RUNNER_LANGS.map(l => ({ value: l.id, label: l.label }))}
                value={lang}
                onChange={v => pickLang(v as LangId)}
              />
            )}
          </div>

          <div className="border-b border-line/10 px-4 py-3">
            <p className="text-[13.5px] leading-relaxed text-ink">{problem.prompt}</p>
            {isFn ? (
              <p className="mt-1.5 font-mono text-[12.5px] text-acc1">
                function {problem.fn.name}({problem.fn.args}) → {problem.fn.returns}
              </p>
            ) : isUi ? (
              <p className="mt-1.5 text-[12.5px] text-mut">🎯 The judge clicks, types and reads the rendered DOM — visible checks below, hidden ones after.</p>
            ) : (
              <p className="mt-1.5 text-[12.5px] text-mut">📐 {problem.io}</p>
            )}
          </div>

          <div className="p-4">
            {isUi ? (
              <div className="space-y-3">
                <Seg
                  options={UI_PANELS.map(p => ({ value: p.id, label: p.label }))}
                  value={uiPanel}
                  onChange={v => setUiPanel(v as UiPanel)}
                />
                <CodeEditor
                  value={uiSrc[uiPanel]}
                  onChange={v => setUiSrc(s => ({ ...s, [uiPanel]: v }))}
                  lang={uiPanel === "js" ? "javascript" : uiPanel}
                  theme={theme}
                  className="cm-host"
                />
              </div>
            ) : (
              <CodeEditor
                value={code}
                onChange={setCode}
                lang={effLang}
                theme={theme}
                className="cm-host"
              />
            )}
          </div>

          {/* live preview — UI mode only */}
          {isUi && (
            <div className="border-t border-line/10 px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-mut">Live preview</span>
                <button className={btnGhost + btnSm} onClick={() => setPreviewTick(t => t + 1)}>↻ Refresh</button>
              </div>
              <iframe
                key={previewTick}
                title="ui-preview"
                sandbox="allow-scripts"
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8">${(problem.libs ?? []).map(l => `<script src="${l.url}"><\/script>`).join("")}<style>${uiSrc.css}</style></head><body>${uiSrc.html}<script>${uiSrc.js.replace(/<\/script>/gi, "<\\/script>")}</script></body></html>`}
                className="h-[240px] w-full rounded-xl border border-line/10 bg-white"
              />
            </div>
          )}

          {/* hints + solution (Pro-gated) */}
          {(problem.hint || problem.reference) && (
            <div className="border-t border-line/10 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {problem.hint && (
                  <button className={btnGhost + btnSm} onClick={showHint}>
                    {proGated ? "💡 Hint · 🔒" : hintOpen ? "🙈 Hide hint" : "💡 Hint"}
                  </button>
                )}
                {(problem.reference || problem.kind === "ui") && (
                  <button className={btnGhost + btnSm} onClick={showSolution}>
                    {proGated ? "🔓 Solution · 🔒" : solOpen ? "🙈 Hide solution" : "🔓 Solution"}
                  </button>
                )}
              </div>
              {hintOpen && problem.hint && (
                <div className="mt-2 rounded-xl border border-acc1/30 bg-acc1/10 px-3 py-2 text-[13px] leading-relaxed text-ink">
                  💡 {problem.hint}
                </div>
              )}
              {solOpen && refSolution && (
                <pre className="mt-2 max-h-[280px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/10 bg-deep p-3 font-mono text-[12px] leading-relaxed text-ink">
                  {refSolution}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line/10 bg-wht/5 px-4 py-3">
            <button className={btnPrimary + btnSm} onClick={runOnce} disabled={busy}>
              {busy ? <><span className="spinner" />Running…</> : "▶ Run"}
            </button>
            <button className={btnGhost + btnSm} onClick={runAll} disabled={busy}>
              {busy ? <><span className="spinner" />Testing…</> : isUi ? `✓ Check (${problem.assertions.length + (problem.hiddenAssertions?.length ?? 0)})` : `✓ Test (${problem.tests.length + (problem.hidden?.length ?? 0)})`}
            </button>
            {((fnCases && fnCases.every(c => c.pass)) || (cases && cases.every(c => c.pass)) || (uiCases && uiCases.every(c => c.pass))) && <Chip tone="ok">✅ Solved</Chip>}
            <button className={btnGhost + btnSm} onClick={resetCode}>↺ Reset</button>
            <span className="hidden flex-1 text-right text-[11.5px] text-fnt sm:inline">
              {isUi
                ? "judged on the DOM · Tab indents · Ctrl/Cmd+Space completes"
                : isFn
                  ? "judged locally · Tab indents · Ctrl/Cmd+Space completes"
                  : `${langMeta.offline ? "runs locally in your browser" : `compiles on ${langMeta.compiler}`} · Tab indents · Ctrl/Cmd+Space completes`}
            </span>
          </div>

          {/* custom input — CLI mode only */}
          {!isFn && !isUi && (
            <div className="px-4 pb-2">
              <label className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-mut">Custom input (optional)</label>
              <textarea
                value={customIn}
                onChange={e => setCustomIn(e.target.value)}
                rows={2}
                spellCheck={false}
                placeholder="Feed stdin here — defaults to the first test case"
                className="editor-surface w-full resize-y p-3 text-[12.5px] placeholder:text-fnt"
              />
            </div>
          )}

          {/* output — CLI mode */}
          {((runOut || cases) && !isFn && !isUi) && (
            <div className="border-t border-line/10 px-4 py-3">
              {cases ? (
                <div className="space-y-2">
                  {cases.slice(0, problem.tests.length).map((c, i) => (
                    <div key={i} className={`rounded-xl border px-3 py-2 text-[12.5px] ${c.pass ? "border-ok/30 bg-ok/10" : "border-bad/30 bg-bad/10"}`}>
                      <div className="mb-1 font-bold">{c.pass ? "✅ Pass" : "❌ Fail"} — case {i + 1}</div>
                      {!c.pass && (
                        <div className="space-y-0.5 font-mono leading-relaxed">
                          <div className="text-mut">stdin: <span className="text-ink">{JSON.stringify(c.stdin)}</span></div>
                          <div className="text-mut">expected: <span className="text-ink">{JSON.stringify(c.expect)}</span></div>
                          <div className="text-mut">got: <span className={c.error ? "text-bad" : "text-ink"}>{JSON.stringify(c.got)}</span></div>
                        </div>
                      )}
                    </div>
                  ))}
                  {(problem.hidden?.length ?? 0) > 0 && (
                    <div className={`rounded-xl border px-3 py-2 text-[12.5px] ${cases.slice(problem.tests.length).every(c => c.pass) ? "border-ok/30 bg-ok/10" : "border-bad/30 bg-bad/10"}`}>
                      <div className="mb-1 font-bold">
                        🧪 Hidden: {cases.slice(problem.tests.length).filter(c => c.pass).length}/{problem.hidden!.length} passed
                      </div>
                      {!cases.slice(problem.tests.length).every(c => c.pass) && (
                        <div className="text-mut">The hidden judge cases caught something — find the edge case before calling it solved.</div>
                      )}
                    </div>
                  )}
                  <div className="pt-1 text-[13px] font-extrabold">
                    {cases.filter(c => c.pass).length}/{cases.length} passing
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-line/10 bg-deep p-3 font-mono text-[12.5px] leading-relaxed">
                  {runOut!.error ? (
                    <div className="text-bad">{runOut!.error}</div>
                  ) : runOut!.stdout ? (
                    <pre className="whitespace-pre-wrap text-ink">{runOut!.stdout}</pre>
                  ) : (
                    <div className="text-fnt">(no output)</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* output — function mode */}
          {(isFn && fnCases) && (
            <div className="border-t border-line/10 px-4 py-3">
              <div className="space-y-2">
                {fnCases.slice(0, problem.tests.length).map((c, i) => (
                  <div key={i} className={`rounded-xl border px-3 py-2 text-[12.5px] ${c.pass ? "border-ok/30 bg-ok/10" : "border-bad/30 bg-bad/10"}`}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-bold">{c.pass ? "✅ Pass" : "❌ Fail"} — {c.label || `case ${i + 1}`}</span>
                      {c.ms > 0 && <span className="text-[11px] text-fnt">{c.ms}ms</span>}
                    </div>
                    {!c.pass && (
                      <div className="space-y-0.5 font-mono leading-relaxed">
                        {c.args.length > 0 && <div className="text-mut">args: <span className="text-ink">{fmt(c.args)}</span></div>}
                        <div className="text-mut">expected: <span className="text-ink">{fmt(c.expect)}</span></div>
                        <div className="text-mut">got: <span className={c.error ? "text-bad" : "text-ink"}>{c.error ?? fmt(c.got)}</span></div>
                      </div>
                    )}
                  </div>
                ))}
                {(problem.hidden?.length ?? 0) > 0 && (
                  <div className={`rounded-xl border px-3 py-2 text-[12.5px] ${fnCases.slice(problem.tests.length).every(c => c.pass) ? "border-ok/30 bg-ok/10" : "border-bad/30 bg-bad/10"}`}>
                    <div className="mb-1 font-bold">
                      🧪 Hidden: {fnCases.slice(problem.tests.length).filter(c => c.pass).length}/{problem.hidden!.length} passed
                    </div>
                    {!fnCases.slice(problem.tests.length).every(c => c.pass) && (
                      <div className="text-mut">The hidden judge cases caught something — find the edge case before calling it solved.</div>
                    )}
                  </div>
                )}
                <div className="pt-1 text-[13px] font-extrabold">
                  {fnCases.filter(c => c.pass).length}/{fnCases.length} passing
                </div>
              </div>
            </div>
          )}

          {/* output — UI mode checklist */}
          {(isUi && uiCases) && (
            <div className="border-t border-line/10 px-4 py-3">
              <div className="space-y-2">
                {uiCases.slice(0, problem.assertions.length).map((c, i) => (
                  <div key={i} className={`rounded-xl border px-3 py-2 text-[12.5px] ${c.pass ? "border-ok/30 bg-ok/10" : "border-bad/30 bg-bad/10"}`}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-bold">{c.pass ? "✅ Pass" : "❌ Fail"} — {c.label || `check ${i + 1}`}</span>
                      {c.ms > 0 && <span className="text-[11px] text-fnt">{c.ms}ms</span>}
                    </div>
                    {!c.pass && c.error && (
                      <div className="font-mono text-bad">{c.error}</div>
                    )}
                  </div>
                ))}
                {(problem.hiddenAssertions?.length ?? 0) > 0 && (
                  <div className={`rounded-xl border px-3 py-2 text-[12.5px] ${uiCases.slice(problem.assertions.length).every(c => c.pass) ? "border-ok/30 bg-ok/10" : "border-bad/30 bg-bad/10"}`}>
                    <div className="mb-1 font-bold">
                      🧪 Hidden: {uiCases.slice(problem.assertions.length).filter(c => c.pass).length}/{problem.hiddenAssertions!.length} passed
                    </div>
                    {!uiCases.slice(problem.assertions.length).every(c => c.pass) && (
                      <div className="text-mut">The hidden checks caught something — an edge case your component misses.</div>
                    )}
                  </div>
                )}
                <div className="pt-1 text-[13px] font-extrabold">
                  {uiCases.filter(c => c.pass).length}/{uiCases.length} passing
                </div>
              </div>
            </div>
          )}

          {/* AI coach — discuss your approach on this problem mid-solve */}
          <div className="border-t border-line/10">
            <CoachChat
              prompt={isFn ? `${problem.prompt}\n\nImplement: ${problem.fn.name}(${problem.fn.args}) → ${problem.fn.returns}` : problem.prompt}
              answer={refSolution ?? problem.hint ?? ""}
              kp={[
                `Category: ${catOf(problem)}`,
                `Difficulty: ${["Easy", "Medium", "Hard"][problem.difficulty - 1]}`,
                "Hidden tests — verify edge cases before calling it solved",
                "Analyze time and space complexity"
              ]}
              fieldId={goal?.fieldId ?? null}
              levelId={problem.difficulty === 1 ? "junior" : problem.difficulty === 2 ? "mid" : "senior"}
            />
          </div>
        </div>
      </div>

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(null)} reason={showUpgrade} />
      )}
    </div>
  );
}

/* ---------- CodeMirror editor ---------- */
/* Real IDE experience: syntax highlighting, bracket matching, auto-closing
   brackets, line numbers and Ctrl/Cmd+Space autocomplete (language-aware for
   JS/TS/Python, word-based for C++/Java/Go, HTML/CSS aware for UI mode).
   Recreates when the language or app theme changes; external value updates
   (reset / language switch) are pushed in without clobbering the cursor. */

function CodeEditor({ value, onChange, lang, theme, className }: {
  value: string;
  onChange: (v: string) => void;
  lang: LangId | UiPanel;
  theme: Theme;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /* create (or recreate) the editor when the language or theme changes */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ext = lang === "html" ? htmlLang() : lang === "css" ? cssLang() : LANG_EXT[lang as LangId]();
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          ext,
          theme === "dark" ? oneDark : [],
          EditorView.updateListener.of(u => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          })
        ]
      })
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, theme]);

  /* push external value changes (reset, language switch) into the editor */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className={className} />;
}
