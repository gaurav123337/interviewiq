import { memo } from "react";
/* OutputPanel — unified output for CLI, function, and UI modes. */

import type { FnCaseResult, UiCaseResult } from "../../services/runner";

/* Compact value formatting for fn-mode results table. */
const fmt = (v: unknown): string => {
  if (typeof v === "function") return `ƒ ${v.name || "anonymous"}`;
  if (v === undefined) return "undefined";
  if (typeof v === "number" && Number.isNaN(v)) return "NaN";
  if (v instanceof Date) return v.toISOString();
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
};

/* ---- CLI output ---- */
function CliOutput({ cases, runOut, testCount, hiddenCount }: {
  cases: { pass: boolean; stdin: string; expect: string; got: string; error?: string }[] | null;
  runOut: { stdout: string; error?: string; ok: boolean } | null;
  testCount: number;
  hiddenCount: number;
}) {
  if (!cases && !runOut) return null;
  return (
    <div className="border-t border-line/10 px-4 py-3">
      {cases ? (
        <div className="space-y-2">
          {cases.slice(0, testCount).map((c, i) => (
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
          {hiddenCount > 0 && (
            <div className={`rounded-xl border px-3 py-2 text-[12.5px] ${cases.slice(testCount).every(c => c.pass) ? "border-ok/30 bg-ok/10" : "border-bad/30 bg-bad/10"}`}>
              <div className="mb-1 font-bold">
                🧪 Hidden: {cases.slice(testCount).filter(c => c.pass).length}/{hiddenCount} passed
              </div>
              {!cases.slice(testCount).every(c => c.pass) && (
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
  );
}

/* ---- Function output ---- */
function FnOutput({ fnCases, testCount, hiddenCount }: { fnCases: FnCaseResult[]; testCount: number; hiddenCount: number }) {
  return (
    <div className="border-t border-line/10 px-4 py-3">
      <div className="space-y-2">
        {fnCases.slice(0, testCount).map((c, i) => (
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
        {hiddenCount > 0 && (
          <div className={`rounded-xl border px-3 py-2 text-[12.5px] ${fnCases.slice(testCount).every(c => c.pass) ? "border-ok/30 bg-ok/10" : "border-bad/30 bg-bad/10"}`}>
            <div className="mb-1 font-bold">
              🧪 Hidden: {fnCases.slice(testCount).filter(c => c.pass).length}/{hiddenCount} passed
            </div>
            {!fnCases.slice(testCount).every(c => c.pass) && (
              <div className="text-mut">The hidden judge cases caught something — find the edge case before calling it solved.</div>
            )}
          </div>
        )}
        <div className="pt-1 text-[13px] font-extrabold">
          {fnCases.filter(c => c.pass).length}/{fnCases.length} passing
        </div>
      </div>
    </div>
  );
}

/* ---- UI output ---- */
function UiOutput({ uiCases, assertionCount, hiddenAssertionCount }: { uiCases: UiCaseResult[]; assertionCount: number; hiddenAssertionCount: number }) {
  return (
    <div className="border-t border-line/10 px-4 py-3">
      <div className="space-y-2">
        {uiCases.slice(0, assertionCount).map((c, i) => (
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
        {hiddenAssertionCount > 0 && (
          <div className={`rounded-xl border px-3 py-2 text-[12.5px] ${uiCases.slice(assertionCount).every(c => c.pass) ? "border-ok/30 bg-ok/10" : "border-bad/30 bg-bad/10"}`}>
            <div className="mb-1 font-bold">
              🧪 Hidden: {uiCases.slice(assertionCount).filter(c => c.pass).length}/{hiddenAssertionCount} passed
            </div>
            {!uiCases.slice(assertionCount).every(c => c.pass) && (
              <div className="text-mut">The hidden checks caught something — an edge case your component misses.</div>
            )}
          </div>
        )}
        <div className="pt-1 text-[13px] font-extrabold">
          {uiCases.filter(c => c.pass).length}/{uiCases.length} passing
        </div>
      </div>
    </div>
  );
}

/* ---- Custom input ---- */
function CustomInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-4 pb-2">
      <label className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-mut">Custom input (optional)</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        spellCheck={false}
        placeholder="Feed stdin here — defaults to the first test case"
        className="editor-surface w-full resize-y p-3 text-[12.5px] placeholder:text-fnt"
      />
    </div>
  );
}

/* ---- Unified output panel ---- */
interface OutputPanelProps {
  isFn: boolean;
  isUi: boolean;
  customIn: string;
  setCustomIn: (v: string) => void;
  runOut: { stdout: string; error?: string; ok: boolean } | null;
  cases: { pass: boolean; stdin: string; expect: string; got: string; error?: string }[] | null;
  fnCases: FnCaseResult[] | null;
  uiCases: UiCaseResult[] | null;
  testCount: number;
  hiddenCount: number;
  assertionCount: number;
  hiddenAssertionCount: number;
}

export const OutputPanel = memo(function OutputPanel({
  isFn, isUi, customIn, setCustomIn,
  runOut, cases, fnCases, uiCases,
  testCount, hiddenCount, assertionCount, hiddenAssertionCount,
}: OutputPanelProps) {
  return (
    <>
      {!isFn && !isUi && <CustomInput value={customIn} onChange={setCustomIn} />}
      {!isFn && !isUi && (runOut || cases) && <CliOutput cases={cases} runOut={runOut} testCount={testCount} hiddenCount={hiddenCount} />}
      {isFn && fnCases && <FnOutput fnCases={fnCases} testCount={testCount} hiddenCount={hiddenCount} />}
      {isUi && uiCases && <UiOutput uiCases={uiCases} assertionCount={assertionCount} hiddenAssertionCount={hiddenAssertionCount} />}
    </>
  );
});
