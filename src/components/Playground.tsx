import { useEffect, useMemo, useRef, useState } from "react";
import { CODING_PROBLEMS, RUNNER_LANGS, codingProblemById, type CodingProblem, type LangId } from "../data/coding";
import { buildProgram, runCase, runLocalJavaScript, runTests } from "../services/runner";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Difficulty, Seg } from "./ui";

type CodeCache = Record<string, Partial<Record<LangId, string>>>;

const loadCache = (): CodeCache => storageGet<CodeCache>(STORAGE_KEYS.code, {});
const cacheFor = (id: string, lang: LangId): string => loadCache()[id]?.[lang] ?? "";

const DIFF_COLOR: Record<number, string> = { 1: "text-ok", 2: "text-warn", 3: "text-bad" };

export function Playground() {
  const [problemId, setProblemId] = useState(CODING_PROBLEMS[0].id);
  const [lang, setLang] = useState<LangId>("python");
  const [code, setCode] = useState(() => cacheFor(CODING_PROBLEMS[0].id, "python"));
  const [customIn, setCustomIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [runOut, setRunOut] = useState<{ stdout: string; error?: string; ok: boolean } | null>(null);
  const [cases, setCases] = useState<{ pass: boolean; stdin: string; expect: string; got: string; error?: string }[] | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

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
    setCode(cached || problemById(id)?.starters[lang] || "");
    setRunOut(null);
    setCases(null);
  };

  const pickLang = (l: LangId) => {
    setLang(l);
    const cached = cacheFor(problemId, l);
    setCode(cached || problemById(problemId)?.starters[l] || "");
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
    setBusy(true);
    setRunOut(null);
    try {
      const results = await runTests(langMeta, program, problem.tests);
      setCases(results);
      const passed = results.filter(r => r.pass).length;
      toast(passed === results.length ? `✅ All ${results.length} tests passed` : `${passed}/${results.length} tests passed`);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Could not run"));
    } finally {
      setBusy(false);
    }
  };

  const resetCode = () => {
    setCode(problemById(problemId)?.starters[lang] || "");
    setRunOut(null);
    setCases(null);
    toast("↺ Starter restored");
  };

  const insertTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = e.currentTarget;
    const { selectionStart, selectionEnd, value } = ta;
    const next = value.slice(0, selectionStart) + "  " + value.slice(selectionEnd);
    setCode(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = selectionStart + 2;
    });
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
            <textarea
              ref={taRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={insertTab}
              spellCheck={false}
              rows={18}
              placeholder="// write your solution here"
              className="editor-surface w-full resize-y p-4 text-[13px] leading-relaxed placeholder:text-fnt"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line/10 bg-wht/5 px-4 py-3">
            <button className={btnPrimary + btnSm} onClick={runOnce} disabled={busy}>
              {busy ? <><span className="spinner" />Running…</> : "▶ Run"}
            </button>
            <button className={btnGhost + btnSm} onClick={runAll} disabled={busy}>
              {busy ? <><span className="spinner" />Testing…</> : `✓ Test (${problem.tests.length})`}
            </button>
            <button className={btnGhost + btnSm} onClick={resetCode}>↺ Reset</button>
            <span className="flex-1" />
            {!langMeta.offline && (
              <span className="hidden text-[11.5px] text-fnt sm:inline">compiles on {langMeta.compiler}</span>
            )}
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
                  {cases.map((c, i) => (
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

function problemById(id: string): CodingProblem | undefined {
  return CODING_PROBLEMS.find(p => p.id === id);
}
