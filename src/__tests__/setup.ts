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
