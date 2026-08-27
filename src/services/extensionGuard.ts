/**
 * extensionGuard — detects browser extensions that hijack dynamic imports
 * or inject scripts into the page, causing blank screens or broken modules.
 *
 * Generic: catches ANY chrome-extension:// or moz-extension:// interference,
 * not just specific extensions like Buyhatke.
 */

let warned = false;
let bannerEl: HTMLDivElement | null = null;

const EXTENSION_URL_RE = /chrome-extension:\/\/|moz-extension:\/\/|safari-web-extension:\/\//i;

function showBanner(details: string) {
  if (warned || bannerEl) return;
  warned = true;

  const div = document.createElement('div');
  div.id = 'ext-guard-banner';
  div.innerHTML = `
    <div style="
      position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
      z-index:99999; max-width:600px; width:calc(100% - 32px);
      background:#1e1b4b; color:#e0e7ff; border:1px solid #6366f1;
      border-radius:12px; padding:16px 20px; font-family:system-ui,sans-serif;
      box-shadow:0 8px 32px rgba(0,0,0,0.4); line-height:1.5;
    ">
      <div style="display:flex; align-items:flex-start; gap:12px;">
        <span style="font-size:24px; flex-shrink:0;">⚠️</span>
        <div style="flex:1;">
          <strong style="font-size:14px; color:#a5b4fc;">Browser Extension Interference Detected</strong>
          <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">
            A browser extension is modifying this page's scripts, which may cause errors
            or a blank screen. Try one of these fixes:
          </p>
          <ul style="margin:8px 0 0; padding-left:18px; font-size:13px; opacity:0.85;">
            <li>Open this site in <strong>Incognito mode</strong> (Ctrl+Shift+N)</li>
            <li>Temporarily disable your ad-blocker, coupon, or shopping extensions</li>
            <li>Whitelist <strong>gaurav123337.github.io</strong> in your extension settings</li>
          </ul>
          <details style="margin-top:8px; font-size:12px; opacity:0.7;">
            <summary style="cursor:pointer;">Technical details</summary>
            <code style="display:block; margin-top:4px; word-break:break-all; font-size:11px;">${details}</code>
          </details>
        </div>
        <button id="ext-guard-close" style="
          background:none; border:none; color:#a5b4fc; font-size:20px;
          cursor:pointer; padding:0 4px; flex-shrink:0; line-height:1;
        ">&times;</button>
      </div>
    </div>
  `;

  document.body.appendChild(div);
  bannerEl = div;

  div.querySelector('#ext-guard-close')?.addEventListener('click', () => {
    div.remove();
    bannerEl = null;
  });
}

/**
 * Start monitoring for extension interference.
 * Safe to call multiple times — only activates once.
 */
export function initExtensionGuard() {
  if (typeof window === 'undefined') return;

  /* 1 — Listen for unhandled errors that reference extension URLs */
  window.addEventListener('error', (e) => {
    const msg = String(e.message || '');
    const src = String(e.filename || '');
    if (EXTENSION_URL_RE.test(msg) || EXTENSION_URL_RE.test(src)) {
      showBanner(`Extension script detected: ${src || msg}`);
    }
  }, true);

  /* 2 — Listen for unhandled promise rejections (failed dynamic imports) */
  window.addEventListener('unhandledrejection', (e) => {
    const reason = String((e.reason as any)?.message || e.reason || '');
    if (EXTENSION_URL_RE.test(reason)) {
      showBanner(`Extension hijacked a module import: ${reason.slice(0, 200)}`);
    }
  }, true);

  /* 3 — Monkey-patch dynamic import to detect URL rewriting */
  const originalImport = window.__import_shim || (window as any).import;
  if (typeof originalImport === 'function' && !window.__import_guarded) {
    window.__import_guarded = true;
    (window as any).import = function (specifier: string | URL, ...args: any[]) {
      const url = String(specifier);
      if (EXTENSION_URL_RE.test(url)) {
        showBanner(`Extension rewrote dynamic import to: ${url}`);
        // Still call original so the app doesn't crash harder
      }
      return originalImport.call(this, specifier, ...args);
    };
  }

  /* 4 — MutationObserver: watch for injected <script> from extensions */
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (node instanceof HTMLScriptElement) {
          const src = node.src || '';
          if (EXTENSION_URL_RE.test(src)) {
            showBanner(`Extension injected a script tag: ${src}`);
            observer.disconnect();
            return;
          }
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  /* Stop observing after 30s to avoid performance hit */
  setTimeout(() => observer.disconnect(), 30000);
}

/* Extend Window type for the shim */
declare global {
  interface Window {
    __import_shim?: (specifier: string | URL) => Promise<any>;
    __import_guarded?: boolean;
  }
}
