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
import { CODING_PROBLEMS, RUNNER_LANGS, codingProblemById, type LangId } from "../data/coding";
import { buildProgram, runCase, runLocalJavaScript, runTests } from "../services/runner";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import { getTheme, type Theme } from "../services/theme";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip, Difficulty, Seg } from "./ui";

type CodeCache = Record<string, Partial<Record<LangId, string>>>;

const loadCache = (): CodeCache => storageGet<CodeCache>(STORAGE_KEYS.code, {});
const cacheFor = (id: string, lang: LangId): string => loadCache()[id]?.[lang] ?? "";

const DIFF_COLOR: Record<number, string> = { 1: "text-ok", 2: "text-warn", 3: "text-bad" };

/* Language → CodeMirror grammar (TS builds on the JS grammar with types). */
const LANG_EXT: Record<LangId, () => Extension> = {
  python: () => python(),
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  cpp: () => cpp(),
  java: () => java(),
  go: () => go()
};

export function Playground() {
  const [problemId, setProblemId] = useState(CODING_PROBLEMS[0].id);
  const [lang, setLang] = useState<LangId>("python");
  const [code, setCode] = useState(() => cacheFor(CODING_PROBLEMS[0].id, "python"));
  const [customIn, setCustomIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [runOut, setRunOut] = useState<{ stdout: string; error?: string; ok: boolean } | null>(null);
  const [cases, setCases] = useState<{ pass: boolean; stdin: string; expect: string; got: string; error?: string }[] | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const theme = getTheme();

  const problem = useMemo(() => codingProblemById(problemId) ?? CODING_PROBLEMS[0], [problemId]);
  const langMeta = RUNNER_LANGS.find(l => l.id === lang)!;

  /* persist the current code per problem+language */
  useEffect(() => {
    const cache = loadCache();
    const entry = { ...(cache[problemId] ?? {}), [lang]: code };
    storageSet(STORAGE_KEYS.code, { ...cache, [problemId]: entry });
  }, [code, problemId, lang]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  const pickProblem = (id: string) => {
    setProblemId(id);
    const cached = cacheFor(id, lang);
    setCode(cached || codingProblemById(id)?.starters[lang] || "");
    setRunOut(null);
    setCases(null);
  };

  const pickLang = (l: LangId) => {
    setLang(l);
    const cached = cacheFor(problemId, l);
    setCode(cached || codingProblemById(problemId)?.starters[l] || "");
    setRunOut(null);
    setCases(null);
  };

  const runOnce = async () => {
    const program = buildProgram(langMeta, code);
    setBusy(true);
    setCases(null);
    try {
      const stdin = customIn || problem.tests[0]?.stdin || "";
      const r = langMeta.offline ? runLocalJavaScript(program, stdin) : await runCase(langMeta, program, stdin);
      setRunOut({ stdout: r.stdout, error: r.error, ok: r.ok });
      if (!r.ok && r.error) toast("✗ " + r.error);
    } catch (e) {
      setRunOut({ stdout: "", error: (e as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const runAll = async () => {
    const program = buildProgram(langMeta, code);
    const suite = [...problem.tests, ...(problem.hidden ?? [])];
    setBusy(true);
    setRunOut(null);
    try {
      const results = await runTests(langMeta, program, suite);
      setCases(results);
      const passed = results.filter(r => r.pass).length;
      const solved = passed === suite.length;
      toast(solved
        ? `✅ Solved — all ${suite.length} tests passed (${problem.hidden?.length ?? 0} hidden)`
        : `${passed}/${suite.length} tests passed (${results.slice(problem.tests.length).filter(r => !r.pass).length} hidden failing)`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Could not run"));
    } finally {
      setBusy(false);
    }
  };

  const resetCode = () => {
    setCode(codingProblemById(problemId)?.starters[lang] || "");
    setRunOut(null);
    setCases(null);
    toast("↺ Starter restored");
  };

  return (
    <div className="anim-view mx-auto max-w-[1080px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">💻 Code playground</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Solve it in <span className="grad-text">any language</span>.</h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">
          Classic coding problems with real compilers — Python, JavaScript, TypeScript, C++, Java, Go. JavaScript also runs in your browser, fully offline.
        </p>
      </div>

      {!online && (
        <div className="mx-auto mt-4 max-w-[560px] rounded-xl border border-warn/30 bg-warn/10 px-4 py-2.5 text-center text-[12.5px] text-warn">
          You're offline — JavaScript runs locally; other languages need a connection.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* problem list */}
        <div className="space-y-2">
          {CODING_PROBLEMS.map(p => (
            <button
              key={p.id}
              onClick={() => pickProblem(p.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${p.id === problemId ? "grad-bg-soft border-acc1/40" : "border-line/10 bg-gradient-to-b from-panel to-panel2 hover:border-acc1/30"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[13.5px] font-bold ${p.id === problemId ? "text-acctxt" : "text-ink"}`}>{p.title}</span>
                <span className={`text-[11px] font-extrabold uppercase ${DIFF_COLOR[p.difficulty]}`}>
                  {["Easy", "Medium", "Hard"][p.difficulty - 1]}
                </span>
              </div>
              <Difficulty level={p.difficulty} />
            </button>
          ))}
          <p className="px-1 pt-1 text-[11.5px] leading-relaxed text-fnt">
            Powered by the free Wandbox API · your code is kept per-device and never leaves your browser except to compile.
          </p>
        </div>

        {/* editor */}
        <div className={`${cardCls} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line/10 bg-wht/5 px-4 py-3">
            <span className="text-[14.5px] font-extrabold">{problem.title}</span>
            <span className={`text-[11px] font-extrabold uppercase ${DIFF_COLOR[problem.difficulty]}`}>{["Easy", "Medium", "Hard"][problem.difficulty - 1]}</span>
            <span className="flex-1" />
            <Seg
              options={RUNNER_LANGS.map(l => ({ value: l.id, label: l.label }))}
              value={lang}
              onChange={v => pickLang(v as LangId)}
            />
          </div>

          <div className="border-b border-line/10 px-4 py-3">
            <p className="text-[13.5px] leading-relaxed text-ink">{problem.prompt}</p>
            <p className="mt-1.5 text-[12.5px] text-mut">📐 {problem.io}</p>
          </div>

          <div className="p-4">
            <CodeEditor
              value={code}
              onChange={setCode}
              lang={lang}
              theme={theme}
              className="cm-host"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line/10 bg-wht/5 px-4 py-3">
            <button className={btnPrimary + btnSm} onClick={runOnce} disabled={busy}>
              {busy ? <><span className="spinner" />Running…</> : "▶ Run"}
            </button>
            <button className={btnGhost + btnSm} onClick={runAll} disabled={busy}>
              {busy ? <><span className="spinner" />Testing…</> : `✓ Test (${problem.tests.length + (problem.hidden?.length ?? 0)})`}
            </button>
            {(cases && cases.every(c => c.pass)) && <Chip tone="ok">✅ Solved</Chip>}
            <button className={btnGhost + btnSm} onClick={resetCode}>↺ Reset</button>
            <span className="hidden flex-1 text-right text-[11.5px] text-fnt sm:inline">
              {langMeta.offline ? "runs locally in your browser" : `compiles on ${langMeta.compiler}`} · Tab indents · Ctrl/Cmd+Space completes
            </span>
          </div>

          {/* custom input */}
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

          {/* output */}
          {(runOut || cases) && (
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
        </div>
      </div>
    </div>
  );
}

/* ---------- CodeMirror editor ---------- */
/* Real IDE experience: syntax highlighting, bracket matching, auto-closing
   brackets, line numbers and Ctrl/Cmd+Space autocomplete (language-aware for
   JS/TS/Python, word-based for C++/Java/Go). Recreates when the language or
   app theme changes; external value updates (reset / language switch) are
   pushed in without clobbering the user's cursor while typing. */

function CodeEditor({ value, onChange, lang, theme, className }: {
  value: string;
  onChange: (v: string) => void;
  lang: LangId;
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
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          LANG_EXT[lang](),
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
