/* UI-mode judge — render HTML/CSS/JS in a sandboxed same-origin iframe
   and run DOM assertions (clicks, typing, computed styles) inside it.
   The iframe IS the sandbox: user code can never touch the app. */

export interface UiAssertionLike {
  label: string;
  /** JS body evaluated inside the iframe; may await; returns truthy to pass. */
  check: string;
}

export interface UiCaseResult {
  pass: boolean;
  label: string;
  error?: string;
  ms: number;
}

const UI_LOAD_TIMEOUT_MS = 5000;
const UI_CHECK_TIMEOUT_MS = 3000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("Timed out (possible infinite loop in your code)")), ms);
    p.then(v => { clearTimeout(to); resolve(v); }, e => { clearTimeout(to); reject(e); });
  });
}

/** Loads a framework library (React/Vue UMD from a CDN) into a document. When a
    script with the matching data-lib marker already exists (tests pre-inject
    fetched libs), it is skipped. Returns false if loading failed/timed out. */
export async function ensureUiLib(host: Document, lib: { url: string; global: string }): Promise<boolean> {
  if (host.querySelector(`script[data-lib="${lib.global}"]`)) return true;
  return new Promise(resolve => {
    const s = host.createElement("script");
    s.dataset.lib = lib.global;
    s.src = lib.url;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    host.head.appendChild(s);
    setTimeout(() => resolve(false), 20_000);
  });
}

/** Core UI judging against a given Document (a sandboxed iframe's document in
    production, the test document in unit tests). Injects the user's HTML/CSS/JS,
    runs each assertion, and cleans up. Returns per-assertion results. */
export async function runUiInDoc(
  host: Document,
  html: string,
  css: string,
  js: string,
  assertions: UiAssertionLike[],
  libs?: { url: string; global: string }[]
): Promise<UiCaseResult[]> {
  const root = host.createElement("div");
  root.id = "__ui-judge-root";
  root.innerHTML = html;
  const style = host.createElement("style");
  style.textContent = css;
  const script = host.createElement("script");
  /* IIFE-scoped so consecutive problems in the same window (tests) never
     collide on top-level const/let; production uses a fresh iframe anyway.
     The try/catch CONTAINS a throwing reference inside jsdom's async script
     queue — an escape there surfaces as an uncaught exception that crashes
     the whole vitest run, instead of a clean per-assertion failure. The
     assertion checks still run and fail normally either way. */
  script.textContent = `(function(){try{${js}\n}catch(e){window.__uiJudgeError=e&&e.message&&String(e.message)}}());`;
  host.body.appendChild(root);
  host.head.appendChild(style);
  for (const lib of libs ?? []) {
    /* loads from CDN in the browser; skips when a test pre-injected the lib */
    await ensureUiLib(host, lib);
  }
  host.body.appendChild(script);
  const win = host.defaultView;
  try {
    /* let dynamically-inserted scripts run before asserting */
    await new Promise(r => setTimeout(r, 30));
    const results: UiCaseResult[] = [];
    for (const a of assertions) {
      const start = Date.now();
      try {
        if (!win) throw new Error("Window unavailable");
        /* the wrapper injects the sleep helper so checks can await real timers */
        const pass = await withTimeout(
          Promise.resolve(win.eval(`(async () => { const sleep = (ms) => new Promise(r => setTimeout(r, ms)); ${a.check} })()`)),
          UI_CHECK_TIMEOUT_MS
        );
        results.push({ pass: !!pass, label: a.label, ms: Date.now() - start });
      } catch (e) {
        results.push({ pass: false, label: a.label, error: (e as Error)?.message ?? String(e), ms: Date.now() - start });
      }
    }
    return results;
  } finally {
    root.remove();
    style.remove();
    script.remove();
  }
}

/** Judges a UI component problem. The iframe IS the sandbox: user code runs in
    a blank same-origin iframe detached from the page, so it can never touch the
    app, and sync loops only freeze the disposable iframe thread. */
export async function runUiTests(
  html: string,
  css: string,
  js: string,
  assertions: UiAssertionLike[],
  libs?: { url: string; global: string }[]
): Promise<UiCaseResult[]> {
  /* Opaque-origin sandbox: `allow-scripts` WITHOUT `allow-same-origin` so user
     code can never reach the host app (that combination is effectively no
     sandbox in Chrome). localStorage is unavailable inside — problems that
     mention persistence guard for it. */
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:absolute;left:-99999px;top:0;width:600px;height:400px;border:0;";
  iframe.srcdoc = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>";
  document.body.appendChild(iframe);
  try {
    const deadline = Date.now() + UI_LOAD_TIMEOUT_MS;
    for (;;) {
      if (iframe.contentDocument?.readyState === "complete") break;
      if (Date.now() > deadline) throw new Error("Preview failed to load");
      await new Promise(r => setTimeout(r, 10));
    }
    if (!iframe.contentDocument) throw new Error("Sandbox unavailable");
    return runUiInDoc(iframe.contentDocument, html, css, js, assertions, libs);
  } finally {
    iframe.remove();
  }
}
