import {useEffect, useMemo, useState} from "react";

import {type Extension} from "@codemirror/state";

import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { go } from "@codemirror/lang-go";
import { html as htmlLang } from "@codemirror/lang-html"
import { css as cssLang } from "@codemirror/lang-css"
import { CODING_PROBLEMS, RUNNER_LANGS, codingProblemById, type CodingProblem, type LangId } from "../data/coding";
import { PATTERN_LABELS } from "../data/patterns";
import { companyById } from "../data";
import {companyFrequency, companyInterviewPlan, hasPersonalSignals, personalPlan} from "../data/codingCompanies";
import { useApp } from "../store";
import { buildProgram, runCase, runFnTests, runLocalJavaScript, runTests, runUiTests, type FnCaseResult, type UiCaseResult } from "../services/runner";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import {getTheme} from "../services/theme";
import { getTier, isPaywallEnabled } from "../services/entitlements";
import { recordCodingAttempt } from "../services/codingTrack";
import { getGoal } from "../services/goal";
import { toast } from "../toast";
import {btnGhost, btnPrimary, btnSm, cardCls, Chip, Seg} from "./ui";
import { UpgradeModal } from "./Upgrade";
import { CodeEditor } from "./playground/CodeEditor";
import { ProblemList } from "./playground/ProblemList";
import { OutputPanel } from "./playground/OutputPanel";
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
const _fmt = (v: unknown): string => {
  if (typeof v === "function") return `ƒ ${v.name || "anonymous"}`;
  if (v === undefined) return "undefined";
  if (typeof v === "number" && Number.isNaN(v)) return "NaN";
  if (v instanceof Date) return v.toISOString();
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
};

/* Language → CodeMirror grammar (TS builds on the JS grammar with types). */
const _LANG_EXT: Record<LangId, () => Extension> = {
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
  /* P4 — pattern filter (visible once the AI bank ships problems with patterns) */
  const [patternFilter, setPatternFilter] = useState<string | null>(null);
  const patternCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of CODING_PROBLEMS) if (p.kind === "cli" && p.pattern) m.set(p.pattern, (m.get(p.pattern) ?? 0) + 1);
    return m;
  }, []);
  const dailyId = useMemo(dailyProblemId, []);
  /* company surfacing — the user's target company highlights + filters its tagged problems */
  const { state } = useApp();
  const goal = getGoal();
  const goalCompanyId = state.ob.company && state.ob.company !== "general" ? state.ob.company : null;
  const goalCompany = goalCompanyId ? companyById(goalCompanyId) : null;
  const [companyFilter, setCompanyFilter] = useState<string | null>(goalCompanyId);
  /* difficulty-aware plan for the filtered company — one easy + one medium pick */
  const _companyPlan = useMemo(
    () => (companyFilter ? companyInterviewPlan(companyFilter) : []),
    [companyFilter]
  );
  /* personalized focus — company heat blended with the user's misses + weak skills */
  const personalSignals = hasPersonalSignals();
  const _focusRanks = useMemo(
    () => (companyFilter && personalSignals ? personalPlan(companyFilter) : []),
    [companyFilter, personalSignals]
  );
  /* frequency breakdown by difficulty + topic for the filtered company */
  const _companyFreq = useMemo(
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

  /* jump to a problem suggested by the AI coach from another screen */
  useEffect(() => {
    const f = storageGet<string | null>(STORAGE_KEYS.playgroundFocus, null);
    if (f) {
      storageSet(STORAGE_KEYS.playgroundFocus, null);
      pickProblem(f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <ProblemList
          search={search} setSearch={setSearch}
          cat={cat} setCat={setCat}
          patternFilter={patternFilter} setPatternFilter={setPatternFilter}
          patternCounts={patternCounts}
          companyFilter={companyFilter} setCompanyFilter={setCompanyFilter}
          goalCompany={goalCompany ? { id: goalCompany.id, name: goalCompany.name, icon: goalCompany.icon } : null}
          dailyId={dailyId} problemId={problemId} pickProblem={pickProblem} proGated={proGated}
        />
        {/* editor */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line/10 bg-wht/5 px-4 py-3">
            <span className="text-[14.5px] font-extrabold">{problem.title}</span>
            <span className={`text-[11px] font-extrabold uppercase ${DIFF_COLOR[problem.difficulty]}`}>{["Easy", "Medium", "Hard"][problem.difficulty - 1]}</span>
            {problem.kind === "cli" && problem.pattern && <Chip tone="acc">{PATTERN_LABELS[problem.pattern] ?? problem.pattern}</Chip>}
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

          <OutputPanel
            isFn={isFn}
            isUi={isUi}
            customIn={customIn}
            setCustomIn={setCustomIn}
            runOut={runOut}
            cases={cases}
            fnCases={fnCases}
            uiCases={uiCases}
            testCount={"tests" in problem ? problem.tests.length : 0}
            hiddenCount={"hidden" in problem ? (problem.hidden?.length ?? 0) : 0}
            assertionCount={"assertions" in problem ? problem.assertions.length : 0}
            hiddenAssertionCount={"hiddenAssertions" in problem ? (problem.hiddenAssertions?.length ?? 0) : 0}
          />
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
              companyId={goalCompanyId}
              onPractice={pickProblem}
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
