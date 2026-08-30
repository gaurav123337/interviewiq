/* jsdom's localStorage is unreliable under some vitest setups; use a clean in-memory shim. */

function makeStorage(): Storage {
  const mem = new Map<string, string>();
  return {
    get length() { return mem.size; },
    clear: () => mem.clear(),
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    key: (i: number) => [...mem.keys()][i] ?? null,
    removeItem: (k: string) => { mem.delete(k); },
    setItem: (k: string, v: string) => { mem.set(k, String(v)); }
  };
}

Object.defineProperty(globalThis, "localStorage", { value: makeStorage(), configurable: true, writable: true });
Object.defineProperty(window, "localStorage", { value: (globalThis as { localStorage: Storage }).localStorage, configurable: true, writable: true });

/* jsdom doesn't implement scrollTo; the app calls it on navigation */
window.scrollTo = (() => {}) as typeof window.scrollTo;

/* Initialize i18n for the whole suite. The app was migrated to react-i18next;
   components render their copy via t()/<Trans>, so without an initialized
   instance useTranslation() warns NO_I18NEXT_INSTANCE and t() returns raw keys
   — breaking any test that asserts on visible English text (e.g. the landing
   → onboarding flow). The module inits synchronously from bundled en/hi
   resources with fallbackLng "en", so importing it here is enough. */
import "../i18n";
