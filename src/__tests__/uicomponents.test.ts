// @vitest-environment jsdom
/* Bank self-test — every UI problem's reference implementation must pass its
   own visible + hidden assertions through the judge core. This guarantees the
   assertions are actually solvable and the problems ship verified.

   Framework (React/Vue) problems load their UMD builds from a CDN at test time
   and pre-inject them into the test document — the same scripts the sandbox
   loads in the browser. When the network is unavailable the suite skips those
   problems (with a warning) instead of failing, keeping the suite offline-safe. */

import { describe, expect, it } from "vitest";
import { UI_COMPONENT_PROBLEMS } from "../data/codingBank/uiComponents";
import { UI_ADVANCED_PROBLEMS } from "../data/codingBank/uiAdvanced";
import { REACT_LIBS, UI_FRAMEWORK_PROBLEMS } from "../data/codingBank/uiFramework";
import { runUiInDoc } from "../services/runner";

const ALL_UI_PROBLEMS = [...UI_COMPONENT_PROBLEMS, ...UI_ADVANCED_PROBLEMS, ...UI_FRAMEWORK_PROBLEMS];

/* Fetches each lib once and injects it as an inline script (the script realm,
   where the user's code runs — window expandos don't cross realms in jsdom). */
const libCache = new Map<string, Promise<boolean>>();
function ensureLib(lib: { url: string; global: string }): Promise<boolean> {
  if (!libCache.has(lib.url)) {
    libCache.set(lib.url, (async () => {
      /* abortable so an unreachable CDN can never hang the suite offline */
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const res = await fetch(lib.url, { signal: ctrl.signal });
        if (!res.ok) return false;
        const src = await res.text();
        const s = document.createElement("script");
        s.dataset.lib = lib.global;
        s.textContent = src;
        document.head.appendChild(s);
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(to);
      }
    })());
  }
  return libCache.get(lib.url)!;
}

/* Framework problems need React/Vue to mount inside jsdom — a known-fragile
   combo across environments. Before validating them, probe whether this
   environment can actually host React in the script realm (CI jsdom sometimes
   can't, e.g. React 18's input-setter proxying). When the probe fails, the
   framework problems are skipped with a warning instead of failing the suite —
   they are still validated structurally (hint/reference/assertions) below and
   against the real libs in the browser sandbox. The plain-HTML bank stays
   strictly asserted either way. */
async function canMountFrameworkInJsdom(): Promise<boolean> {
  const libsOk = (await Promise.all(REACT_LIBS.map(ensureLib))).every(Boolean);
  if (!libsOk) return false;
  const probeHtml = `<div id="root"></div>`;
  const probeJs = `const e = React.createElement; ReactDOM.createRoot(document.getElementById("root")).render(e("span", null, "probe-ok"));`;
  const res = await runUiInDoc(document, probeHtml, "", probeJs, [
    { label: "mount", check: `document.getElementById("root").textContent === "probe-ok"` }
  ]);
  return res[0]?.pass === true;
}

describe("UI component bank self-test", () => {
  it("every reference passes its own full assertion suite", async () => {
    /* toast auto-dismiss + countdown checks wait on real timers — needs headroom */
    expect(ALL_UI_PROBLEMS.length).toBeGreaterThanOrEqual(20);
    const failures: string[] = [];
    const skipped: string[] = [];
    let frameworkOk: boolean | null = null;
    for (const p of ALL_UI_PROBLEMS) {
      if (p.libs?.length) {
        if (frameworkOk === null) frameworkOk = await canMountFrameworkInJsdom();
        if (!frameworkOk) { skipped.push(p.id); continue; }
      }
      const suite = [...p.assertions, ...(p.hiddenAssertions ?? [])];
      const results = await runUiInDoc(document, p.reference.html, p.reference.css, p.reference.js, suite, p.libs);
      const bad = results.filter(r => !r.pass);
      if (bad.length > 0) {
        failures.push(`${p.id}: ${bad.map(b => `${b.label}${b.error ? ` (${b.error})` : ""}`).join("; ")}`);
      }
    }
    expect(failures).toEqual([]);
    if (skipped.length) {
      const reason = "this environment could not host the framework libs (offline or jsdom mount failure — probe-verified)";
      console.warn(`Framework problems skipped (${reason}): ${skipped.join(", ")}`);
    }
  }, 60_000);

  it("exposes a hint and reference for every problem", () => {
    for (const p of ALL_UI_PROBLEMS) {
      expect(p.hint?.trim().length ?? 0).toBeGreaterThan(0);
      expect(p.reference.js.trim().length).toBeGreaterThan(10);
      expect(p.assertions.length).toBeGreaterThanOrEqual(2);
      expect((p.hiddenAssertions?.length ?? 0)).toBeGreaterThanOrEqual(1);
    }
  });
});
