/* JS function-mode bank — "implement X with a fixed signature", the format
   GreatFrontEnd-style platforms made famous. Judged entirely in the browser
   (offline-capable) by src/services/runner.ts runFnTests: each test calls the
   user's function with `args` and deep-compares the result, or hands the
   function to a `drive` harness when the behavior needs multiple calls /
   timers / `new` (debounce, EventEmitter, LRUCache, …).

   Every problem carries a `reference` implementation — the bank self-test
   (src/__tests__/jsfunctions.test.ts) asserts each reference passes its own
   full suite, so a broken problem or test can never ship silently. */

import type { FnProblem } from "../coding";

export const JS_FUNCTION_PROBLEMS: FnProblem[] = [
  {
    kind: "fn",
    id: "fn-debounce",
    title: "Debounce",
    difficulty: 2,
    category: "timing",
    prompt: "Implement debounce(fn, wait): returns a function that delays invoking fn until wait ms have passed since the last call. If the returned function is called again before the wait elapses, the timer resets.",
    fn: { name: "debounce", args: "fn, wait", returns: "debounced function" },
    starter: `function debounce(fn, wait) {
  // your code here
}`,
    tests: [
      { label: "fires once after the trailing quiet period", args: [], drive: async (debounce) => { const calls: number[] = []; const d = (debounce as (fn: (x: number) => void, wait: number) => (x: number) => void)((x) => calls.push(x), 20); d(1); d(2); d(3); await new Promise(r => setTimeout(r, 60)); return calls; }, expect: [3] },
      { label: "resets the timer on every call", args: [], drive: async (debounce) => { const calls: number[] = []; const d = (debounce as (fn: (x: number) => void, wait: number) => (x: number) => void)((x) => calls.push(x), 20); d(1); await new Promise(r => setTimeout(r, 10)); d(2); await new Promise(r => setTimeout(r, 40)); return calls; }, expect: [2] },
      { label: "separate debounced functions do not interfere", args: [], drive: async (debounce) => { const a: number[] = []; const b: number[] = []; const da = (debounce as (fn: (x: number) => void, wait: number) => (x: number) => void)((x) => a.push(x), 15); const db = (debounce as (fn: (x: number) => void, wait: number) => (x: number) => void)((x) => b.push(x), 15); da(1); db(2); await new Promise(r => setTimeout(r, 40)); return [a, b]; }, expect: [[1], [2]] }
    ],
    hidden: [
      { label: "forwards the arguments of the last call", args: [], drive: async (debounce) => { const calls: [number, number][] = []; const d = (debounce as (fn: (x: number, y: number) => void, wait: number) => (x: number, y: number) => void)((x, y) => calls.push([x, y]), 10); d(1, 2); await new Promise(r => setTimeout(r, 40)); return calls; }, expect: [[1, 2]] }
    ],
    reference: `function debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}`
  },
  {
    kind: "fn",
    id: "fn-throttle",
    title: "Throttle",
    difficulty: 2,
    category: "timing",
    prompt: "Implement throttle(fn, wait): returns a function that calls fn at most once per wait ms — the first call fires immediately, subsequent calls during the window are ignored (a trailing call fires after the window).",
    fn: { name: "throttle", args: "fn, wait", returns: "throttled function" },
    starter: `function throttle(fn, wait) {
  // your code here
}`,
    tests: [
      { label: "fires immediately, then at most one trailing call", args: [], drive: async (throttle) => { const calls: string[] = []; const t = (throttle as (fn: (x: string) => void, wait: number) => (x: string) => void)((x) => calls.push(x), 40); t("a"); t("b"); t("c"); await new Promise(r => setTimeout(r, 80)); return calls; }, expect: ["a", "c"] },
      { label: "fires again once the window has elapsed", args: [], drive: async (throttle) => { const calls: number[] = []; const t = (throttle as (fn: (x: number) => void, wait: number) => (x: number) => void)((x) => calls.push(x), 20); t(1); await new Promise(r => setTimeout(r, 30)); t(2); await new Promise(r => setTimeout(r, 30)); return calls; }, expect: [1, 2] }
    ],
    hidden: [
      { label: "passes the latest arguments to the trailing call", args: [], drive: async (throttle) => { const calls: number[] = []; const t = (throttle as (fn: (x: number) => void, wait: number) => (x: number) => void)((x) => calls.push(x), 30); t(1); t(2); t(3); await new Promise(r => setTimeout(r, 60)); return calls; }, expect: [1, 3] }
    ],
    reference: `function throttle(fn, wait) {
  let last = 0;
  let timer = null;
  let lastArgs = null;
  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else {
      lastArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(this, lastArgs);
        }, remaining);
      }
    }
  };
}`
  },
  {
    kind: "fn",
    id: "fn-deep-clone",
    title: "Deep Clone",
    difficulty: 3,
    category: "collections",
    prompt: "Implement deepClone(value): returns a deep copy of objects, arrays, primitives and Dates. Nested structures must be independent of the original — mutating the clone must not affect the source.",
    fn: { name: "deepClone", args: "value", returns: "deep copy" },
    starter: `function deepClone(value) {
  // your code here
}`,
    tests: [
      { label: "deep-clones nested objects and arrays", args: [{ a: 1, b: [1, 2, { c: 3 }], d: null, e: undefined, f: NaN }], expect: { a: 1, b: [1, 2, { c: 3 }], d: null, e: undefined, f: NaN } },
      { label: "returns a distinct reference", args: [], drive: (deepClone) => { const src = { x: 1 }; return (deepClone as (v: unknown) => unknown)(src) !== src; }, expect: true },
      { label: "clones dates with the same instant", args: [new Date("2024-01-01T00:00:00Z")], expect: new Date("2024-01-01T00:00:00Z") }
    ],
    hidden: [
      { label: "nested arrays stay independent after mutation", args: [], drive: (deepClone) => { const a = [1, [2, [3]]]; const b = (deepClone as (v: unknown) => unknown)(a) as unknown[]; (b[1] as unknown[]).push(99); return a[1]; }, expect: [2, [3]] }
    ],
    reference: `function deepClone(value, seen = new Map()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  const out = Array.isArray(value) ? [] : {};
  seen.set(value, out);
  for (const key of Object.keys(value)) {
    out[key] = deepClone(value[key], seen);
  }
  return out;
}`
  },
  {
    kind: "fn",
    id: "fn-promise-all",
    title: "Promise.all",
    difficulty: 3,
    category: "async",
    prompt: "Implement promiseAll(promises): returns a promise that resolves with an array of every input's value, in order, or rejects with the first rejection. Works with non-promise values too and with an empty array.",
    fn: { name: "promiseAll", args: "promises", returns: "Promise<values[]>" },
    starter: `function promiseAll(promises) {
  // your code here
}`,
    tests: [
      { label: "resolves with results in input order", args: [[Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)]], expect: [1, 2, 3] },
      { label: "resolves with an empty array", args: [[]], expect: [] },
      { label: "rejects when any promise rejects", args: [], drive: async (promiseAll) => { try { await (promiseAll as (ps: Promise<unknown>[]) => Promise<unknown>)([Promise.resolve(1), Promise.reject(new Error("nope"))]); return "no-reject"; } catch (e) { return (e as Error).message; } }, expect: "nope" }
    ],
    hidden: [
      { label: "preserves order for mixed-resolution inputs", args: [], drive: async (promiseAll) => await (promiseAll as (ps: Promise<unknown>[]) => Promise<unknown[]>)([new Promise(r => setTimeout(() => r("a"), 15)), Promise.resolve("b"), new Promise(r => setTimeout(() => r("c"), 5))]), expect: ["a", "b", "c"] }
    ],
    reference: `function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    const results = new Array(promises.length);
    let pending = promises.length;
    if (pending === 0) return resolve([]);
    promises.forEach((p, i) => {
      Promise.resolve(p).then(v => {
        results[i] = v;
        pending--;
        if (pending === 0) resolve(results);
      }, reject);
    });
  });
}`
  },
  {
    kind: "fn",
    id: "fn-promise-race",
    title: "Promise.race",
    difficulty: 2,
    category: "async",
    prompt: "Implement promiseRace(promises): returns a promise that settles with the first promise to settle — its value if it resolves, its reason if it rejects.",
    fn: { name: "promiseRace", args: "promises", returns: "Promise<first settled value>" },
    starter: `function promiseRace(promises) {
  // your code here
}`,
    tests: [
      { label: "resolves with the first settled value", args: [], drive: async (promiseRace) => await (promiseRace as (ps: Promise<unknown>[]) => Promise<unknown>)([new Promise(r => setTimeout(() => r("slow"), 30)), Promise.resolve("fast")]), expect: "fast" },
      { label: "rejects if the first settled is a rejection", args: [], drive: async (promiseRace) => { try { await (promiseRace as (ps: Promise<unknown>[]) => Promise<unknown>)([Promise.reject(new Error("boom")), Promise.resolve(1)]); return "no-reject"; } catch (e) { return (e as Error).message; } }, expect: "boom" }
    ],
    hidden: [
      { label: "picks the fastest async value", args: [], drive: async (promiseRace) => await (promiseRace as (ps: Promise<unknown>[]) => Promise<unknown>)([new Promise(r => setTimeout(() => r("a"), 20)), new Promise(r => setTimeout(() => r("b"), 5))]), expect: "b" }
    ],
    reference: `function promiseRace(promises) {
  return new Promise((resolve, reject) => {
    for (const p of promises) Promise.resolve(p).then(resolve, reject);
  });
}`
  },
  {
    kind: "fn",
    id: "fn-event-emitter",
    title: "EventEmitter",
    difficulty: 3,
    category: "classes",
    prompt: "Implement an EventEmitter class with on(name, fn), off(name, fn), emit(name, ...args) and once(name, fn). off removes a specific listener; once fires the listener at most once and then removes it.",
    fn: { name: "EventEmitter", args: "constructor()", returns: "class with on/off/emit/once" },
    starter: `class EventEmitter {
  // your code here
}`,
    tests: [
      { label: "on + emit delivers arguments", args: [], drive: (EventEmitter) => { const e = new (EventEmitter as new () => { on(n: string, f: (x: number) => void): unknown; emit(n: string, x: number): unknown })(); const got: number[] = []; e.on("ping", (x) => got.push(x)); e.emit("ping", 42); return got; }, expect: [42] },
      { label: "off removes a specific listener", args: [], drive: (EventEmitter) => { const e = new (EventEmitter as new () => { on(n: string, f: (x: number) => void): unknown; off(n: string, f: (x: number) => void): unknown; emit(n: string, x: number): unknown })(); const got: number[] = []; const fn = (x: number) => got.push(x); e.on("a", fn); e.emit("a", 1); e.off("a", fn); e.emit("a", 2); return got; }, expect: [1] },
      { label: "once fires a single time", args: [], drive: (EventEmitter) => { const e = new (EventEmitter as new () => { once(n: string, f: () => void): unknown; emit(n: string): unknown })(); let n = 0; e.once("b", () => n++); e.emit("b"); e.emit("b"); return n; }, expect: 1 }
    ],
    hidden: [
      { label: "all listeners fire on emit", args: [], drive: (EventEmitter) => { const e = new (EventEmitter as new () => { on(n: string, f: () => void): unknown; emit(n: string): unknown })(); let total = 0; e.on("c", () => { total += 1; }); e.on("c", () => { total += 10; }); e.emit("c"); return total; }, expect: 11 }
    ],
    reference: `class EventEmitter {
  constructor() {
    this.events = new Map();
  }
  on(name, fn) {
    if (!this.events.has(name)) this.events.set(name, []);
    this.events.get(name).push(fn);
    return this;
  }
  off(name, fn) {
    const list = this.events.get(name);
    if (list) {
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    }
    return this;
  }
  emit(name, ...args) {
    for (const fn of [...(this.events.get(name) || [])]) fn(...args);
    return this;
  }
  once(name, fn) {
    const wrap = (...args) => {
      this.off(name, wrap);
      fn(...args);
    };
    return this.on(name, wrap);
  }
}`
  },
  {
    kind: "fn",
    id: "fn-memoize",
    title: "Memoize",
    difficulty: 2,
    category: "collections",
    prompt: "Implement memoize(fn): returns a memoized version that caches results by argument values (deep, JSON-style keys) so fn runs once per distinct input.",
    fn: { name: "memoize", args: "fn", returns: "memoized function" },
    starter: `function memoize(fn) {
  // your code here
}`,
    tests: [
      { label: "computes once for repeated equal args", args: [], drive: (memoize) => { let calls = 0; const m = (memoize as (fn: (x: number) => number) => (x: number) => number)((x) => { calls++; return x * 2; }); m(4); m(4); return calls; }, expect: 1 },
      { label: "computes once per distinct argument", args: [], drive: (memoize) => { const seen: number[] = []; const m = (memoize as (fn: (x: number) => number) => (x: number) => number)((x) => { seen.push(x); return x; }); m(1); m(2); m(1); m(3); return seen; }, expect: [1, 2, 3] }
    ],
    hidden: [
      { label: "caches object args by value", args: [], drive: (memoize) => { let calls = 0; const m = (memoize as (fn: (o: { v: number }) => number) => (o: { v: number }) => number)((o) => { calls++; return o.v * 2; }); m({ v: 5 }); m({ v: 5 }); return calls; }, expect: 1 }
    ],
    reference: `function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}`
  },
  {
    kind: "fn",
    id: "fn-once",
    title: "Once",
    difficulty: 1,
    category: "composition",
    prompt: "Implement once(fn): returns a function that calls fn only the first time it is invoked, then returns that first result on every later call.",
    fn: { name: "once", args: "fn", returns: "single-call wrapper" },
    starter: `function once(fn) {
  // your code here
}`,
    tests: [
      { label: "calls the function only once", args: [], drive: (once) => { let n = 0; const f = (once as (fn: () => number) => () => number)(() => ++n); f(); f(); f(); return n; }, expect: 1 },
      { label: "returns the first result on repeat calls", args: [], drive: (once) => { const f = (once as (fn: (x: number) => number) => (x: number) => number)((x) => x * 10); const a = f(1); const b = f(2); return [a, b]; }, expect: [10, 10] }
    ],
    hidden: [
      { label: "captures the first call's arguments", args: [], drive: (once) => { const seen: [number, number][] = []; const f = (once as (fn: (a: number, b: number) => number) => (a: number, b: number) => number)((a, b) => { seen.push([a, b]); return a + b; }); f(2, 3); f(9, 9); return seen; }, expect: [[2, 3]] }
    ],
    reference: `function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (called) return result;
    called = true;
    result = fn.apply(this, args);
    return result;
  };
}`
  },
  {
    kind: "fn",
    id: "fn-flatten",
    title: "Flatten",
    difficulty: 2,
    category: "collections",
    prompt: "Implement flatten(arr): returns a new array with all nested arrays flattened to any depth, preserving order.",
    fn: { name: "flatten", args: "arr", returns: "flat array" },
    starter: `function flatten(arr) {
  // your code here
}`,
    tests: [
      { label: "flattens nested arrays to any depth", args: [[1, [2, [3, [4]]], 5]], expect: [1, 2, 3, 4, 5] },
      { label: "keeps non-array values in order", args: [[1, [2, 3], 4]], expect: [1, 2, 3, 4] }
    ],
    hidden: [
      { label: "handles empty and nested-empty arrays", args: [[[], [1, []], []]], expect: [1] }
    ],
    reference: `function flatten(arr) {
  const out = [];
  for (const item of arr) {
    if (Array.isArray(item)) out.push(...flatten(item));
    else out.push(item);
  }
  return out;
}`
  },
  {
    kind: "fn",
    id: "fn-uniq",
    title: "Uniq",
    difficulty: 1,
    category: "collections",
    prompt: "Implement uniq(arr): returns a new array with duplicate values removed, keeping the first occurrence's order. NaN counts as equal to NaN.",
    fn: { name: "uniq", args: "arr", returns: "deduplicated array" },
    starter: `function uniq(arr) {
  // your code here
}`,
    tests: [
      { label: "removes duplicates keeping first-occurrence order", args: [[1, 1, 2, 3, 2, 3, 4]], expect: [1, 2, 3, 4] },
      { label: "works with strings", args: [["a", "b", "a", "c"]], expect: ["a", "b", "c"] }
    ],
    hidden: [
      { label: "treats NaN as equal", args: [[NaN, NaN, 1]], expect: [NaN, 1] }
    ],
    reference: `function uniq(arr) {
  return [...new Set(arr)];
}`
  },
  {
    kind: "fn",
    id: "fn-chunk",
    title: "Chunk",
    difficulty: 1,
    category: "collections",
    prompt: "Implement chunk(arr, size): splits an array into groups of `size` items, with the final group possibly smaller.",
    fn: { name: "chunk", args: "arr, size", returns: "array of chunks" },
    starter: `function chunk(arr, size) {
  // your code here
}`,
    tests: [
      { label: "splits into chunks of the given size", args: [[1, 2, 3, 4, 5], 2], expect: [[1, 2], [3, 4], [5]] },
      { label: "works when evenly divisible", args: [[1, 2, 3, 4], 2], expect: [[1, 2], [3, 4]] }
    ],
    hidden: [
      { label: "returns empty for an empty array", args: [[], 3], expect: [] }
    ],
    reference: `function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}`
  },
  {
    kind: "fn",
    id: "fn-group-by",
    title: "Group By",
    difficulty: 2,
    category: "collections",
    prompt: "Implement groupBy(arr, keyFn): returns an object mapping each keyFn(item) result to the array of items producing it, in insertion order.",
    fn: { name: "groupBy", args: "arr, keyFn", returns: "grouped object" },
    starter: `function groupBy(arr, keyFn) {
  // your code here
}`,
    tests: [
      { label: "groups by a key function", args: [[1, 2, 3, 4, 5], (n: number) => (n % 2 === 0 ? "even" : "odd")], expect: { odd: [1, 3, 5], even: [2, 4] } },
      { label: "groups objects by a property", args: [[{ t: "a" }, { t: "b" }, { t: "a" }], (o: { t: string }) => o.t], expect: { a: [{ t: "a" }, { t: "a" }], b: [{ t: "b" }] } }
    ],
    hidden: [
      { label: "preserves insertion order of groups", args: [["x", "y", "x", "z"], (s: string) => s], expect: { x: ["x", "x"], y: ["y"], z: ["z"] } }
    ],
    reference: `function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!out[key]) out[key] = [];
    out[key].push(item);
  }
  return out;
}`
  },
  {
    kind: "fn",
    id: "fn-pipe",
    title: "Pipe",
    difficulty: 1,
    category: "composition",
    prompt: "Implement pipe(...fns): returns a function that passes its input through each function left to right, threading the result into the next.",
    fn: { name: "pipe", args: "...fns", returns: "composed function" },
    starter: `function pipe(...fns) {
  // your code here
}`,
    tests: [
      { label: "applies functions left to right", args: [], drive: (pipe) => (pipe as (...fns: ((x: number) => number)[]) => (x: number) => number)((x) => x + 1, (x) => x * 2)(5), expect: 12 },
      { label: "works with a single function", args: [], drive: (pipe) => (pipe as (...fns: ((x: number) => number)[]) => (x: number) => number)((x) => x * 3)(4), expect: 12 }
    ],
    hidden: [
      { label: "threads the value through many steps", args: [], drive: (pipe) => (pipe as (...fns: ((x: number) => number)[]) => (x: number) => number)((x) => x + 2, (x) => x * 10, (x) => x - 5)(1), expect: 25 }
    ],
    reference: `function pipe(...fns) {
  return (input) => fns.reduce((acc, fn) => fn(acc), input);
}`
  },
  {
    kind: "fn",
    id: "fn-compose",
    title: "Compose",
    difficulty: 2,
    category: "composition",
    prompt: "Implement compose(...fns): returns a function that applies the functions right to left — compose(f, g)(x) === f(g(x)).",
    fn: { name: "compose", args: "...fns", returns: "composed function" },
    starter: `function compose(...fns) {
  // your code here
}`,
    tests: [
      { label: "applies functions right to left", args: [], drive: (compose) => (compose as (...fns: ((x: number) => number)[]) => (x: number) => number)((x) => x * 2, (x) => x + 1)(3), expect: 8 },
      { label: "single function identity", args: [], drive: (compose) => (compose as (...fns: ((x: number) => number)[]) => (x: number) => number)((x) => x - 1)(10), expect: 9 }
    ],
    hidden: [
      { label: "compose with three functions", args: [], drive: (compose) => (compose as (...fns: ((x: number) => number)[]) => (x: number) => number)((x) => x * 3, (x) => x + 2, (x) => x * 2)(5), expect: 36 }
    ],
    reference: `function compose(...fns) {
  return (input) => fns.reduceRight((acc, fn) => fn(acc), input);
}`
  },
  {
    kind: "fn",
    id: "fn-curry",
    title: "Curry",
    difficulty: 3,
    category: "composition",
    prompt: "Implement curry(fn): returns a curried version that keeps collecting arguments until the function's arity (fn.length) is satisfied, then calls fn with all of them.",
    fn: { name: "curry", args: "fn", returns: "curried function" },
    starter: `function curry(fn) {
  // your code here
}`,
    tests: [
      { label: "curries until the arity is met", args: [], drive: (curry) => (curry as (fn: (a: number, b: number, c: number) => number) => (a: number) => (b: number) => (c: number) => number)((a, b, c) => a + b + c)(1)(2)(3), expect: 6 },
      { label: "accepts multiple args at once", args: [], drive: (curry) => (curry as (fn: (a: number, b: number, c: number) => number) => (a: number, b: number) => (c: number) => number)((a, b, c) => a * b + c)(1, 2)(3), expect: 5 }
    ],
    hidden: [
      { label: "partial application two at a time", args: [], drive: (curry) => (curry as (fn: (a: number, b: number) => number) => (a: number) => (b: number) => number)((a, b) => a - b)(10)(4), expect: 6 }
    ],
    reference: `function curry(fn) {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
}`
  },
  {
    kind: "fn",
    id: "fn-sleep",
    title: "Sleep",
    difficulty: 1,
    category: "async",
    prompt: "Implement sleep(ms): returns a promise that resolves (to undefined) after at least ms milliseconds.",
    fn: { name: "sleep", args: "ms", returns: "Promise<void>" },
    starter: `function sleep(ms) {
  // your code here
}`,
    tests: [
      { label: "resolves after the requested delay", args: [], drive: async (sleep) => { const start = Date.now(); await (sleep as (ms: number) => Promise<void>)(30); return Date.now() - start >= 25; }, expect: true },
      { label: "resolves to undefined", args: [5], expect: undefined }
    ],
    hidden: [
      { label: "resolves for a zero delay", args: [0], expect: undefined }
    ],
    reference: `function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}`
  },
  {
    kind: "fn",
    id: "fn-map-limit",
    title: "Map Limit",
    difficulty: 3,
    category: "async",
    prompt: "Implement mapLimit(items, limit, mapper): returns a promise resolving with mapper(item, index) applied to every item, running at most `limit` mapper calls concurrently, preserving order.",
    fn: { name: "mapLimit", args: "items, limit, mapper", returns: "Promise<results[]>" },
    starter: `async function mapLimit(items, limit, mapper) {
  // your code here
}`,
    tests: [
      { label: "maps all items with correct results", args: [], drive: async (mapLimit) => (mapLimit as (items: number[], limit: number, mapper: (v: number) => Promise<number>) => Promise<number[]>)([1, 2, 3, 4], 2, async (v) => v * 2), expect: [2, 4, 6, 8] },
      { label: "never runs more than the limit concurrently", args: [], drive: async (mapLimit) => { let active = 0; let maxActive = 0; const results = await (mapLimit as (items: number[], limit: number, mapper: (v: number) => Promise<number>) => Promise<number[]>)([1, 2, 3, 4, 5, 6], 2, async (v) => { active++; maxActive = Math.max(maxActive, active); await new Promise((r) => setTimeout(r, 10)); active--; return v; }); return { results, maxActive }; }, expect: { results: [1, 2, 3, 4, 5, 6], maxActive: 2 } }
    ],
    hidden: [
      { label: "handles a limit larger than the list", args: [], drive: async (mapLimit) => (mapLimit as (items: number[], limit: number, mapper: (v: number) => Promise<number>) => Promise<number[]>)([1, 2, 3], 10, async (v) => v + 1), expect: [2, 3, 4] }
    ],
    reference: `async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await mapper(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}`
  },
  {
    kind: "fn",
    id: "fn-binary-search",
    title: "Binary Search",
    difficulty: 2,
    category: "search",
    prompt: "Implement binarySearch(arr, target): returns the index of target in a sorted array, or -1 if it is not present. Must be O(log n).",
    fn: { name: "binarySearch", args: "arr, target", returns: "index or -1" },
    starter: `function binarySearch(arr, target) {
  // your code here
}`,
    tests: [
      { label: "finds the target in a sorted array", args: [[-1, 0, 3, 5, 9, 12], 9], expect: 4 },
      { label: "returns -1 when absent", args: [[-1, 0, 3, 5, 9, 12], 2], expect: -1 }
    ],
    hidden: [
      { label: "handles a single element", args: [[7], 7], expect: 0 },
      { label: "target smaller than everything", args: [[1, 2, 3], 0], expect: -1 }
    ],
    reference: `function binarySearch(arr, target) {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`
  },
  {
    kind: "fn",
    id: "fn-lru-cache",
    title: "LRU Cache",
    difficulty: 3,
    category: "classes",
    prompt: "Implement an LRUCache class with get(key) and put(key, value) that keeps the `capacity` most recently used entries. get returns -1 for missing keys and marks the entry as recently used; put evicts the least recently used entry when over capacity.",
    fn: { name: "LRUCache", args: "constructor(capacity)", returns: "class with get/put" },
    starter: `class LRUCache {
  // your code here
}`,
    tests: [
      { label: "stores and retrieves values", args: [], drive: (LRUCache) => { const c = new (LRUCache as new (n: number) => { get(k: number): unknown; put(k: number, v: unknown): void })(2); c.put(1, "a"); c.put(2, "b"); return [c.get(1), c.get(2)]; }, expect: ["a", "b"] },
      { label: "evicts the least recently used when over capacity", args: [], drive: (LRUCache) => { const c = new (LRUCache as new (n: number) => { get(k: number): unknown; put(k: number, v: unknown): void })(2); c.put(1, "a"); c.put(2, "b"); c.get(1); c.put(3, "c"); return [c.get(1), c.get(2), c.get(3)]; }, expect: ["a", -1, "c"] }
    ],
    hidden: [
      { label: "returns -1 for missing keys", args: [], drive: (LRUCache) => { const c = new (LRUCache as new (n: number) => { get(k: number): unknown })(1); return c.get(9); }, expect: -1 }
    ],
    reference: `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }
  get(key) {
    if (!this.cache.has(key)) return -1;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
  }
}`
  },
  {
    kind: "fn",
    id: "fn-range",
    title: "Range",
    difficulty: 1,
    category: "collections",
    prompt: "Implement range(start, end, step = 1): returns an array of numbers from start up to (not including) end, advancing by step. Support negative steps for descending ranges.",
    fn: { name: "range", args: "start, end, step = 1", returns: "array of numbers" },
    starter: `function range(start, end, step = 1) {
  // your code here
}`,
    tests: [
      { label: "builds a start-inclusive end-exclusive range", args: [1, 5], expect: [1, 2, 3, 4] },
      { label: "respects a custom step", args: [0, 10, 2], expect: [0, 2, 4, 6, 8] }
    ],
    hidden: [
      { label: "supports negative steps", args: [5, 1, -1], expect: [5, 4, 3, 2] }
    ],
    reference: `function range(start, end, step = 1) {
  const out = [];
  if (step === 0) return out;
  if (step > 0) {
    for (let i = start; i < end; i += step) out.push(i);
  } else {
    for (let i = start; i > end; i += step) out.push(i);
  }
  return out;
}`
  }
];
