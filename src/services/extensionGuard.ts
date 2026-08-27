/**
 * extensionGuard — detects browser extensions that hijack dynamic imports
 * or inject scripts into the page, causing blank screens or broken modules.
 *
 * Generic: catches ANY chrome-extension:// or moz-extension:// interference,
 * not just specific extensions like Buyhatke.
 */

let warned = false;
let bannerEl: HTMLElement | null = null;

const EXTENSION_URL_RE = /chrome-extension:\/\/|moz-extension:\/\/|safari-web-extension:\/\//i;

function el(tag: string, attrs: Record<string, string>, ...children: (Node | string)[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style') e.setAttribute('style', v);
    else if (k.startsWith('data-')) e.setAttribute(k, v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

function showBanner(details: string) {
  if (warned || bannerEl) return;
  warned = true;

  const banner = el('div', {
    style: 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;max-width:600px;width:calc(100% - 32px);background:#1e1b4b;color:#e0e7ff;border:1px solid #6366f1;border-radius:12px;padding:16px 20px;font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);line-height:1.5;'
  });

  const row = el('div', { style: 'display:flex;align-items:flex-start;gap:12px;' });

  const icon = el('span', { style: 'font-size:24px;flex-shrink:0;' }, '⚠️');

  const body = el('div', { style: 'flex:1;' });
  body.appendChild(el('strong', { style: 'font-size:14px;color:#a5b4fc;' }, 'Browser Extension Interference Detected'));
  body.appendChild(el('p', { style: 'margin:6px 0 0;font-size:13px;opacity:0.9;' },
    'A browser extension is modifying this page\'s scripts, which may cause errors or a blank screen. Try one of these fixes:'
  ));

  const list = el('ul', { style: 'margin:8px 0 0;padding-left:18px;font-size:13px;opacity:0.85;' });
  list.appendChild(el('li', {}, 'Open this site in ', el('strong', {}, 'Incognito mode'), ' (Ctrl+Shift+N)'));
  list.appendChild(el('li', {}, 'Temporarily disable your ad-blocker, coupon, or shopping extensions'));
  list.appendChild(el('li', {}, 'Whitelist this site in your extension settings'));
  body.appendChild(list);

  const detailsEl = el('details', { style: 'margin-top:8px;font-size:12px;opacity:0.7;' });
  detailsEl.appendChild(el('summary', { style: 'cursor:pointer;' }, 'Technical details'));
  detailsEl.appendChild(el('code', { style: 'display:block;margin-top:4px;word-break:break-all;font-size:11px;' }, details));
  body.appendChild(detailsEl);

  const closeBtn = el('button', {
    style: 'background:none;border:none;color:#a5b4fc;font-size:20px;cursor:pointer;padding:0 4px;flex-shrink:0;line-height:1;'
  }, '×');
  closeBtn.addEventListener('click', () => { banner.remove(); bannerEl = null; });

  row.appendChild(icon);
  row.appendChild(body);
  row.appendChild(closeBtn);
  banner.appendChild(row);

  document.body.appendChild(banner);
  bannerEl = banner;
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
