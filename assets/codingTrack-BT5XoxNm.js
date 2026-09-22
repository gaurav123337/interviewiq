import{D as e,T as t,w as n}from"./cloud-Be_vI-RX.js";import{r}from"./events-CDak79NZ.js";var i=[{kind:`fn`,id:`fn-debounce`,title:`Debounce`,difficulty:2,category:`timing`,prompt:`Implement debounce(fn, wait): returns a function that delays invoking fn until wait ms have passed since the last call. If the returned function is called again before the wait elapses, the timer resets.`,fn:{name:`debounce`,args:`fn, wait`,returns:`debounced function`},starter:`function debounce(fn, wait) {
  // your code here
}`,tests:[{label:`fires once after the trailing quiet period`,args:[],drive:async e=>{let t=[],n=e(e=>t.push(e),20);return n(1),n(2),n(3),await new Promise(e=>setTimeout(e,60)),t},expect:[3]},{label:`resets the timer on every call`,args:[],drive:async e=>{let t=[],n=e(e=>t.push(e),20);return n(1),await new Promise(e=>setTimeout(e,10)),n(2),await new Promise(e=>setTimeout(e,40)),t},expect:[2]},{label:`separate debounced functions do not interfere`,args:[],drive:async e=>{let t=[],n=[],r=e(e=>t.push(e),15),i=e(e=>n.push(e),15);return r(1),i(2),await new Promise(e=>setTimeout(e,40)),[t,n]},expect:[[1],[2]]}],hidden:[{label:`forwards the arguments of the last call`,args:[],drive:async e=>{let t=[];return e((e,n)=>t.push([e,n]),10)(1,2),await new Promise(e=>setTimeout(e,40)),t},expect:[[1,2]]}],reference:`function debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}`},{kind:`fn`,id:`fn-throttle`,title:`Throttle`,difficulty:2,category:`timing`,prompt:`Implement throttle(fn, wait): returns a function that calls fn at most once per wait ms — the first call fires immediately, subsequent calls during the window are ignored (a trailing call fires after the window).`,fn:{name:`throttle`,args:`fn, wait`,returns:`throttled function`},starter:`function throttle(fn, wait) {
  // your code here
}`,tests:[{label:`fires immediately, then at most one trailing call`,args:[],drive:async e=>{let t=[],n=e(e=>t.push(e),40);return n(`a`),n(`b`),n(`c`),await new Promise(e=>setTimeout(e,80)),t},expect:[`a`,`c`]},{label:`fires again once the window has elapsed`,args:[],drive:async e=>{let t=[],n=e(e=>t.push(e),20);return n(1),await new Promise(e=>setTimeout(e,30)),n(2),await new Promise(e=>setTimeout(e,30)),t},expect:[1,2]}],hidden:[{label:`passes the latest arguments to the trailing call`,args:[],drive:async e=>{let t=[],n=e(e=>t.push(e),30);return n(1),n(2),n(3),await new Promise(e=>setTimeout(e,60)),t},expect:[1,3]}],reference:`function throttle(fn, wait) {
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
}`},{kind:`fn`,id:`fn-deep-clone`,title:`Deep Clone`,difficulty:3,category:`collections`,prompt:`Implement deepClone(value): returns a deep copy of objects, arrays, primitives and Dates. Nested structures must be independent of the original — mutating the clone must not affect the source.`,fn:{name:`deepClone`,args:`value`,returns:`deep copy`},starter:`function deepClone(value) {
  // your code here
}`,tests:[{label:`deep-clones nested objects and arrays`,args:[{a:1,b:[1,2,{c:3}],d:null,e:void 0,f:NaN}],expect:{a:1,b:[1,2,{c:3}],d:null,e:void 0,f:NaN}},{label:`returns a distinct reference`,args:[],drive:e=>{let t={x:1};return e(t)!==t},expect:!0},{label:`clones dates with the same instant`,args:[new Date(`2024-01-01T00:00:00Z`)],expect:new Date(`2024-01-01T00:00:00Z`)}],hidden:[{label:`nested arrays stay independent after mutation`,args:[],drive:e=>{let t=[1,[2,[3]]];return e(t)[1].push(99),t[1]},expect:[2,[3]]}],reference:`function deepClone(value, seen = new Map()) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  const out = Array.isArray(value) ? [] : {};
  seen.set(value, out);
  for (const key of Object.keys(value)) {
    out[key] = deepClone(value[key], seen);
  }
  return out;
}`},{kind:`fn`,id:`fn-promise-all`,title:`Promise.all`,difficulty:3,category:`async`,prompt:`Implement promiseAll(promises): returns a promise that resolves with an array of every input's value, in order, or rejects with the first rejection. Works with non-promise values too and with an empty array.`,fn:{name:`promiseAll`,args:`promises`,returns:`Promise<values[]>`},starter:`function promiseAll(promises) {
  // your code here
}`,tests:[{label:`resolves with results in input order`,args:[[Promise.resolve(1),Promise.resolve(2),Promise.resolve(3)]],expect:[1,2,3]},{label:`resolves with an empty array`,args:[[]],expect:[]},{label:`rejects when any promise rejects`,args:[],drive:async e=>{try{return await e([Promise.resolve(1),Promise.reject(Error(`nope`))]),`no-reject`}catch(e){return e.message}},expect:`nope`}],hidden:[{label:`preserves order for mixed-resolution inputs`,args:[],drive:async e=>await e([new Promise(e=>setTimeout(()=>e(`a`),15)),Promise.resolve(`b`),new Promise(e=>setTimeout(()=>e(`c`),5))]),expect:[`a`,`b`,`c`]}],reference:`function promiseAll(promises) {
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
}`},{kind:`fn`,id:`fn-promise-race`,title:`Promise.race`,difficulty:2,category:`async`,prompt:`Implement promiseRace(promises): returns a promise that settles with the first promise to settle — its value if it resolves, its reason if it rejects.`,fn:{name:`promiseRace`,args:`promises`,returns:`Promise<first settled value>`},starter:`function promiseRace(promises) {
  // your code here
}`,tests:[{label:`resolves with the first settled value`,args:[],drive:async e=>await e([new Promise(e=>setTimeout(()=>e(`slow`),30)),Promise.resolve(`fast`)]),expect:`fast`},{label:`rejects if the first settled is a rejection`,args:[],drive:async e=>{try{return await e([Promise.reject(Error(`boom`)),Promise.resolve(1)]),`no-reject`}catch(e){return e.message}},expect:`boom`}],hidden:[{label:`picks the fastest async value`,args:[],drive:async e=>await e([new Promise(e=>setTimeout(()=>e(`a`),20)),new Promise(e=>setTimeout(()=>e(`b`),5))]),expect:`b`}],reference:`function promiseRace(promises) {
  return new Promise((resolve, reject) => {
    for (const p of promises) Promise.resolve(p).then(resolve, reject);
  });
}`},{kind:`fn`,id:`fn-event-emitter`,title:`EventEmitter`,difficulty:3,category:`classes`,prompt:`Implement an EventEmitter class with on(name, fn), off(name, fn), emit(name, ...args) and once(name, fn). off removes a specific listener; once fires the listener at most once and then removes it.`,fn:{name:`EventEmitter`,args:`constructor()`,returns:`class with on/off/emit/once`},starter:`class EventEmitter {
  // your code here
}`,tests:[{label:`on + emit delivers arguments`,args:[],drive:e=>{let t=new e,n=[];return t.on(`ping`,e=>n.push(e)),t.emit(`ping`,42),n},expect:[42]},{label:`off removes a specific listener`,args:[],drive:e=>{let t=new e,n=[],r=e=>n.push(e);return t.on(`a`,r),t.emit(`a`,1),t.off(`a`,r),t.emit(`a`,2),n},expect:[1]},{label:`once fires a single time`,args:[],drive:e=>{let t=new e,n=0;return t.once(`b`,()=>n++),t.emit(`b`),t.emit(`b`),n},expect:1}],hidden:[{label:`all listeners fire on emit`,args:[],drive:e=>{let t=new e,n=0;return t.on(`c`,()=>{n+=1}),t.on(`c`,()=>{n+=10}),t.emit(`c`),n},expect:11}],reference:`class EventEmitter {
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
}`},{kind:`fn`,id:`fn-memoize`,title:`Memoize`,difficulty:2,category:`collections`,prompt:`Implement memoize(fn): returns a memoized version that caches results by argument values (deep, JSON-style keys) so fn runs once per distinct input.`,fn:{name:`memoize`,args:`fn`,returns:`memoized function`},starter:`function memoize(fn) {
  // your code here
}`,tests:[{label:`computes once for repeated equal args`,args:[],drive:e=>{let t=0,n=e(e=>(t++,e*2));return n(4),n(4),t},expect:1},{label:`computes once per distinct argument`,args:[],drive:e=>{let t=[],n=e(e=>(t.push(e),e));return n(1),n(2),n(1),n(3),t},expect:[1,2,3]}],hidden:[{label:`caches object args by value`,args:[],drive:e=>{let t=0,n=e(e=>(t++,e.v*2));return n({v:5}),n({v:5}),t},expect:1}],reference:`function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}`},{kind:`fn`,id:`fn-once`,title:`Once`,difficulty:1,category:`composition`,prompt:`Implement once(fn): returns a function that calls fn only the first time it is invoked, then returns that first result on every later call.`,fn:{name:`once`,args:`fn`,returns:`single-call wrapper`},starter:`function once(fn) {
  // your code here
}`,tests:[{label:`calls the function only once`,args:[],drive:e=>{let t=0,n=e(()=>++t);return n(),n(),n(),t},expect:1},{label:`returns the first result on repeat calls`,args:[],drive:e=>{let t=e(e=>e*10);return[t(1),t(2)]},expect:[10,10]}],hidden:[{label:`captures the first call's arguments`,args:[],drive:e=>{let t=[],n=e((e,n)=>(t.push([e,n]),e+n));return n(2,3),n(9,9),t},expect:[[2,3]]}],reference:`function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (called) return result;
    called = true;
    result = fn.apply(this, args);
    return result;
  };
}`},{kind:`fn`,id:`fn-flatten`,title:`Flatten`,difficulty:2,category:`collections`,prompt:`Implement flatten(arr): returns a new array with all nested arrays flattened to any depth, preserving order.`,fn:{name:`flatten`,args:`arr`,returns:`flat array`},starter:`function flatten(arr) {
  // your code here
}`,tests:[{label:`flattens nested arrays to any depth`,args:[[1,[2,[3,[4]]],5]],expect:[1,2,3,4,5]},{label:`keeps non-array values in order`,args:[[1,[2,3],4]],expect:[1,2,3,4]}],hidden:[{label:`handles empty and nested-empty arrays`,args:[[[],[1,[]],[]]],expect:[1]}],reference:`function flatten(arr) {
  const out = [];
  for (const item of arr) {
    if (Array.isArray(item)) out.push(...flatten(item));
    else out.push(item);
  }
  return out;
}`},{kind:`fn`,id:`fn-uniq`,title:`Uniq`,difficulty:1,category:`collections`,prompt:`Implement uniq(arr): returns a new array with duplicate values removed, keeping the first occurrence's order. NaN counts as equal to NaN.`,fn:{name:`uniq`,args:`arr`,returns:`deduplicated array`},starter:`function uniq(arr) {
  // your code here
}`,tests:[{label:`removes duplicates keeping first-occurrence order`,args:[[1,1,2,3,2,3,4]],expect:[1,2,3,4]},{label:`works with strings`,args:[[`a`,`b`,`a`,`c`]],expect:[`a`,`b`,`c`]}],hidden:[{label:`treats NaN as equal`,args:[[NaN,NaN,1]],expect:[NaN,1]}],reference:`function uniq(arr) {
  return [...new Set(arr)];
}`},{kind:`fn`,id:`fn-chunk`,title:`Chunk`,difficulty:1,category:`collections`,prompt:"Implement chunk(arr, size): splits an array into groups of `size` items, with the final group possibly smaller.",fn:{name:`chunk`,args:`arr, size`,returns:`array of chunks`},starter:`function chunk(arr, size) {
  // your code here
}`,tests:[{label:`splits into chunks of the given size`,args:[[1,2,3,4,5],2],expect:[[1,2],[3,4],[5]]},{label:`works when evenly divisible`,args:[[1,2,3,4],2],expect:[[1,2],[3,4]]}],hidden:[{label:`returns empty for an empty array`,args:[[],3],expect:[]}],reference:`function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}`},{kind:`fn`,id:`fn-group-by`,title:`Group By`,difficulty:2,category:`collections`,prompt:`Implement groupBy(arr, keyFn): returns an object mapping each keyFn(item) result to the array of items producing it, in insertion order.`,fn:{name:`groupBy`,args:`arr, keyFn`,returns:`grouped object`},starter:`function groupBy(arr, keyFn) {
  // your code here
}`,tests:[{label:`groups by a key function`,args:[[1,2,3,4,5],e=>e%2==0?`even`:`odd`],expect:{odd:[1,3,5],even:[2,4]}},{label:`groups objects by a property`,args:[[{t:`a`},{t:`b`},{t:`a`}],e=>e.t],expect:{a:[{t:`a`},{t:`a`}],b:[{t:`b`}]}}],hidden:[{label:`preserves insertion order of groups`,args:[[`x`,`y`,`x`,`z`],e=>e],expect:{x:[`x`,`x`],y:[`y`],z:[`z`]}}],reference:`function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!out[key]) out[key] = [];
    out[key].push(item);
  }
  return out;
}`},{kind:`fn`,id:`fn-pipe`,title:`Pipe`,difficulty:1,category:`composition`,prompt:`Implement pipe(...fns): returns a function that passes its input through each function left to right, threading the result into the next.`,fn:{name:`pipe`,args:`...fns`,returns:`composed function`},starter:`function pipe(...fns) {
  // your code here
}`,tests:[{label:`applies functions left to right`,args:[],drive:e=>e(e=>e+1,e=>e*2)(5),expect:12},{label:`works with a single function`,args:[],drive:e=>e(e=>e*3)(4),expect:12}],hidden:[{label:`threads the value through many steps`,args:[],drive:e=>e(e=>e+2,e=>e*10,e=>e-5)(1),expect:25}],reference:`function pipe(...fns) {
  return (input) => fns.reduce((acc, fn) => fn(acc), input);
}`},{kind:`fn`,id:`fn-compose`,title:`Compose`,difficulty:2,category:`composition`,prompt:`Implement compose(...fns): returns a function that applies the functions right to left — compose(f, g)(x) === f(g(x)).`,fn:{name:`compose`,args:`...fns`,returns:`composed function`},starter:`function compose(...fns) {
  // your code here
}`,tests:[{label:`applies functions right to left`,args:[],drive:e=>e(e=>e*2,e=>e+1)(3),expect:8},{label:`single function identity`,args:[],drive:e=>e(e=>e-1)(10),expect:9}],hidden:[{label:`compose with three functions`,args:[],drive:e=>e(e=>e*3,e=>e+2,e=>e*2)(5),expect:36}],reference:`function compose(...fns) {
  return (input) => fns.reduceRight((acc, fn) => fn(acc), input);
}`},{kind:`fn`,id:`fn-curry`,title:`Curry`,difficulty:3,category:`composition`,prompt:`Implement curry(fn): returns a curried version that keeps collecting arguments until the function's arity (fn.length) is satisfied, then calls fn with all of them.`,fn:{name:`curry`,args:`fn`,returns:`curried function`},starter:`function curry(fn) {
  // your code here
}`,tests:[{label:`curries until the arity is met`,args:[],drive:e=>e((e,t,n)=>e+t+n)(1)(2)(3),expect:6},{label:`accepts multiple args at once`,args:[],drive:e=>e((e,t,n)=>e*t+n)(1,2)(3),expect:5}],hidden:[{label:`partial application two at a time`,args:[],drive:e=>e((e,t)=>e-t)(10)(4),expect:6}],reference:`function curry(fn) {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
}`},{kind:`fn`,id:`fn-sleep`,title:`Sleep`,difficulty:1,category:`async`,prompt:`Implement sleep(ms): returns a promise that resolves (to undefined) after at least ms milliseconds.`,fn:{name:`sleep`,args:`ms`,returns:`Promise<void>`},starter:`function sleep(ms) {
  // your code here
}`,tests:[{label:`resolves after the requested delay`,args:[],drive:async e=>{let t=Date.now();return await e(30),Date.now()-t>=25},expect:!0},{label:`resolves to undefined`,args:[5],expect:void 0}],hidden:[{label:`resolves for a zero delay`,args:[0],expect:void 0}],reference:`function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}`},{kind:`fn`,id:`fn-map-limit`,title:`Map Limit`,difficulty:3,category:`async`,prompt:"Implement mapLimit(items, limit, mapper): returns a promise resolving with mapper(item, index) applied to every item, running at most `limit` mapper calls concurrently, preserving order.",fn:{name:`mapLimit`,args:`items, limit, mapper`,returns:`Promise<results[]>`},starter:`async function mapLimit(items, limit, mapper) {
  // your code here
}`,tests:[{label:`maps all items with correct results`,args:[],drive:async e=>e([1,2,3,4],2,async e=>e*2),expect:[2,4,6,8]},{label:`never runs more than the limit concurrently`,args:[],drive:async e=>{let t=0,n=0;return{results:await e([1,2,3,4,5,6],2,async e=>(t++,n=Math.max(n,t),await new Promise(e=>setTimeout(e,10)),t--,e)),maxActive:n}},expect:{results:[1,2,3,4,5,6],maxActive:2}}],hidden:[{label:`handles a limit larger than the list`,args:[],drive:async e=>e([1,2,3],10,async e=>e+1),expect:[2,3,4]}],reference:`async function mapLimit(items, limit, mapper) {
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
}`},{kind:`fn`,id:`fn-binary-search`,title:`Binary Search`,difficulty:2,category:`search`,prompt:`Implement binarySearch(arr, target): returns the index of target in a sorted array, or -1 if it is not present. Must be O(log n).`,fn:{name:`binarySearch`,args:`arr, target`,returns:`index or -1`},starter:`function binarySearch(arr, target) {
  // your code here
}`,tests:[{label:`finds the target in a sorted array`,args:[[-1,0,3,5,9,12],9],expect:4},{label:`returns -1 when absent`,args:[[-1,0,3,5,9,12],2],expect:-1}],hidden:[{label:`handles a single element`,args:[[7],7],expect:0},{label:`target smaller than everything`,args:[[1,2,3],0],expect:-1}],reference:`function binarySearch(arr, target) {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`},{kind:`fn`,id:`fn-lru-cache`,title:`LRU Cache`,difficulty:3,category:`classes`,prompt:"Implement an LRUCache class with get(key) and put(key, value) that keeps the `capacity` most recently used entries. get returns -1 for missing keys and marks the entry as recently used; put evicts the least recently used entry when over capacity.",fn:{name:`LRUCache`,args:`constructor(capacity)`,returns:`class with get/put`},starter:`class LRUCache {
  // your code here
}`,tests:[{label:`stores and retrieves values`,args:[],drive:e=>{let t=new e(2);return t.put(1,`a`),t.put(2,`b`),[t.get(1),t.get(2)]},expect:[`a`,`b`]},{label:`evicts the least recently used when over capacity`,args:[],drive:e=>{let t=new e(2);return t.put(1,`a`),t.put(2,`b`),t.get(1),t.put(3,`c`),[t.get(1),t.get(2),t.get(3)]},expect:[`a`,-1,`c`]}],hidden:[{label:`returns -1 for missing keys`,args:[],drive:e=>new e(1).get(9),expect:-1}],reference:`class LRUCache {
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
}`},{kind:`fn`,id:`fn-range`,title:`Range`,difficulty:1,category:`collections`,prompt:`Implement range(start, end, step = 1): returns an array of numbers from start up to (not including) end, advancing by step. Support negative steps for descending ranges.`,fn:{name:`range`,args:`start, end, step = 1`,returns:`array of numbers`},starter:`function range(start, end, step = 1) {
  // your code here
}`,tests:[{label:`builds a start-inclusive end-exclusive range`,args:[1,5],expect:[1,2,3,4]},{label:`respects a custom step`,args:[0,10,2],expect:[0,2,4,6,8]}],hidden:[{label:`supports negative steps`,args:[5,1,-1],expect:[5,4,3,2]}],reference:`function range(start, end, step = 1) {
  const out = [];
  if (step === 0) return out;
  if (step > 0) {
    for (let i = start; i < end; i += step) out.push(i);
  } else {
    for (let i = start; i > end; i += step) out.push(i);
  }
  return out;
}`}],a=e=>`import sys

# Input:
#   ${e}
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,o=e=>`// Input:
//   ${e}
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,s=e=>`// Input:
//   ${e}
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,c=e=>`#include <bits/stdc++.h>
using namespace std;

// Input:
//   ${e}
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,l=e=>`import java.util.*;

class Main {
    // Input:
    //   ${e}
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,u=e=>`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   ${e}
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`,d=[{kind:`cli`,id:`reverse-string`,title:`Reverse String`,difficulty:1,prompt:`Reverse the given string.`,io:`Single line: the string. Output: the reversed string.`,starters:{python:a(`single line: string → reversed string`),javascript:o(`single line: string → reversed string`),typescript:s(`single line: string → reversed string`),cpp:c(`single line: string → reversed string`),java:l(`single line: string → reversed string`),go:u(`single line: string → reversed string`)},tests:[{stdin:`hello
`,expect:`olleh`},{stdin:`a
`,expect:`a`},{stdin:`A man a plan
`,expect:`nalp a nam A`}],hidden:[{stdin:`
`,expect:``},{stdin:`racecar
`,expect:`racecar`}],hint:`Split into characters, reverse, join.`,reference:`function solve(lines) {
  return [(lines[0] || "").split("").reverse().join("")];
}`},{kind:`cli`,id:`palindrome`,title:`Palindrome Check`,difficulty:1,prompt:`Determine whether a string reads the same forward and backward, ignoring case. Output true or false.`,io:`Single line: the string. Output: true if a palindrome, otherwise false.`,starters:{python:a(`single line: string → true or false`),javascript:o(`single line: string → true or false`),typescript:s(`single line: string → true or false`),cpp:c(`single line: string → true or false`),java:l(`single line: string → true or false`),go:u(`single line: string → true or false`)},tests:[{stdin:`racecar
`,expect:`true`},{stdin:`Racecar
`,expect:`true`},{stdin:`hello
`,expect:`false`},{stdin:`a
`,expect:`true`}],hidden:[{stdin:`
`,expect:`true`},{stdin:`never odd or even
`,expect:`false`}],hint:`Compare the lowercased string with its reverse.`,reference:`function solve(lines) {
  const s = (lines[0] || "").toLowerCase();
  return [String(s === s.split("").reverse().join(""))];
}`},{kind:`cli`,id:`contains-duplicate`,title:`Contains Duplicate`,difficulty:1,prompt:`Given an array of integers, output true if any value appears at least twice, otherwise false.`,io:`Line 1: n (array length) · Line 2: n space-separated integers. Output: true or false.`,starters:{python:a(`Line 1: n · Line 2: n ints → true or false`),javascript:o(`Line 1: n · Line 2: n ints → true or false`),typescript:s(`Line 1: n · Line 2: n ints → true or false`),cpp:c(`Line 1: n · Line 2: n ints → true or false`),java:l(`Line 1: n · Line 2: n ints → true or false`),go:u(`Line 1: n · Line 2: n ints → true or false`)},tests:[{stdin:`4
1 2 3 1
`,expect:`true`},{stdin:`4
1 2 3 4
`,expect:`false`},{stdin:`3
1 1 1
`,expect:`true`}],hidden:[{stdin:`0

`,expect:`false`},{stdin:`2
-1 -1
`,expect:`true`}],hint:`A Set is shorter than the array iff a duplicate exists.`,reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  return [String(new Set(arr).size !== arr.length)];
}`},{kind:`cli`,id:`valid-anagram`,title:`Valid Anagram`,difficulty:1,prompt:`Given two strings, output true if they are anagrams (same characters with the same counts), otherwise false.`,io:`Line 1: first string · Line 2: second string. Output: true or false.`,starters:{python:a(`Line 1: s · Line 2: t → true or false`),javascript:o(`Line 1: s · Line 2: t → true or false`),typescript:s(`Line 1: s · Line 2: t → true or false`),cpp:c(`Line 1: s · Line 2: t → true or false`),java:l(`Line 1: s · Line 2: t → true or false`),go:u(`Line 1: s · Line 2: t → true or false`)},tests:[{stdin:`anagram
nagaram
`,expect:`true`},{stdin:`rat
car
`,expect:`false`},{stdin:`a
a
`,expect:`true`},{stdin:`ab
ba
`,expect:`true`}],hidden:[{stdin:`abc
abd
`,expect:`false`},{stdin:`

`,expect:`true`}],hint:`Two strings are anagrams iff sorting their characters gives the same result.`,reference:`function solve(lines) {
  const key = (s) => (s || "").split("").sort().join("");
  return [String(key(lines[0]) === key(lines[1]))];
}`},{kind:`cli`,id:`fibonacci`,title:`Fibonacci`,difficulty:1,prompt:`Output the n-th Fibonacci number, 0-indexed: fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2).`,io:`Single line: n. Output: the n-th Fibonacci number.`,starters:{python:a(`single line: n → fib(n)`),javascript:o(`single line: n → fib(n)`),typescript:s(`single line: n → fib(n)`),cpp:c(`single line: n → fib(n)`),java:l(`single line: n → fib(n)`),go:u(`single line: n → fib(n)`)},tests:[{stdin:`0
`,expect:`0`},{stdin:`1
`,expect:`1`},{stdin:`10
`,expect:`55`},{stdin:`20
`,expect:`6765`}],hidden:[{stdin:`2
`,expect:`1`},{stdin:`30
`,expect:`832040`}],hint:`Iterate with two running values — O(n) time, O(1) space.`,reference:`function solve(lines) {
  const n = Number(lines[0] || 0);
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; }
  return [String(a)];
}`},{kind:`cli`,id:`merge-sorted`,title:`Merge Sorted Arrays`,difficulty:2,prompt:`Merge two sorted arrays into one sorted array.`,io:`Line 1: n m (lengths) · Line 2: n sorted integers · Line 3: m sorted integers. Output: the merged, sorted array.`,starters:{python:a(`Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints`),javascript:o(`Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints`),typescript:s(`Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints`),cpp:c(`Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints`),java:l(`Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints`),go:u(`Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints`)},tests:[{stdin:`3 3
1 2 4
1 3 4
`,expect:`1 1 2 3 4 4`},{stdin:`0 1

2
`,expect:`2`},{stdin:`2 0
1 5

`,expect:`1 5`},{stdin:`3 2
1 3 5
2 4
`,expect:`1 2 3 4 5`}],hidden:[{stdin:`1 1
0
0
`,expect:`0 0`},{stdin:`0 0


`,expect:``}],hint:`Two pointers from the front, appending the smaller element each step.`,reference:`function solve(lines) {
  const a = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const b = (lines[2] || "").split(" ").filter(Boolean).map(Number);
  const out = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] <= b[j])) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return [out.join(" ")];
}`},{kind:`cli`,id:`longest-common-prefix`,title:`Longest Common Prefix`,difficulty:2,prompt:`Given a list of strings, output their longest common prefix (empty string if there is none).`,io:`Line 1: n · next n lines: the strings. Output: the common prefix.`,starters:{python:a(`Line 1: n · next n lines: strings → longest common prefix`),javascript:o(`Line 1: n · next n lines: strings → longest common prefix`),typescript:s(`Line 1: n · next n lines: strings → longest common prefix`),cpp:c(`Line 1: n · next n lines: strings → longest common prefix`),java:l(`Line 1: n · next n lines: strings → longest common prefix`),go:u(`Line 1: n · next n lines: strings → longest common prefix`)},tests:[{stdin:`3
flower
flow
flight
`,expect:`fl`},{stdin:`3
dog
racecar
car
`,expect:``},{stdin:`1
alone
`,expect:`alone`}],hidden:[{stdin:`2

x
`,expect:``},{stdin:`2
interspecies
interstellar
`,expect:`inters`}],hint:`Start with the first string as the prefix and shrink it against each next string.`,reference:`function solve(lines) {
  const n = Number(lines[0] || 0);
  const strs = lines.slice(1, 1 + n).map(s => s ?? "");
  if (!strs.length) return [""];
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return [prefix];
}`},{kind:`cli`,id:`first-unique-char`,title:`First Unique Character`,difficulty:2,prompt:`Output the index of the first non-repeating character in the string, or -1 if every character repeats.`,io:`Single line: the string. Output: the index or -1.`,starters:{python:a(`single line: string → index of first unique char or -1`),javascript:o(`single line: string → index of first unique char or -1`),typescript:s(`single line: string → index of first unique char or -1`),cpp:c(`single line: string → index of first unique char or -1`),java:l(`single line: string → index of first unique char or -1`),go:u(`single line: string → index of first unique char or -1`)},tests:[{stdin:`leetcode
`,expect:`0`},{stdin:`loveleetcode
`,expect:`2`},{stdin:`aabb
`,expect:`-1`},{stdin:`a
`,expect:`0`}],hidden:[{stdin:`
`,expect:`-1`},{stdin:`abcdefghijklmnopqrstuvwxyz
`,expect:`0`}],hint:`Count occurrences in one pass, then scan for the first char with count 1.`,reference:`function solve(lines) {
  const s = lines[0] || "";
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (let i = 0; i < s.length; i++) if (counts.get(s[i]) === 1) return [String(i)];
  return ["-1"];
}`},{kind:`cli`,id:`move-zeroes`,title:`Move Zeroes`,difficulty:2,prompt:`Move all zeros in the array to the end while preserving the relative order of the non-zero elements.`,io:`Line 1: n · Line 2: n space-separated integers. Output: the rearranged array.`,starters:{python:a(`Line 1: n · Line 2: n ints → array with zeros at the end`),javascript:o(`Line 1: n · Line 2: n ints → array with zeros at the end`),typescript:s(`Line 1: n · Line 2: n ints → array with zeros at the end`),cpp:c(`Line 1: n · Line 2: n ints → array with zeros at the end`),java:l(`Line 1: n · Line 2: n ints → array with zeros at the end`),go:u(`Line 1: n · Line 2: n ints → array with zeros at the end`)},tests:[{stdin:`5
0 1 0 3 12
`,expect:`1 3 12 0 0`},{stdin:`1
0
`,expect:`0`},{stdin:`3
1 2 3
`,expect:`1 2 3`},{stdin:`3
0 0 1
`,expect:`1 0 0`}],hidden:[{stdin:`4
0 0 0 0
`,expect:`0 0 0 0`},{stdin:`5
4 0 5 0 6
`,expect:`4 5 6 0 0`}],hint:`A write pointer overwrites non-zeros in order; fill the tail with zeros.`,reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let write = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] !== 0) arr[write++] = arr[i];
  while (write < arr.length) arr[write++] = 0;
  return [arr.join(" ")];
}`},{kind:`cli`,id:`missing-number`,title:`Missing Number`,difficulty:2,prompt:`Given n distinct integers in the range [0, n], output the one integer from that range that is missing.`,io:`Line 1: n · Line 2: n space-separated integers. Output: the missing integer.`,starters:{python:a(`Line 1: n · Line 2: n distinct ints in [0, n] → the missing int`),javascript:o(`Line 1: n · Line 2: n distinct ints in [0, n] → the missing int`),typescript:s(`Line 1: n · Line 2: n distinct ints in [0, n] → the missing int`),cpp:c(`Line 1: n · Line 2: n distinct ints in [0, n] → the missing int`),java:l(`Line 1: n · Line 2: n distinct ints in [0, n] → the missing int`),go:u(`Line 1: n · Line 2: n distinct ints in [0, n] → the missing int`)},tests:[{stdin:`3
3 0 1
`,expect:`2`},{stdin:`2
0 1
`,expect:`2`},{stdin:`1
0
`,expect:`1`}],hidden:[{stdin:`8
9 6 4 2 3 5 7 0 1
`,expect:`8`},{stdin:`2
0 2
`,expect:`1`}],hint:`Sum of 0..n minus the sum of the array gives the missing number.`,reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const n = arr.length;
  return [String((n * (n + 1)) / 2 - arr.reduce((a, b) => a + b, 0))];
}`},{kind:`cli`,id:`majority-element`,title:`Majority Element`,difficulty:2,prompt:`Given an array where one element appears more than n/2 times, output that element.`,io:`Line 1: n · Line 2: n space-separated integers. Output: the majority element.`,starters:{python:a(`Line 1: n · Line 2: n ints → the majority element`),javascript:o(`Line 1: n · Line 2: n ints → the majority element`),typescript:s(`Line 1: n · Line 2: n ints → the majority element`),cpp:c(`Line 1: n · Line 2: n ints → the majority element`),java:l(`Line 1: n · Line 2: n ints → the majority element`),go:u(`Line 1: n · Line 2: n ints → the majority element`)},tests:[{stdin:`3
3 2 3
`,expect:`3`},{stdin:`7
2 2 1 1 1 2 2
`,expect:`2`},{stdin:`1
1
`,expect:`1`}],hidden:[{stdin:`5
-1 -1 -1 2 2
`,expect:`-1`},{stdin:`9
6 6 6 1 2 3 6 6 6
`,expect:`6`}],hint:`Boyer-Moore: cancel different pairs; the survivor is the majority.`,reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let candidate = arr[0], count = 0;
  for (const x of arr) {
    if (count === 0) candidate = x;
    count += x === candidate ? 1 : -1;
  }
  return [String(candidate)];
}`},{kind:`cli`,id:`rotate-array`,title:`Rotate Array`,difficulty:2,prompt:`Rotate the array to the right by k steps.`,io:`Line 1: n k · Line 2: n space-separated integers. Output: the rotated array.`,starters:{python:a(`Line 1: n k · Line 2: n ints → array rotated right by k`),javascript:o(`Line 1: n k · Line 2: n ints → array rotated right by k`),typescript:s(`Line 1: n k · Line 2: n ints → array rotated right by k`),cpp:c(`Line 1: n k · Line 2: n ints → array rotated right by k`),java:l(`Line 1: n k · Line 2: n ints → array rotated right by k`),go:u(`Line 1: n k · Line 2: n ints → array rotated right by k`)},tests:[{stdin:`7 3
1 2 3 4 5 6 7
`,expect:`5 6 7 1 2 3 4`},{stdin:`4 2
-1 -100 3 99
`,expect:`3 99 -1 -100`},{stdin:`2 3
1 2
`,expect:`2 1`},{stdin:`3 0
1 2 3
`,expect:`1 2 3`}],hidden:[{stdin:`5 7
1 2 3 4 5
`,expect:`4 5 1 2 3`},{stdin:`1 10
9
`,expect:`9`}],hint:`Normalize k modulo n, then slice the last k elements in front.`,reference:`function solve(lines) {
  const [n, k] = (lines[0] || "").split(" ").map(Number);
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  if (!n) return [""];
  const r = ((k % n) + n) % n;
  return [arr.slice(n - r).concat(arr.slice(0, n - r)).join(" ")];
}`},{kind:`cli`,id:`climbing-stairs`,title:`Climbing Stairs`,difficulty:2,prompt:`You can climb 1 or 2 steps at a time. Output the number of distinct ways to reach the top of n stairs.`,io:`Single line: n. Output: the number of ways.`,starters:{python:a(`single line: n → number of ways to climb n stairs`),javascript:o(`single line: n → number of ways to climb n stairs`),typescript:s(`single line: n → number of ways to climb n stairs`),cpp:c(`single line: n → number of ways to climb n stairs`),java:l(`single line: n → number of ways to climb n stairs`),go:u(`single line: n → number of ways to climb n stairs`)},tests:[{stdin:`2
`,expect:`2`},{stdin:`3
`,expect:`3`},{stdin:`4
`,expect:`5`},{stdin:`10
`,expect:`89`}],hidden:[{stdin:`1
`,expect:`1`},{stdin:`45
`,expect:`1836311903`}],hint:`ways(n) = ways(n-1) + ways(n-2) — iterate with two variables.`,reference:`function solve(lines) {
  const n = Number(lines[0] || 0);
  if (n <= 2) return [String(n === 0 ? 0 : n === 1 ? 1 : 2)];
  let a = 1, b = 2;
  for (let i = 3; i <= n; i++) { const t = a + b; a = b; b = t; }
  return [String(b)];
}`},{kind:`cli`,id:`intersection`,title:`Intersection of Two Arrays`,difficulty:2,prompt:`Output the unique values present in both arrays, in the order they first appear in the first array.`,io:`Line 1: n m · Line 2: n integers · Line 3: m integers. Output: the intersection, space-separated (empty line if none).`,starters:{python:a(`Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order`),javascript:o(`Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order`),typescript:s(`Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order`),cpp:c(`Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order`),java:l(`Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order`),go:u(`Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order`)},tests:[{stdin:`4 2
1 2 2 1
2 2
`,expect:`2`},{stdin:`3 4
4 9 5
9 4 9 8 4
`,expect:`4 9`},{stdin:`1 1
1
2
`,expect:``}],hidden:[{stdin:`0 2

7 8
`,expect:``},{stdin:`5 3
1 2 3 4 5
5 4 3
`,expect:`3 4 5`}],hint:`Put the second array in a Set, then scan the first array for members you haven't emitted yet.`,reference:`function solve(lines) {
  const a = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const b = new Set((lines[2] || "").split(" ").filter(Boolean).map(Number));
  const seen = new Set();
  const out = [];
  for (const x of a) {
    if (b.has(x) && !seen.has(x)) { seen.add(x); out.push(x); }
  }
  return [out.join(" ")];
}`}],f=`// Wire up the component's behavior here.
// The judge checks the rendered DOM after real clicks / input events.`,p=[{kind:`ui`,id:`ui-counter`,title:`Counter`,difficulty:1,category:`interaction`,prompt:`Build a counter: clicking + increments the displayed number, clicking − decrements it. The count must never go out of sync with the display.`,html:`<div class="counter">
  <button id="minus" aria-label="Decrease">−</button>
  <span id="value">0</span>
  <button id="plus" aria-label="Increase">+</button>
</div>`,css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:f,assertions:[{label:`starts at 0`,check:`return document.querySelector('#value').textContent.trim() === '0';`},{label:`increments on +`,check:`document.querySelector('#plus').click(); await sleep(20); return document.querySelector('#value').textContent.trim() === '1';`},{label:`decrements on −`,check:`document.querySelector('#minus').click(); document.querySelector('#minus').click(); await sleep(20); return document.querySelector('#value').textContent.trim() === '-1';`}],hiddenAssertions:[{label:`handles rapid sequences consistently`,check:`document.querySelector('#plus').click(); document.querySelector('#plus').click(); document.querySelector('#minus').click(); await sleep(20); return document.querySelector('#value').textContent.trim() === '0';`}],hint:`Attach click listeners to both buttons and update #value from its current textContent.`,reference:{html:`<div class="counter">
  <button id="minus" aria-label="Decrease">−</button>
  <span id="value">0</span>
  <button id="plus" aria-label="Increase">+</button>
</div>`,css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:`const value = document.querySelector('#value');
document.querySelector('#plus').addEventListener('click', () => {
  value.textContent = Number(value.textContent) + 1;
});
document.querySelector('#minus').addEventListener('click', () => {
  value.textContent = Number(value.textContent) - 1;
});`}},{kind:`ui`,id:`ui-accordion`,title:`Accordion`,difficulty:2,category:`interaction`,prompt:`Build an accordion: clicking a header opens its panel, opening one closes the others. aria-expanded on each header must track its open state.`,html:`<div class="accordion">
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">What is InterviewIQ? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>An AI interviewer that prepares you for technical interviews.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Is it free? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>Yes — a free tier plus an optional Pro plan.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Which levels? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>From junior developer all the way to CEO.</p></div>
  </section>
</div>`,css:`.accordion { max-width: 420px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.acc-panel { display: none; padding: 4px 12px 12px; color: #475569; }
.acc-item.open .acc-panel { display: block; }
.acc-head { width: 100%; text-align: left; padding: 12px; font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; }`,js:f,assertions:[{label:`all panels closed initially`,check:`return [...document.querySelectorAll('.acc-panel')].every(p => getComputedStyle(p).display === 'none');`},{label:`clicking a header opens its panel`,check:`document.querySelectorAll('.acc-head')[1].click(); await sleep(20); return getComputedStyle(document.querySelectorAll('.acc-panel')[1]).display !== 'none';`},{label:`opening one closes the others`,check:`document.querySelectorAll('.acc-head')[0].click(); await sleep(20); const open = [...document.querySelectorAll('.acc-item')].filter(i => i.classList.contains('open')); return open.length === 1 && open[0] === document.querySelectorAll('.acc-item')[0];`}],hiddenAssertions:[{label:`aria-expanded tracks state`,check:`const heads = document.querySelectorAll('.acc-head'); heads[2].click(); await sleep(20); return heads[2].getAttribute('aria-expanded') === 'true' && heads[0].getAttribute('aria-expanded') === 'false';`}],hint:`Toggle an .open class on the clicked .acc-item while removing it from every other item; mirror it in aria-expanded.`,reference:{html:`<div class="accordion">
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">What is InterviewIQ? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>An AI interviewer that prepares you for technical interviews.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Is it free? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>Yes — a free tier plus an optional Pro plan.</p></div>
  </section>
  <section class="acc-item">
    <button class="acc-head" aria-expanded="false">Which levels? <span class="acc-icon">+</span></button>
    <div class="acc-panel"><p>From junior developer all the way to CEO.</p></div>
  </section>
</div>`,css:`.accordion { max-width: 420px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.acc-panel { display: none; padding: 4px 12px 12px; color: #475569; }
.acc-item.open .acc-panel { display: block; }
.acc-head { width: 100%; text-align: left; padding: 12px; font-weight: 600; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; display: flex; justify-content: space-between; }`,js:`document.querySelectorAll('.acc-head').forEach(head => {
  head.addEventListener('click', () => {
    const item = head.closest('.acc-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.acc-item').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.acc-head').setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      head.setAttribute('aria-expanded', 'true');
    }
  });
});`}},{kind:`ui`,id:`ui-tabs`,title:`Tabs`,difficulty:2,category:`interaction`,prompt:`Build a tab panel: clicking a tab shows its panel and marks the tab active. Exactly one panel must be visible at a time, and aria-selected must follow the active tab.`,html:`<div class="tabs">
  <div class="tab-list" role="tablist">
    <button class="tab active" data-tab="tab1" role="tab" aria-selected="true">Overview</button>
    <button class="tab" data-tab="tab2" role="tab" aria-selected="false">Pricing</button>
    <button class="tab" data-tab="tab3" role="tab" aria-selected="false">FAQ</button>
  </div>
  <div class="tab-panel active" id="tab1"><p>Overview content.</p></div>
  <div class="tab-panel" id="tab2"><p>Pricing content.</p></div>
  <div class="tab-panel" id="tab3"><p>FAQ content.</p></div>
</div>`,css:`.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,js:f,assertions:[{label:`first panel visible initially`,check:`return getComputedStyle(document.getElementById('tab1')).display !== 'none' && getComputedStyle(document.getElementById('tab2')).display === 'none';`},{label:`clicking a tab shows its panel`,check:`document.querySelectorAll('.tab')[1].click(); await sleep(20); return getComputedStyle(document.getElementById('tab2')).display !== 'none' && getComputedStyle(document.getElementById('tab1')).display === 'none';`},{label:`exactly one panel visible`,check:`document.querySelectorAll('.tab')[2].click(); await sleep(20); return document.querySelectorAll('.tab-panel.active').length === 1;`}],hiddenAssertions:[{label:`aria-selected follows the active tab`,check:`document.querySelectorAll('.tab')[1].click(); await sleep(20); return document.querySelectorAll('.tab')[1].getAttribute('aria-selected') === 'true' && document.querySelectorAll('.tab')[0].getAttribute('aria-selected') === 'false';`}],hint:`On click: clear .active from every tab and panel, then add it to the clicked tab and its data-tab panel.`,reference:{html:`<div class="tabs">
  <div class="tab-list" role="tablist">
    <button class="tab active" data-tab="tab1" role="tab" aria-selected="true">Overview</button>
    <button class="tab" data-tab="tab2" role="tab" aria-selected="false">Pricing</button>
    <button class="tab" data-tab="tab3" role="tab" aria-selected="false">FAQ</button>
  </div>
  <div class="tab-panel active" id="tab1"><p>Overview content.</p></div>
  <div class="tab-panel" id="tab2"><p>Pricing content.</p></div>
  <div class="tab-panel" id="tab3"><p>FAQ content.</p></div>
</div>`,css:`.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,js:`document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});`}},{kind:`ui`,id:`ui-star-rating`,title:`Star Rating`,difficulty:2,category:`interaction`,prompt:`Build a 5-star rating: clicking a star fills every star up to and including it (and the clicked value becomes the rating). Clicking a lower star lowers the rating.`,html:`<div class="rating" data-value="0">
  <button class="star" data-star="1" aria-label="1 star">☆</button>
  <button class="star" data-star="2" aria-label="2 stars">☆</button>
  <button class="star" data-star="3" aria-label="3 stars">☆</button>
  <button class="star" data-star="4" aria-label="4 stars">☆</button>
  <button class="star" data-star="5" aria-label="5 stars">☆</button>
</div>`,css:`.star { font-size: 32px; background: none; border: none; cursor: pointer; color: #cbd5e1; padding: 2px; }
.star.active { color: #f59e0b; }`,js:f,assertions:[{label:`no stars active initially`,check:`return document.querySelectorAll('.star.active').length === 0;`},{label:`clicking the third star fills three`,check:`document.querySelectorAll('.star')[2].click(); await sleep(20); return document.querySelectorAll('.star.active').length === 3 && document.querySelector('.rating').dataset.value === '3';`},{label:`re-clicking a lower star lowers the rating`,check:`document.querySelectorAll('.star')[1].click(); await sleep(20); return document.querySelectorAll('.star.active').length === 2;`}],hiddenAssertions:[{label:`clicking the top star twice keeps it at five`,check:`document.querySelectorAll('.star')[4].click(); await sleep(20); const first = document.querySelectorAll('.star.active').length; document.querySelectorAll('.star')[4].click(); await sleep(20); return first === 5 && document.querySelectorAll('.star.active').length === 5;`}],hint:`On click, compare each star's data-star against the clicked value and toggle .active (and ★/☆) accordingly.`,reference:{html:`<div class="rating" data-value="0">
  <button class="star" data-star="1" aria-label="1 star">☆</button>
  <button class="star" data-star="2" aria-label="2 stars">☆</button>
  <button class="star" data-star="3" aria-label="3 stars">☆</button>
  <button class="star" data-star="4" aria-label="4 stars">☆</button>
  <button class="star" data-star="5" aria-label="5 stars">☆</button>
</div>`,css:`.star { font-size: 32px; background: none; border: none; cursor: pointer; color: #cbd5e1; padding: 2px; }
.star.active { color: #f59e0b; }`,js:`const rating = document.querySelector('.rating');
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', () => {
    const value = Number(star.dataset.star);
    rating.dataset.value = String(value);
    document.querySelectorAll('.star').forEach(s => {
      const active = Number(s.dataset.star) <= value;
      s.classList.toggle('active', active);
      s.textContent = active ? '★' : '☆';
    });
  });
});`}},{kind:`ui`,id:`ui-todo`,title:`Todo List`,difficulty:2,category:`interaction`,prompt:`Build a todo list: submitting the form adds a non-empty todo, empty input is ignored, and each item has a delete button that removes it.`,html:`<div class="todo">
  <form id="todo-form">
    <input id="todo-input" placeholder="What needs doing?" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
  <ul id="todo-list"></ul>
</div>`,css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:f,assertions:[{label:`starts empty`,check:`return document.querySelectorAll('#todo-list li').length === 0;`},{label:`adds a todo`,check:`const input = document.querySelector('#todo-input'); input.value = 'Learn debounce'; document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelectorAll('#todo-list li').length === 1 && document.querySelector('#todo-list').textContent.includes('Learn debounce');`},{label:`ignores empty input`,check:`const input = document.querySelector('#todo-input'); input.value = '   '; document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelectorAll('#todo-list li').length === 1;`}],hiddenAssertions:[{label:`delete removes the todo`,check:`document.querySelector('.del').click(); await sleep(20); return document.querySelectorAll('#todo-list li').length === 0;`}],hint:`Listen for submit, preventDefault, trim the input, and build each item with its own delete listener.`,reference:{html:`<div class="todo">
  <form id="todo-form">
    <input id="todo-input" placeholder="What needs doing?" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
  <ul id="todo-list"></ul>
</div>`,css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:`const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const list = document.querySelector('#todo-list');
const esc = (s) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const li = document.createElement('li');
  li.innerHTML = '<span>' + esc(text) + '</span><button class="del" aria-label="Delete">✕</button>';
  li.querySelector('.del').addEventListener('click', () => li.remove());
  list.appendChild(li);
  input.value = '';
});`}},{kind:`ui`,id:`ui-modal`,title:`Modal Dialog`,difficulty:2,category:`interaction`,prompt:`Build a modal: hidden by default, opened by the trigger button, closed by the Close button and by clicking the backdrop.`,html:`<div class="modal-wrap">
  <button id="open-modal">Open modal</button>
  <div class="modal-overlay" id="modal-overlay" hidden>
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Welcome back</h3>
      <p>This is a modal dialog.</p>
      <button id="close-modal">Close</button>
    </div>
  </div>
</div>`,css:`.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; font-family: system-ui; }
.modal { background: #fff; padding: 24px; border-radius: 12px; max-width: 320px; }
#open-modal { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,js:f,assertions:[{label:`hidden initially`,check:`return document.querySelector('#modal-overlay').hidden === true;`},{label:`opens on the trigger click`,check:`document.querySelector('#open-modal').click(); await sleep(20); return document.querySelector('#modal-overlay').hidden === false;`},{label:`closes via the close button`,check:`document.querySelector('#close-modal').click(); await sleep(20); return document.querySelector('#modal-overlay').hidden === true;`}],hiddenAssertions:[{label:`closes when the backdrop is clicked`,check:`document.querySelector('#open-modal').click(); await sleep(20); document.querySelector('#modal-overlay').click(); await sleep(20); return document.querySelector('#modal-overlay').hidden === true;`}],hint:`Toggle the overlay's hidden attribute; on backdrop clicks only close when the click target IS the overlay itself.`,reference:{html:`<div class="modal-wrap">
  <button id="open-modal">Open modal</button>
  <div class="modal-overlay" id="modal-overlay" hidden>
    <div class="modal" role="dialog" aria-modal="true">
      <h3>Welcome back</h3>
      <p>This is a modal dialog.</p>
      <button id="close-modal">Close</button>
    </div>
  </div>
</div>`,css:`.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; font-family: system-ui; }
.modal { background: #fff; padding: 24px; border-radius: 12px; max-width: 320px; }
#open-modal { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,js:`const overlay = document.querySelector('#modal-overlay');
document.querySelector('#open-modal').addEventListener('click', () => { overlay.hidden = false; });
document.querySelector('#close-modal').addEventListener('click', () => { overlay.hidden = true; });
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });`}},{kind:`ui`,id:`ui-dropdown`,title:`Dropdown Select`,difficulty:2,category:`interaction`,prompt:`Build a dropdown: clicking the trigger toggles the menu, selecting an option updates the trigger label and closes the menu.`,html:`<div class="dropdown">
  <button id="dd-trigger">Select a color ▾</button>
  <ul class="dd-menu" id="dd-menu" hidden>
    <li data-value="red">Red</li>
    <li data-value="green">Green</li>
    <li data-value="blue">Blue</li>
  </ul>
</div>`,css:`.dropdown { position: relative; display: inline-block; font-family: system-ui; }
#dd-trigger { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.dd-menu { position: absolute; top: 100%; margin: 4px 0 0; padding: 4px; list-style: none; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 140px; }
.dd-menu li { padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.dd-menu li:hover { background: #f1f5f9; }`,js:f,assertions:[{label:`menu closed initially`,check:`return document.querySelector('#dd-menu').hidden === true;`},{label:`clicking the trigger opens the menu`,check:`document.querySelector('#dd-trigger').click(); await sleep(20); return document.querySelector('#dd-menu').hidden === false;`},{label:`selecting an option updates the trigger and closes`,check:`document.querySelectorAll('#dd-menu li')[1].click(); await sleep(20); return document.querySelector('#dd-trigger').textContent.includes('Green') && document.querySelector('#dd-menu').hidden === true;`}],hiddenAssertions:[{label:`the trigger toggles the menu`,check:`document.querySelector('#dd-trigger').click(); await sleep(20); const opened = document.querySelector('#dd-menu').hidden === false; document.querySelector('#dd-trigger').click(); await sleep(20); return opened && document.querySelector('#dd-menu').hidden === true;`}],hint:`Toggle the menu's hidden attribute on trigger clicks; each option click sets the label and hides the menu.`,reference:{html:`<div class="dropdown">
  <button id="dd-trigger">Select a color ▾</button>
  <ul class="dd-menu" id="dd-menu" hidden>
    <li data-value="red">Red</li>
    <li data-value="green">Green</li>
    <li data-value="blue">Blue</li>
  </ul>
</div>`,css:`.dropdown { position: relative; display: inline-block; font-family: system-ui; }
#dd-trigger { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.dd-menu { position: absolute; top: 100%; margin: 4px 0 0; padding: 4px; list-style: none; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 140px; }
.dd-menu li { padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.dd-menu li:hover { background: #f1f5f9; }`,js:`const trigger = document.querySelector('#dd-trigger');
const menu = document.querySelector('#dd-menu');
trigger.addEventListener('click', () => { menu.hidden = !menu.hidden; });
menu.querySelectorAll('li').forEach(li => {
  li.addEventListener('click', () => {
    trigger.textContent = li.textContent + ' ▾';
    menu.hidden = true;
  });
});`}},{kind:`ui`,id:`ui-progress-bar`,title:`Progress Bar`,difficulty:2,category:`interaction`,prompt:`Build a progress bar: +10% grows the fill (capped at 100%), Reset returns it to 0%.`,html:`<div class="progress-wrap">
  <div class="progress"><div class="fill" id="fill" style="width:0%"></div></div>
  <button id="progress-plus">+10%</button>
  <button id="progress-reset">Reset</button>
</div>`,css:`.progress { height: 18px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 12px; }
.fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); transition: width .2s; }
.progress-wrap { max-width: 360px; font-family: system-ui; }
.progress-wrap button { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,js:f,assertions:[{label:`starts at 0%`,check:`return document.querySelector('#fill').style.width === '0%';`},{label:`increments by 10%`,check:`document.querySelector('#progress-plus').click(); document.querySelector('#progress-plus').click(); await sleep(20); return document.querySelector('#fill').style.width === '20%';`},{label:`caps at 100%`,check:`for (let i = 0; i < 12; i++) document.querySelector('#progress-plus').click(); await sleep(20); return document.querySelector('#fill').style.width === '100%';`}],hiddenAssertions:[{label:`reset returns to 0%`,check:`document.querySelector('#progress-reset').click(); await sleep(20); return document.querySelector('#fill').style.width === '0%';`}],hint:`Parse the current width, clamp to 100, and write it back as a percentage.`,reference:{html:`<div class="progress-wrap">
  <div class="progress"><div class="fill" id="fill" style="width:0%"></div></div>
  <button id="progress-plus">+10%</button>
  <button id="progress-reset">Reset</button>
</div>`,css:`.progress { height: 18px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 12px; }
.fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); transition: width .2s; }
.progress-wrap { max-width: 360px; font-family: system-ui; }
.progress-wrap button { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,js:`const fill = document.querySelector('#fill');
const current = () => Number(fill.style.width.replace('%', '')) || 0;
document.querySelector('#progress-plus').addEventListener('click', () => {
  fill.style.width = Math.min(100, current() + 10) + '%';
});
document.querySelector('#progress-reset').addEventListener('click', () => { fill.style.width = '0%'; });`}},{kind:`ui`,id:`ui-autocomplete`,title:`Autocomplete`,difficulty:3,category:`interaction`,prompt:`Build an autocomplete: typing filters a fixed dataset, suggestions show in the list, clicking a suggestion fills the input, and no matches hides the list.`,html:`<div class="autocomplete">
  <input id="ac-input" placeholder="Type a language…" autocomplete="off" />
  <ul id="ac-list" class="ac-list" hidden></ul>
</div>`,css:`.ac-list { list-style: none; margin: 4px 0 0; padding: 4px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 180px; overflow: auto; font-family: system-ui; }
.ac-list li { padding: 6px 10px; cursor: pointer; border-radius: 6px; }
.ac-list li:hover { background: #f1f5f9; }
#ac-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 240px; font-family: system-ui; }`,js:f,assertions:[{label:`no suggestions when empty`,check:`return document.querySelector('#ac-list').hidden === true;`},{label:`typing filters suggestions`,check:`const input = document.querySelector('#ac-input'); input.value = 'py'; input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); const items = [...document.querySelectorAll('#ac-list li')].map(li => li.textContent); return items.length === 1 && items[0] === 'Python';`},{label:`clicking a suggestion fills the input`,check:`document.querySelector('#ac-list li').click(); await sleep(20); return document.querySelector('#ac-input').value === 'Python' && document.querySelector('#ac-list').hidden === true;`}],hiddenAssertions:[{label:`no matches hides the list`,check:`const input = document.querySelector('#ac-input'); input.value = 'zzz'; input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return document.querySelector('#ac-list').hidden === true;`}],hint:`On each input event, re-render the list from a filter of the dataset; hide it when the query is empty or has no matches.`,reference:{html:`<div class="autocomplete">
  <input id="ac-input" placeholder="Type a language…" autocomplete="off" />
  <ul id="ac-list" class="ac-list" hidden></ul>
</div>`,css:`.ac-list { list-style: none; margin: 4px 0 0; padding: 4px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 180px; overflow: auto; font-family: system-ui; }
.ac-list li { padding: 6px 10px; cursor: pointer; border-radius: 6px; }
.ac-list li:hover { background: #f1f5f9; }
#ac-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 240px; font-family: system-ui; }`,js:`const DATA = ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'Ruby', 'Swift', 'Kotlin'];
const input = document.querySelector('#ac-input');
const list = document.querySelector('#ac-list');
input.addEventListener('input', () => {
  const q = input.value.trim().toLowerCase();
  list.innerHTML = '';
  const matches = DATA.filter(d => d.toLowerCase().includes(q));
  if (!q || !matches.length) { list.hidden = true; return; }
  matches.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m;
    li.addEventListener('click', () => { input.value = m; list.hidden = true; });
    list.appendChild(li);
  });
  list.hidden = false;
});`}},{kind:`ui`,id:`ui-carousel`,title:`Image Carousel`,difficulty:3,category:`interaction`,prompt:`Build a carousel: next and prev move between slides, wrapping around at the ends. Exactly one slide is visible at a time.`,html:`<div class="carousel">
  <div class="track">
    <div class="slide active"><p>Slide 1</p></div>
    <div class="slide"><p>Slide 2</p></div>
    <div class="slide"><p>Slide 3</p></div>
  </div>
  <div class="carousel-nav">
    <button id="car-prev" aria-label="Previous">‹</button>
    <button id="car-next" aria-label="Next">›</button>
  </div>
</div>`,css:`.carousel { max-width: 420px; position: relative; font-family: system-ui; }
.track { display: flex; overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; }
.slide { min-width: 100%; display: none; height: 160px; place-items: center; background: #f8fafc; font-size: 22px; font-weight: 700; }
.slide.active { display: grid; }
.carousel-nav { display: flex; gap: 8px; margin-top: 10px; }
.carousel-nav button { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 18px; }`,js:f,assertions:[{label:`first slide active initially`,check:`return document.querySelectorAll('.slide')[0].classList.contains('active') && document.querySelectorAll('.slide.active').length === 1;`},{label:`next moves to the second slide`,check:`document.querySelector('#car-next').click(); await sleep(20); return document.querySelectorAll('.slide')[1].classList.contains('active');`},{label:`prev goes back one`,check:`document.querySelector('#car-prev').click(); await sleep(20); return document.querySelectorAll('.slide')[0].classList.contains('active');`}],hiddenAssertions:[{label:`prev wraps to the last slide`,check:`document.querySelector('#car-prev').click(); await sleep(20); return document.querySelectorAll('.slide')[2].classList.contains('active');`}],hint:`Keep an index, move it modulo the slide count, and toggle .active to match.`,reference:{html:`<div class="carousel">
  <div class="track">
    <div class="slide active"><p>Slide 1</p></div>
    <div class="slide"><p>Slide 2</p></div>
    <div class="slide"><p>Slide 3</p></div>
  </div>
  <div class="carousel-nav">
    <button id="car-prev" aria-label="Previous">‹</button>
    <button id="car-next" aria-label="Next">›</button>
  </div>
</div>`,css:`.carousel { max-width: 420px; position: relative; font-family: system-ui; }
.track { display: flex; overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; }
.slide { min-width: 100%; display: none; height: 160px; place-items: center; background: #f8fafc; font-size: 22px; font-weight: 700; }
.slide.active { display: grid; }
.carousel-nav { display: flex; gap: 8px; margin-top: 10px; }
.carousel-nav button { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 18px; }`,js:`const slides = [...document.querySelectorAll('.slide')];
let index = 0;
const show = (i) => {
  index = (i + slides.length) % slides.length;
  slides.forEach((s, j) => s.classList.toggle('active', j === index));
};
document.querySelector('#car-next').addEventListener('click', () => show(index + 1));
document.querySelector('#car-prev').addEventListener('click', () => show(index - 1));`}},{kind:`ui`,id:`ui-tic-tac-toe`,title:`Tic-tac-toe`,difficulty:3,category:`interaction`,prompt:`Build tic-tac-toe: X goes first, clicking an empty cell places the current mark and switches turns, occupied cells can't be overwritten, and three in a row announces the winner. A Restart button resets the board.`,html:`<div class="ttt">
  <div class="ttt-status" id="ttt-status">X's turn</div>
  <div class="ttt-grid">
    <button class="cell" data-cell="0"></button>
    <button class="cell" data-cell="1"></button>
    <button class="cell" data-cell="2"></button>
    <button class="cell" data-cell="3"></button>
    <button class="cell" data-cell="4"></button>
    <button class="cell" data-cell="5"></button>
    <button class="cell" data-cell="6"></button>
    <button class="cell" data-cell="7"></button>
    <button class="cell" data-cell="8"></button>
  </div>
  <button id="ttt-reset">Restart</button>
</div>`,css:`.ttt-grid { display: grid; grid-template-columns: repeat(3, 72px); gap: 6px; margin: 12px 0; font-family: system-ui; }
.cell { width: 72px; height: 72px; font-size: 26px; font-weight: 800; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer; }
.ttt-status { font-weight: 600; margin-bottom: 8px; font-family: system-ui; }
#ttt-reset { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,js:f,assertions:[{label:`X plays first`,check:`return document.querySelector('#ttt-status').textContent.includes("X's turn");`},{label:`clicking a cell places X and switches turns`,check:`document.querySelectorAll('.cell')[0].click(); await sleep(20); return document.querySelectorAll('.cell')[0].textContent === 'X' && document.querySelector('#ttt-status').textContent.includes("O's turn");`},{label:`occupied cells cannot be overwritten`,check:`document.querySelectorAll('.cell')[0].click(); await sleep(20); return document.querySelectorAll('.cell')[0].textContent === 'X';`}],hiddenAssertions:[{label:`three in a row announces the winner`,check:`const c = document.querySelectorAll('.cell'); c[0].click(); c[3].click(); c[1].click(); c[4].click(); c[2].click(); await sleep(20); return document.querySelector('#ttt-status').textContent.includes('X wins');`}],hint:`Track the current player and move count; after each move check the 8 winning lines before switching turns.`,reference:{html:`<div class="ttt">
  <div class="ttt-status" id="ttt-status">X's turn</div>
  <div class="ttt-grid">
    <button class="cell" data-cell="0"></button>
    <button class="cell" data-cell="1"></button>
    <button class="cell" data-cell="2"></button>
    <button class="cell" data-cell="3"></button>
    <button class="cell" data-cell="4"></button>
    <button class="cell" data-cell="5"></button>
    <button class="cell" data-cell="6"></button>
    <button class="cell" data-cell="7"></button>
    <button class="cell" data-cell="8"></button>
  </div>
  <button id="ttt-reset">Restart</button>
</div>`,css:`.ttt-grid { display: grid; grid-template-columns: repeat(3, 72px); gap: 6px; margin: 12px 0; font-family: system-ui; }
.cell { width: 72px; height: 72px; font-size: 26px; font-weight: 800; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; cursor: pointer; }
.ttt-status { font-weight: 600; margin-bottom: 8px; font-family: system-ui; }
#ttt-reset { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; }`,js:`const cells = [...document.querySelectorAll('.cell')];
const status = document.querySelector('#ttt-status');
let current = 'X';
let moves = 0;
const WIN = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const hasWinner = () => WIN.some(combo => combo.every(i => cells[i].textContent === current));
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (cell.textContent || hasWinner()) return;
    cell.textContent = current;
    moves++;
    if (hasWinner()) { status.textContent = current + ' wins!'; return; }
    if (moves === 9) { status.textContent = 'Draw'; return; }
    current = current === 'X' ? 'O' : 'X';
    status.textContent = current + "'s turn";
  });
});
document.querySelector('#ttt-reset').addEventListener('click', () => {
  cells.forEach(c => { c.textContent = ''; });
  current = 'X';
  moves = 0;
  status.textContent = "X's turn";
});`}},{kind:`ui`,id:`ui-signup-form`,title:`Signup Form Validation`,difficulty:2,category:`forms`,prompt:`Build signup-form validation: submitting with an invalid email and/or a short password shows inline errors; fixing the fields clears them; a fully valid submit is counted as successful.`,html:`<form id="signup-form" novalidate>
  <div class="field">
    <label for="su-email">Email</label>
    <input id="su-email" type="email" />
    <p class="error" id="email-error" hidden>Enter a valid email.</p>
  </div>
  <div class="field">
    <label for="su-pass">Password</label>
    <input id="su-pass" type="password" />
    <p class="error" id="pass-error" hidden>Password must be at least 6 characters.</p>
  </div>
  <button type="submit">Sign up</button>
</form>`,css:`.field { margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; font-family: system-ui; }
.field label { font-weight: 600; font-size: 13px; }
.field input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 260px; font-family: system-ui; }
.error { color: #dc2626; font-size: 12px; margin: 0; }
#signup-form button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #4f46e5; color: #fff; cursor: pointer; font-family: system-ui; }`,js:f,assertions:[{label:`empty submit shows both errors`,check:`document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelector('#email-error').hidden === false && document.querySelector('#pass-error').hidden === false;`},{label:`valid input clears the errors`,check:`document.querySelector('#su-email').value = 'ada@example.com'; document.querySelector('#su-pass').value = 'secret123'; document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelector('#email-error').hidden === true && document.querySelector('#pass-error').hidden === true;`},{label:`a bad email is still flagged`,check:`document.querySelector('#su-email').value = 'not-an-email'; document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return document.querySelector('#email-error').hidden === false;`}],hiddenAssertions:[{label:`a fully valid submit counts as successful`,check:`const before = Number(document.querySelector('#signup-form').dataset.submits || 0); document.querySelector('#su-email').value = 'ok@example.com'; document.querySelector('#su-pass').value = 'abcdef'; document.querySelector('#signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(20); return Number(document.querySelector('#signup-form').dataset.submits || 0) === before + 1;`}],hint:`On submit (preventDefault), set each error's hidden flag from a validation result and count only fully-valid submits.`,reference:{html:`<form id="signup-form" novalidate>
  <div class="field">
    <label for="su-email">Email</label>
    <input id="su-email" type="email" />
    <p class="error" id="email-error" hidden>Enter a valid email.</p>
  </div>
  <div class="field">
    <label for="su-pass">Password</label>
    <input id="su-pass" type="password" />
    <p class="error" id="pass-error" hidden>Password must be at least 6 characters.</p>
  </div>
  <button type="submit">Sign up</button>
</form>`,css:`.field { margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; font-family: system-ui; }
.field label { font-weight: 600; font-size: 13px; }
.field input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 260px; font-family: system-ui; }
.error { color: #dc2626; font-size: 12px; margin: 0; }
#signup-form button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #4f46e5; color: #fff; cursor: pointer; font-family: system-ui; }`,js:`const form = document.querySelector('#signup-form');
const email = document.querySelector('#su-email');
const pass = document.querySelector('#su-pass');
const emailErr = document.querySelector('#email-error');
const passErr = document.querySelector('#pass-error');
let ok = 0;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const emailOk = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email.value);
  const passOk = pass.value.length >= 6;
  emailErr.hidden = emailOk;
  passErr.hidden = passOk;
  if (emailOk && passOk) ok++;
  form.dataset.submits = String(ok);
});`}}],m=`// Wire up the component's behavior here.
// The judge checks the rendered DOM after real clicks / input events.`,h=[{kind:`ui`,id:`ui-toast`,title:`Toast Notifications`,difficulty:2,category:`interaction`,prompt:`Build a toast system: clicking “Show toast” appends a toast with the message; toasts auto-dismiss after 1 second; each toast has a close button; “Clear all” removes every toast.`,html:`<div class="toast-wrap">
  <div id="toast-host" class="toast-host"></div>
  <div class="toast-controls">
    <button id="toast-show">Show toast</button>
    <button id="toast-clear">Clear all</button>
  </div>
</div>`,css:`.toast-host { position: fixed; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 50; font-family: system-ui; }
.toast { display: flex; align-items: center; gap: 10px; background: #1e293b; color: #f8fafc; padding: 10px 14px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.35); font-size: 13px; min-width: 180px; }
.toast .t-close { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; margin-left: auto; }
.toast-controls { margin-top: 120px; font-family: system-ui; }
.toast-controls button { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,js:m,assertions:[{label:`no toasts initially`,check:`return document.querySelectorAll('.toast').length === 0;`},{label:`showing a toast appends it`,check:`document.querySelector('#toast-show').click(); await sleep(20); const ts = document.querySelectorAll('.toast'); return ts.length === 1 && ts[0].textContent.includes('Saved');`},{label:`multiple toasts stack`,check:`document.querySelector('#toast-show').click(); document.querySelector('#toast-show').click(); await sleep(20); return document.querySelectorAll('.toast').length === 3;`},{label:`close removes a single toast`,check:`document.querySelector('.toast .t-close').click(); await sleep(20); return document.querySelectorAll('.toast').length === 2;`}],hiddenAssertions:[{label:`toasts auto-dismiss after 1s`,check:`await sleep(1100); return document.querySelectorAll('.toast').length === 0;`},{label:`clear-all removes everything`,check:`document.querySelector('#toast-show').click(); document.querySelector('#toast-show').click(); await sleep(20); document.querySelector('#toast-clear').click(); await sleep(20); return document.querySelectorAll('.toast').length === 0;`}],hint:`Append a toast element with its own close listener and a setTimeout that removes it after 1s; Clear all empties the host.`,reference:{html:`<div class="toast-wrap">
  <div id="toast-host" class="toast-host"></div>
  <div class="toast-controls">
    <button id="toast-show">Show toast</button>
    <button id="toast-clear">Clear all</button>
  </div>
</div>`,css:`.toast-host { position: fixed; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 50; font-family: system-ui; }
.toast { display: flex; align-items: center; gap: 10px; background: #1e293b; color: #f8fafc; padding: 10px 14px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.35); font-size: 13px; min-width: 180px; }
.toast .t-close { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; margin-left: auto; }
.toast-controls { margin-top: 120px; font-family: system-ui; }
.toast-controls button { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; margin-right: 8px; }`,js:`const host = document.querySelector('#toast-host');
const esc = (s) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
document.querySelector('#toast-show').addEventListener('click', () => {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<span>' + esc('Saved!') + '</span><button class="t-close" aria-label="Dismiss">✕</button>';
  t.querySelector('.t-close').addEventListener('click', () => t.remove());
  host.appendChild(t);
  setTimeout(() => t.remove(), 1000);
});
document.querySelector('#toast-clear').addEventListener('click', () => { host.innerHTML = ''; });`}},{kind:`ui`,id:`ui-tooltip`,title:`Tooltip`,difficulty:2,category:`interaction`,prompt:`Build a tooltip: hovering the trigger shows the tooltip, moving the mouse away hides it. It must also open on keyboard focus and close on blur (accessibility).`,html:`<div class="tip-wrap">
  <button id="tip-btn" aria-describedby="tip">Hover me</button>
  <div id="tip" class="tip" hidden>More information about this action.</div>
</div>`,css:`.tip-wrap { position: relative; display: inline-block; font-family: system-ui; padding-top: 40px; }
#tip-btn { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.tip { position: absolute; top: 0; left: 0; background: #1e293b; color: #f8fafc; padding: 6px 10px; border-radius: 8px; font-size: 12px; white-space: nowrap; }`,js:m,assertions:[{label:`hidden initially`,check:`return document.querySelector('#tip').hidden === true;`},{label:`hover shows it`,check:`document.querySelector('#tip-btn').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await sleep(20); return document.querySelector('#tip').hidden === false;`},{label:`mouse-out hides it`,check:`document.querySelector('#tip-btn').dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); await sleep(20); return document.querySelector('#tip').hidden === true;`}],hiddenAssertions:[{label:`keyboard focus opens it`,check:`document.querySelector('#tip-btn').dispatchEvent(new FocusEvent('focus')); await sleep(20); return document.querySelector('#tip').hidden === false;`}],hint:`Four listeners on the trigger: mouseover/focus show, mouseout/blur hide.`,reference:{html:`<div class="tip-wrap">
  <button id="tip-btn" aria-describedby="tip">Hover me</button>
  <div id="tip" class="tip" hidden>More information about this action.</div>
</div>`,css:`.tip-wrap { position: relative; display: inline-block; font-family: system-ui; padding-top: 40px; }
#tip-btn { padding: 8px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; }
.tip { position: absolute; top: 0; left: 0; background: #1e293b; color: #f8fafc; padding: 6px 10px; border-radius: 8px; font-size: 12px; white-space: nowrap; }`,js:`const btn = document.querySelector('#tip-btn');
const tip = document.querySelector('#tip');
btn.addEventListener('mouseover', () => { tip.hidden = false; });
btn.addEventListener('mouseout', () => { tip.hidden = true; });
btn.addEventListener('focus', () => { tip.hidden = false; });
btn.addEventListener('blur', () => { tip.hidden = true; });`}},{kind:`ui`,id:`ui-tags-input`,title:`Tag Input`,difficulty:2,category:`forms`,prompt:`Build a tag input: pressing Enter turns the typed text into a chip, empty and duplicate tags are ignored, and each chip has a ✕ button that removes it.`,html:`<div class="tags-wrap">
  <div id="tag-list" class="tag-list"></div>
  <input id="tag-input" placeholder="Type a tag and press Enter" autocomplete="off" />
</div>`,css:`.tags-wrap { max-width: 360px; font-family: system-ui; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; min-height: 30px; }
.tag { display: inline-flex; align-items: center; gap: 6px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; }
.tag .t-x { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 12px; padding: 0; }
#tag-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; font-family: system-ui; }`,js:m,assertions:[{label:`starts with no tags`,check:`return document.querySelectorAll('.tag').length === 0;`},{label:`Enter adds a chip`,check:`const input = document.querySelector('#tag-input'); input.value = 'react'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(20); const tags = [...document.querySelectorAll('.tag')]; return tags.length === 1 && tags[0].textContent.includes('react');`},{label:`duplicates are ignored`,check:`const input = document.querySelector('#tag-input'); input.value = 'react'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(20); return document.querySelectorAll('.tag').length === 1;`},{label:`✕ removes a chip`,check:`document.querySelector('.tag .t-x').click(); await sleep(20); return document.querySelectorAll('.tag').length === 0;`}],hiddenAssertions:[{label:`multiple tags accumulate`,check:`const input = document.querySelector('#tag-input'); input.value = 'vue'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); input.value = 'svelte'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(20); const labels = [...document.querySelectorAll('.tag')].map(t => t.textContent); return labels.length === 2 && labels.some(l => l.includes('vue')) && labels.some(l => l.includes('svelte'));`}],hint:`On Enter: trim the value, bail on empty or existing tag, append a chip with its own remove listener, then clear the input.`,reference:{html:`<div class="tags-wrap">
  <div id="tag-list" class="tag-list"></div>
  <input id="tag-input" placeholder="Type a tag and press Enter" autocomplete="off" />
</div>`,css:`.tags-wrap { max-width: 360px; font-family: system-ui; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; min-height: 30px; }
.tag { display: inline-flex; align-items: center; gap: 6px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; padding: 4px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; }
.tag .t-x { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 12px; padding: 0; }
#tag-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; font-family: system-ui; }`,js:`const input = document.querySelector('#tag-input');
const list = document.querySelector('#tag-list');
const tags = () => [...document.querySelectorAll('.tag')].map(t => t.dataset.tag);
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const value = input.value.trim();
  if (!value || tags().includes(value)) return;
  const chip = document.createElement('span');
  chip.className = 'tag';
  chip.dataset.tag = value;
  chip.innerHTML = value + ' <button class="t-x" aria-label="Remove">✕</button>';
  chip.querySelector('.t-x').addEventListener('click', () => chip.remove());
  list.appendChild(chip);
  input.value = '';
});`}},{kind:`ui`,id:`ui-stepper`,title:`Multi-step Wizard`,difficulty:2,category:`forms`,prompt:`Build a 3-step wizard: Next advances (blocked on step 1 until the name field is filled), Back returns to the previous step, and reaching the last step shows the summary panel. The indicator must show the current step.`,html:`<div class="stepper">
  <div class="step-indicator" data-step="1">Step <span id="step-num">1</span> of 3</div>
  <div class="step-panel" data-step="1">
    <label for="s-input">Your name</label>
    <input id="s-input" placeholder="Ada Lovelace" autocomplete="off" />
  </div>
  <div class="step-panel" data-step="2">
    <p>Pick a focus area.</p>
    <select id="s-focus"><option>Frontend</option><option>Backend</option><option>Full-stack</option></select>
  </div>
  <div class="step-panel" data-step="3">
    <p class="stepper-done">🎉 You're all set — review and finish.</p>
  </div>
  <div class="stepper-nav">
    <button id="back">Back</button>
    <button id="next">Next</button>
  </div>
</div>`,css:`.stepper { max-width: 380px; font-family: system-ui; }
.step-indicator { font-weight: 700; margin-bottom: 12px; font-size: 13px; color: #6366f1; }
.step-panel { display: none; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 12px; min-height: 90px; }
.step-panel[data-step="1"] { display: block; }
#s-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; margin-top: 6px; font-family: system-ui; }
.stepper-nav { display: flex; gap: 8px; }
.stepper-nav button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,js:m,assertions:[{label:`step 1 visible initially`,check:`return getComputedStyle(document.querySelector('.step-panel[data-step="1"]')).display !== 'none' && getComputedStyle(document.querySelector('.step-panel[data-step="2"]')).display === 'none';`},{label:`Next is blocked without a name`,check:`document.querySelector('#next').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="1"]')).display !== 'none' && document.querySelector('#step-num').textContent.trim() === '1';`},{label:`a valid name advances`,check:`document.querySelector('#s-input').value = 'Ada'; document.querySelector('#next').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="2"]')).display !== 'none' && document.querySelector('#step-num').textContent.trim() === '2';`},{label:`Back returns to step 1`,check:`document.querySelector('#back').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="1"]')).display !== 'none';`}],hiddenAssertions:[{label:`reaching the last step shows the summary`,check:`document.querySelector('#s-input').value = 'Ada'; document.querySelector('#next').click(); document.querySelector('#next').click(); await sleep(20); return getComputedStyle(document.querySelector('.step-panel[data-step="3"]')).display !== 'none' && document.querySelector('#step-num').textContent.trim() === '3';`}],hint:`Keep a step index; Next validates the name on step 1, moves the index, and toggles panel display + the indicator number.`,reference:{html:`<div class="stepper">
  <div class="step-indicator" data-step="1">Step <span id="step-num">1</span> of 3</div>
  <div class="step-panel" data-step="1">
    <label for="s-input">Your name</label>
    <input id="s-input" placeholder="Ada Lovelace" autocomplete="off" />
  </div>
  <div class="step-panel" data-step="2">
    <p>Pick a focus area.</p>
    <select id="s-focus"><option>Frontend</option><option>Backend</option><option>Full-stack</option></select>
  </div>
  <div class="step-panel" data-step="3">
    <p class="stepper-done">🎉 You're all set — review and finish.</p>
  </div>
  <div class="stepper-nav">
    <button id="back">Back</button>
    <button id="next">Next</button>
  </div>
</div>`,css:`.stepper { max-width: 380px; font-family: system-ui; }
.step-indicator { font-weight: 700; margin-bottom: 12px; font-size: 13px; color: #6366f1; }
.step-panel { display: none; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 12px; min-height: 90px; }
.step-panel[data-step="1"] { display: block; }
#s-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; margin-top: 6px; font-family: system-ui; }
.stepper-nav { display: flex; gap: 8px; }
.stepper-nav button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,js:`const panels = [...document.querySelectorAll('.step-panel')];
const input = document.querySelector('#s-input');
let step = 0;
const show = () => {
  panels.forEach((p, i) => { p.style.display = i === step ? 'block' : 'none'; });
  document.querySelector('#step-num').textContent = String(step + 1);
  document.querySelector('.step-indicator').dataset.step = String(step + 1);
  document.querySelector('#back').disabled = step === 0;
  document.querySelector('#next').textContent = step === panels.length - 1 ? 'Finish' : 'Next';
};
document.querySelector('#next').addEventListener('click', () => {
  if (step === 0 && !input.value.trim()) return;
  if (step < panels.length - 1) step++;
  show();
});
document.querySelector('#back').addEventListener('click', () => {
  if (step > 0) step--;
  show();
});
show();`}},{kind:`ui`,id:`ui-otp-input`,title:`OTP Input`,difficulty:2,category:`forms`,prompt:`Build a 4-digit OTP input: typing a digit fills the current box and moves focus to the next, Backspace on an empty box moves focus back, and the full code is written to #otp-wrap's data-code attribute.`,html:`<div id="otp-wrap" class="otp-wrap" data-code="">
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 1" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 2" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 3" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 4" />
</div>`,css:`.otp-wrap { display: flex; gap: 10px; font-family: system-ui; }
.otp { width: 52px; height: 56px; text-align: center; font-size: 22px; font-weight: 700; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; }`,js:m,assertions:[{label:`all boxes start empty`,check:`return [...document.querySelectorAll('.otp')].every(i => i.value === '');`},{label:`typing fills a box and advances focus`,check:`const boxes = document.querySelectorAll('.otp'); boxes[0].value = '1'; boxes[0].dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return boxes[0].value === '1' && document.activeElement === boxes[1];`},{label:`the full code is collected`,check:`const boxes = document.querySelectorAll('.otp'); boxes.forEach((b, i) => { b.value = String(i + 1); b.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(20); return document.querySelector('#otp-wrap').dataset.code === '1234';`}],hiddenAssertions:[{label:`backspace on an empty box moves back`,check:`const boxes = document.querySelectorAll('.otp'); boxes[0].value = ''; boxes[1].value = ''; boxes[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })); await sleep(20); return document.activeElement === boxes[0];`}],hint:`On input: keep one digit, focus the next box, and recompute data-code from all boxes. On Backspace of an empty box, focus the previous one.`,reference:{html:`<div id="otp-wrap" class="otp-wrap" data-code="">
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 1" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 2" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 3" />
  <input class="otp" maxlength="1" inputmode="numeric" aria-label="Digit 4" />
</div>`,css:`.otp-wrap { display: flex; gap: 10px; font-family: system-ui; }
.otp { width: 52px; height: 56px; text-align: center; font-size: 22px; font-weight: 700; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; }`,js:`const wrap = document.querySelector('#otp-wrap');
const boxes = [...document.querySelectorAll('.otp')];
boxes.forEach((box, i) => {
  box.addEventListener('input', () => {
    box.value = box.value.replace(/\\D/g, '').slice(0, 1);
    if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
    wrap.dataset.code = boxes.map(b => b.value).join('');
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
  });
});`}},{kind:`ui`,id:`ui-drag-drop`,title:`Drag-and-drop Sortable List`,difficulty:3,category:`interaction`,prompt:`Build a sortable list using HTML5 drag-and-drop: dragging an item and dropping it onto another moves it to that position (inserted before the drop target). The dragged item gets a .dragging class while being dragged, removed on dragend.`,html:`<ul id="dd-list" class="dd-list">
  <li class="dd-item" draggable="true" data-id="A">Item A</li>
  <li class="dd-item" draggable="true" data-id="B">Item B</li>
  <li class="dd-item" draggable="true" data-id="C">Item C</li>
  <li class="dd-item" draggable="true" data-id="D">Item D</li>
</ul>`,css:`.dd-list { list-style: none; padding: 0; margin: 0; max-width: 320px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.dd-item { padding: 12px 14px; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; cursor: grab; }
.dd-item.dragging { opacity: .5; border-style: dashed; }`,js:m,assertions:[{label:`starts in order A B C D`,check:`return [...document.querySelectorAll('.dd-item')].map(li => li.dataset.id).join(',') === 'A,B,C,D';`},{label:`dragging A onto C reorders`,check:`const order = () => [...document.querySelectorAll('.dd-item')].map(li => li.dataset.id);
const dt = { effectAllowed: 'move', _d: {}, setData(k, v) { this._d[k] = v; }, getData(k) { return this._d[k] || ''; } };
const fire = (el, type) => { let e; try { e = new DragEvent(type, { bubbles: true, cancelable: true }); } catch { e = new Event(type, { bubbles: true, cancelable: true }); } Object.defineProperty(e, 'dataTransfer', { value: dt }); el.dispatchEvent(e); };
const items = document.querySelectorAll('.dd-item');
fire(items[0], 'dragstart');
fire(items[2], 'dragover');
fire(items[2], 'drop');
fire(items[0], 'dragend');
await sleep(20);
return order().join(',') === 'B,A,C,D';`}],hiddenAssertions:[{label:`dragging C onto A moves it to the front`,check:`const order = () => [...document.querySelectorAll('.dd-item')].map(li => li.dataset.id);
const dt = { effectAllowed: 'move', _d: {}, setData(k, v) { this._d[k] = v; }, getData(k) { return this._d[k] || ''; } };
const fire = (el, type) => { let e; try { e = new DragEvent(type, { bubbles: true, cancelable: true }); } catch { e = new Event(type, { bubbles: true, cancelable: true }); } Object.defineProperty(e, 'dataTransfer', { value: dt }); el.dispatchEvent(e); };
const from = [...document.querySelectorAll('.dd-item')].find(li => li.dataset.id === 'C');
const to = [...document.querySelectorAll('.dd-item')].find(li => li.dataset.id === 'A');
fire(from, 'dragstart');
fire(to, 'dragover');
fire(to, 'drop');
fire(from, 'dragend');
await sleep(20);
return order().join(',') === 'B,C,A,D' && !document.querySelector('.dd-item.dragging');`}],hint:`On dragstart store the dragged element + setData; on dragover preventDefault (required for drop); on drop insertBefore(dragged, target); on dragend clear the .dragging class.`,reference:{html:`<ul id="dd-list" class="dd-list">
  <li class="dd-item" draggable="true" data-id="A">Item A</li>
  <li class="dd-item" draggable="true" data-id="B">Item B</li>
  <li class="dd-item" draggable="true" data-id="C">Item C</li>
  <li class="dd-item" draggable="true" data-id="D">Item D</li>
</ul>`,css:`.dd-list { list-style: none; padding: 0; margin: 0; max-width: 320px; font-family: system-ui; display: flex; flex-direction: column; gap: 8px; }
.dd-item { padding: 12px 14px; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; cursor: grab; }
.dd-item.dragging { opacity: .5; border-style: dashed; }`,js:`let dragged = null;
document.querySelectorAll('.dd-item').forEach(item => {
  item.addEventListener('dragstart', (e) => {
    dragged = item;
    item.classList.add('dragging');
    e.dataTransfer.setData('text/plain', item.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
  });
  item.addEventListener('dragover', (e) => { e.preventDefault(); });
  item.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragged || dragged === item) return;
    item.parentNode.insertBefore(dragged, item);
  });
  item.addEventListener('dragend', () => {
    if (dragged) dragged.classList.remove('dragging');
    dragged = null;
  });
});`}},{kind:`ui`,id:`ui-virtual-list`,title:`Virtualized List`,difficulty:3,category:`performance`,prompt:`Build a virtualized list: render 1000 items but keep only the visible window in the DOM (≤ 15 rows). Rows are 24px tall in a 200px viewport. Scrolling must re-render the window, and the total must be exposed in #vlist's data-total.`,html:`<div id="vlist" class="vlist" style="height:200px;overflow:auto;position:relative"></div>`,css:`.vlist { max-width: 360px; border: 1px solid #cbd5e1; border-radius: 10px; font-family: system-ui; }
.row { position: absolute; left: 0; right: 0; padding: 0 12px; display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; box-sizing: border-box; }`,js:m,assertions:[{label:`DOM stays bounded and starts at row 0`,check:`const rows = document.querySelectorAll('#vlist .row'); return rows.length > 0 && rows.length <= 15 && rows[0].dataset.index === '0' && document.querySelector('#vlist').dataset.total === '1000';`},{label:`scrolling moves the visible window`,check:`const list = document.querySelector('#vlist'); list.scrollTop = 480; list.dispatchEvent(new Event('scroll')); await sleep(20); const rows = document.querySelectorAll('#vlist .row'); const first = Number(rows[0].dataset.index); return rows.length <= 15 && first >= 10 && first <= 60;`}],hiddenAssertions:[{label:`near the end the last rows render`,check:`const list = document.querySelector('#vlist'); list.scrollTop = 23800; list.dispatchEvent(new Event('scroll')); await sleep(20); const rows = document.querySelectorAll('#vlist .row'); const last = Number(rows[rows.length - 1].dataset.index); return rows.length <= 15 && last >= 990;`}],hint:`On init and scroll: compute start = floor(scrollTop / 24) − 2, render only start..start+visible, position each row at top = i * 24.`,reference:{html:`<div id="vlist" class="vlist" style="height:200px;overflow:auto;position:relative"></div>`,css:`.vlist { max-width: 360px; border: 1px solid #cbd5e1; border-radius: 10px; font-family: system-ui; }
.row { position: absolute; left: 0; right: 0; padding: 0 12px; display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; box-sizing: border-box; }`,js:`const list = document.getElementById('vlist');
const TOTAL = 1000, ROW = 24, BUFFER = 2;
list.dataset.total = String(TOTAL);
const render = () => {
  const start = Math.max(0, Math.floor(list.scrollTop / ROW) - BUFFER);
  const visible = Math.ceil(200 / ROW) + BUFFER * 2;
  const end = Math.min(TOTAL, start + visible);
  list.innerHTML = '';
  for (let i = start; i < end; i++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.index = String(i);
    row.style.cssText = 'position:absolute;top:' + (i * ROW) + 'px;height:' + ROW + 'px;';
    row.textContent = 'Row ' + i;
    list.appendChild(row);
  }
};
list.addEventListener('scroll', render);
render();`}},{kind:`ui`,id:`ui-countdown`,title:`Countdown Timer`,difficulty:2,category:`interaction`,prompt:`Build a countdown timer starting at 5 seconds: Start begins counting down by one each second (display never goes below 0), Pause freezes it, Reset returns it to 5.`,html:`<div class="cd-wrap">
  <div id="cd-display" class="cd-display">5</div>
  <div class="cd-controls">
    <button id="cd-start">Start</button>
    <button id="cd-pause">Pause</button>
    <button id="cd-reset">Reset</button>
  </div>
</div>`,css:`.cd-wrap { text-align: center; font-family: system-ui; }
.cd-display { font-size: 56px; font-weight: 800; font-variant-numeric: tabular-nums; margin-bottom: 12px; }
.cd-controls { display: flex; gap: 8px; justify-content: center; }
.cd-controls button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,js:m,assertions:[{label:`starts at 5`,check:`return document.querySelector('#cd-display').textContent.trim() === '5';`},{label:`Start counts down`,check:`document.querySelector('#cd-start').click(); await sleep(1200); return Number(document.querySelector('#cd-display').textContent.trim()) < 5;`},{label:`Pause freezes the countdown`,check:`document.querySelector('#cd-pause').click(); const v = Number(document.querySelector('#cd-display').textContent.trim()); await sleep(1000); return Number(document.querySelector('#cd-display').textContent.trim()) === v;`}],hiddenAssertions:[{label:`Reset returns to 5`,check:`document.querySelector('#cd-reset').click(); await sleep(20); return document.querySelector('#cd-display').textContent.trim() === '5';`}],hint:`setInterval decrements every second while running; Pause clears the interval; Reset clears it and restores 5.`,reference:{html:`<div class="cd-wrap">
  <div id="cd-display" class="cd-display">5</div>
  <div class="cd-controls">
    <button id="cd-start">Start</button>
    <button id="cd-pause">Pause</button>
    <button id="cd-reset">Reset</button>
  </div>
</div>`,css:`.cd-wrap { text-align: center; font-family: system-ui; }
.cd-display { font-size: 56px; font-weight: 800; font-variant-numeric: tabular-nums; margin-bottom: 12px; }
.cd-controls { display: flex; gap: 8px; justify-content: center; }
.cd-controls button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; cursor: pointer; font-family: system-ui; font-weight: 600; }`,js:`const display = document.querySelector('#cd-display');
let seconds = 5, timer = null;
const render = () => { display.textContent = String(seconds); };
document.querySelector('#cd-start').addEventListener('click', () => {
  if (timer) return;
  timer = setInterval(() => {
    seconds = Math.max(0, seconds - 1);
    render();
    if (seconds === 0) { clearInterval(timer); timer = null; }
  }, 1000);
});
document.querySelector('#cd-pause').addEventListener('click', () => { clearInterval(timer); timer = null; });
document.querySelector('#cd-reset').addEventListener('click', () => { clearInterval(timer); timer = null; seconds = 5; render(); });
render();`}},{kind:`ui`,id:`ui-theme-toggle`,title:`Theme Toggle`,difficulty:1,category:`interaction`,prompt:`Build a light/dark theme toggle: clicking the button toggles the .dark class on <body>, persists the choice to localStorage (key: theme, values light/dark — the judge sandbox blocks storage, so keep it best-effort), and reflects the state in the button's aria-pressed and data-theme attributes.`,html:`<div class="theme-wrap">
  <button id="theme-btn" aria-pressed="false">🌙 Dark mode</button>
  <p class="theme-note">The page should switch between light and dark when toggled.</p>
</div>`,css:`.theme-wrap { font-family: system-ui; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 320px; }
#theme-btn { padding: 10px 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; cursor: pointer; font-weight: 700; font-family: system-ui; }
body.dark { background: #0f172a; }
body.dark .theme-wrap { border-color: #334155; }
body.dark .theme-note { color: #e2e8f0; }`,js:m,assertions:[{label:`starts in light mode`,check:`return !document.body.classList.contains('dark');`},{label:`clicking toggles to dark`,check:`document.querySelector('#theme-btn').click(); await sleep(20); return document.body.classList.contains('dark') && document.querySelector('#theme-btn').getAttribute('aria-pressed') === 'true';`},{label:`clicking again returns to light`,check:`document.querySelector('#theme-btn').click(); await sleep(20); return !document.body.classList.contains('dark') && document.querySelector('#theme-btn').getAttribute('aria-pressed') === 'false';`}],hiddenAssertions:[{label:`the state is tracked on the button`,check:`document.querySelector('#theme-btn').click(); await sleep(20); return document.querySelector('#theme-btn').dataset.theme === 'dark' && document.body.classList.contains('dark');`}],hint:`Toggle the body class, mirror it in aria-pressed and localStorage on every click.`,reference:{html:`<div class="theme-wrap">
  <button id="theme-btn" aria-pressed="false">🌙 Dark mode</button>
  <p class="theme-note">The page should switch between light and dark when toggled.</p>
</div>`,css:`.theme-wrap { font-family: system-ui; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 320px; }
#theme-btn { padding: 10px 18px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; color: #0f172a; cursor: pointer; font-weight: 700; font-family: system-ui; }
body.dark { background: #0f172a; }
body.dark .theme-wrap { border-color: #334155; }
body.dark .theme-note { color: #e2e8f0; }`,js:`const btn = document.querySelector('#theme-btn');
const save = (v) => { try { localStorage.setItem('theme', v); } catch { /* opaque-origin sandbox has no storage — best-effort */ } };
const apply = (dark) => {
  document.body.classList.toggle('dark', dark);
  btn.setAttribute('aria-pressed', String(dark));
  btn.dataset.theme = dark ? 'dark' : 'light';
  btn.textContent = dark ? '☀️ Light mode' : '🌙 Dark mode';
  save(dark ? 'dark' : 'light');
};
try { apply(localStorage.getItem('theme') === 'dark'); } catch { apply(false); }
btn.addEventListener('click', () => apply(!document.body.classList.contains('dark')));`}},{kind:`ui`,id:`ui-slider`,title:`Range Slider`,difficulty:2,category:`forms`,prompt:`Build a range slider: dragging (or changing) the slider updates the fill bar width to the same percentage and shows the numeric value in the label.`,html:`<div class="slider-wrap">
  <div class="slider-track"><div id="s-fill" class="slider-fill" style="width:0%"></div></div>
  <input id="range" type="range" min="0" max="100" value="0" />
  <div class="slider-value">Value: <span id="s-val">0</span></div>
</div>`,css:`.slider-wrap { max-width: 340px; font-family: system-ui; }
.slider-track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.slider-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); }
#range { width: 100%; margin: 12px 0 6px; }
.slider-value { font-size: 13px; font-weight: 700; }`,js:m,assertions:[{label:`starts at 0`,check:`return document.querySelector('#s-val').textContent.trim() === '0' && document.querySelector('#s-fill').style.width === '0%';`},{label:`moving the slider updates fill + label`,check:`const range = document.querySelector('#range'); range.value = '60'; range.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return document.querySelector('#s-val').textContent.trim() === '60' && document.querySelector('#s-fill').style.width === '60%';`}],hiddenAssertions:[{label:`maxing out fills the bar`,check:`const range = document.querySelector('#range'); range.value = '100'; range.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20); return document.querySelector('#s-fill').style.width === '100%';`}],hint:`Listen for the input event and write range.value into both the fill width and the label.`,reference:{html:`<div class="slider-wrap">
  <div class="slider-track"><div id="s-fill" class="slider-fill" style="width:0%"></div></div>
  <input id="range" type="range" min="0" max="100" value="0" />
  <div class="slider-value">Value: <span id="s-val">0</span></div>
</div>`,css:`.slider-wrap { max-width: 340px; font-family: system-ui; }
.slider-track { height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.slider-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #38bdf8); }
#range { width: 100%; margin: 12px 0 6px; }
.slider-value { font-size: 13px; font-weight: 700; }`,js:`const range = document.querySelector('#range');
const fill = document.querySelector('#s-fill');
const val = document.querySelector('#s-val');
const update = () => { fill.style.width = range.value + '%'; val.textContent = range.value; };
range.addEventListener('input', update);
update();`}}],g=`// Wire up the component's behavior here.
// The judge checks the rendered DOM after real clicks / input events.`,_=[{url:`https://unpkg.com/react@18.3.1/umd/react.production.min.js`,global:`React`},{url:`https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js`,global:`ReactDOM`}],v=[{url:`https://unpkg.com/vue@3.4.38/dist/vue.global.prod.js`,global:`Vue`}],y=[{kind:`ui`,id:`ui-react-counter`,title:`React Counter`,difficulty:2,category:`react`,libs:_,prompt:`Build a counter with React: clicking + increments the displayed number, clicking − decrements it. Use React.createElement (no JSX) and mount into #root with ReactDOM.createRoot.`,html:`<div id="root"></div>`,css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:g,assertions:[{label:`starts at 0`,check:`return document.querySelector('#value').textContent.trim() === '0';`},{label:`increments on +`,check:`document.querySelector('#plus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '1';`},{label:`decrements on −`,check:`document.querySelector('#minus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '-1';`}],hiddenAssertions:[{label:`rapid sequences stay consistent`,check:`document.querySelector('#plus').click(); document.querySelector('#plus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '0';`}],hint:`Use useState for the count and pass onClick handlers that update it; React re-renders the span automatically.`,reference:{html:`<div id="root"></div>`,css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:`function Counter() {
  const [count, setCount] = React.useState(0);
  return React.createElement("div", { className: "counter" },
    React.createElement("button", { id: "minus", onClick: () => setCount(c => c - 1) }, "−"),
    React.createElement("span", { id: "value" }, count),
    React.createElement("button", { id: "plus", onClick: () => setCount(c => c + 1) }, "+")
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Counter));`}},{kind:`ui`,id:`ui-react-todo`,title:`React Todo List`,difficulty:3,category:`react`,libs:_,prompt:`Build a todo list with React: submitting the form adds a non-empty todo, empty input is ignored, and each item has a delete button that removes it. Use React.createElement and useState.`,html:`<div id="root"></div>`,css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:g,assertions:[{label:`starts empty`,check:`return document.querySelectorAll('#todo-list li').length === 0;`},{label:`submit adds a todo`,check:`const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, 'Learn React'); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1 && document.querySelector('#todo-list').textContent.includes('Learn React');`},{label:`empty input is ignored`,check:`const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, '   '); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1;`}],hiddenAssertions:[{label:`delete removes an item`,check:`document.querySelector('.del').click(); await sleep(30); return document.querySelectorAll('#todo-list li').length === 0;`}],hint:`Keep items in state; onSubmit prevents default, trims the input, appends, and clears the text field. Each item's delete handler filters by index.`,reference:{html:`<div id="root"></div>`,css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:`function App() {
  const [items, setItems] = React.useState([]);
  const [text, setText] = React.useState("");
  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setItems([...items, t]);
    setText("");
  };
  const del = (i) => setItems(items.filter((_, j) => j !== i));
  return React.createElement("div", { className: "todo" },
    React.createElement("form", { id: "todo-form", onSubmit: add },
      React.createElement("input", { id: "todo-input", value: text, onChange: (e) => setText(e.target.value), placeholder: "What needs doing?" }),
      React.createElement("button", { type: "submit" }, "Add")),
    React.createElement("ul", { id: "todo-list" },
      items.map((it, i) =>
        React.createElement("li", { key: i },
          React.createElement("span", null, it),
          React.createElement("button", { className: "del", onClick: () => del(i) }, "✕"))))
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));`}},{kind:`ui`,id:`ui-react-tabs`,title:`React Tabs`,difficulty:2,category:`react`,libs:_,prompt:`Build a tab panel with React: clicking a tab shows its panel and marks it active; aria-selected must follow. Exactly one panel is visible at a time. Use React.createElement and useState.`,html:`<div id="root"></div>`,css:`.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,js:g,assertions:[{label:`first panel visible initially`,check:`return getComputedStyle(document.getElementById('tab1')).display !== 'none' && getComputedStyle(document.getElementById('tab2')).display === 'none';`},{label:`clicking a tab shows its panel`,check:`document.querySelectorAll('.tab')[1].click(); await sleep(30); return getComputedStyle(document.getElementById('tab2')).display !== 'none' && getComputedStyle(document.getElementById('tab1')).display === 'none';`},{label:`exactly one panel active`,check:`document.querySelectorAll('.tab')[2].click(); await sleep(30); return document.querySelectorAll('.tab-panel.active').length === 1;`}],hiddenAssertions:[{label:`aria-selected follows the active tab`,check:`document.querySelectorAll('.tab')[1].click(); await sleep(30); return document.querySelectorAll('.tab')[1].getAttribute('aria-selected') === 'true' && document.querySelectorAll('.tab')[0].getAttribute('aria-selected') === 'false';`}],hint:`Track the active tab id in state; each tab button sets it, and class + aria-selected derive from it.`,reference:{html:`<div id="root"></div>`,css:`.tab-panel { display: none; padding: 12px; color: #475569; font-family: system-ui; }
.tab-panel.active { display: block; }
.tab-list { display: flex; gap: 4px; font-family: system-ui; }
.tab { padding: 8px 14px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; border-radius: 8px 8px 0 0; }
.tab.active { background: #4f46e5; color: #fff; font-weight: 600; }`,js:`const PANELS = [
  { id: "tab1", label: "Overview" },
  { id: "tab2", label: "Pricing" },
  { id: "tab3", label: "FAQ" }
];
function Tabs() {
  const [active, setActive] = React.useState("tab1");
  return React.createElement("div", { className: "tabs" },
    React.createElement("div", { className: "tab-list", role: "tablist" },
      PANELS.map(p =>
        React.createElement("button", {
          key: p.id, className: "tab" + (active === p.id ? " active" : ""), "data-tab": p.id, role: "tab",
          "aria-selected": String(active === p.id),
          onClick: () => setActive(p.id)
        }, p.label))),
    PANELS.map(p =>
      React.createElement("div", { key: p.id, id: p.id, className: "tab-panel" + (active === p.id ? " active" : "") },
        React.createElement("p", null, p.label + " content.")))
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Tabs));`}},{kind:`ui`,id:`ui-vue-counter`,title:`Vue Counter`,difficulty:2,category:`vue`,libs:v,prompt:`Build a counter with Vue 3: clicking + increments the displayed number, clicking − decrements it. Use createApp with a template and data() state, then mount into #root.`,html:`<div id="root"></div>`,css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:g,assertions:[{label:`starts at 0`,check:`return document.querySelector('#value').textContent.trim() === '0';`},{label:`increments on +`,check:`document.querySelector('#plus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '1';`},{label:`decrements on −`,check:`document.querySelector('#minus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '-1';`}],hiddenAssertions:[{label:`rapid sequences stay consistent`,check:`document.querySelector('#plus').click(); document.querySelector('#plus').click(); document.querySelector('#minus').click(); await sleep(30); return document.querySelector('#value').textContent.trim() === '0';`}],hint:`data() returns the count, methods mutate it, and the template renders {{ count }} with @click handlers.`,reference:{html:`<div id="root"></div>`,css:`.counter { display: flex; align-items: center; gap: 16px; font-size: 28px; font-weight: 700; font-family: system-ui; }
.counter button { width: 44px; height: 44px; font-size: 22px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f8fafc; cursor: pointer; }`,js:`Vue.createApp({
  data() { return { count: 0 }; },
  methods: {
    inc() { this.count += 1; },
    dec() { this.count -= 1; }
  },
  template: '<div class="counter">' +
    '<button id="minus" @click="dec">−</button>' +
    '<span id="value">{{ count }}</span>' +
    '<button id="plus" @click="inc">+</button>' +
  '</div>'
}).mount("#root");`}},{kind:`ui`,id:`ui-vue-todo`,title:`Vue Todo List`,difficulty:3,category:`vue`,libs:v,prompt:`Build a todo list with Vue 3: submitting the form adds a non-empty todo (empty input ignored), and each item has a delete button. Use createApp, v-model and v-for.`,html:`<div id="root"></div>`,css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:g,assertions:[{label:`starts empty`,check:`return document.querySelectorAll('#todo-list li').length === 0;`},{label:`submit adds a todo`,check:`const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, 'Learn Vue'); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1 && document.querySelector('#todo-list').textContent.includes('Learn Vue');`},{label:`empty input is ignored`,check:`const input = document.querySelector('#todo-input');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, '   '); input.dispatchEvent(new Event('input', { bubbles: true }));
await sleep(30);
document.querySelector('#todo-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
await sleep(30);
return document.querySelectorAll('#todo-list li').length === 1;`}],hiddenAssertions:[{label:`delete removes an item`,check:`document.querySelector('.del').click(); await sleep(30); return document.querySelectorAll('#todo-list li').length === 0;`}],hint:`v-model binds the input; the submit handler trims, pushes to items, and clears the field; v-for renders each item with a del(i) button.`,reference:{html:`<div id="root"></div>`,css:`.todo { max-width: 360px; font-family: system-ui; }
#todo-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; margin-right: 8px; }
#todo-list { list-style: none; padding: 0; }
#todo-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.del { background: none; border: none; color: #ef4444; cursor: pointer; }`,js:`Vue.createApp({
  data() { return { text: "", items: [] }; },
  methods: {
    add() {
      const t = this.text.trim();
      if (!t) return;
      this.items.push(t);
      this.text = "";
    },
    del(i) { this.items.splice(i, 1); }
  },
  template: '<div class="todo">' +
    '<form id="todo-form" @submit.prevent="add">' +
      '<input id="todo-input" v-model="text" placeholder="What needs doing?" />' +
      '<button type="submit">Add</button>' +
    '</form>' +
    '<ul id="todo-list">' +
      '<li v-for="(it, i) in items" :key="i"><span>{{ it }}</span><button class="del" @click="del(i)">✕</button></li>' +
    '</ul>' +
  '</div>'
}).mount("#root");`}}],b=[{kind:`cli`,id:`basic-calculator-ii`,title:`Basic Calculator II`,difficulty:2,prompt:`You are tasked with implementing a basic calculator that can evaluate simple expressions containing non-negative integers, addition (+), subtraction (-), multiplication (*), and division (/). The input is a string representing the expression, and you need to return the result as an integer. The expression is guaranteed to be valid and will not contain any parentheses. Note that integer division should truncate towards zero.`,io:`input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"`,starters:{python:`import sys

# Input:
#   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   input: "3+2*2"
output: "7"
input: " 3/2 "
output: "1"
input: " 3+5 / 2 "
output: "5"
input: "14-3/2"
output: "13"
input: "2*3+4*5"
output: "26"
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`3+2*2
`,expect:`7`},{stdin:` 3/2 
`,expect:`1`},{stdin:` 3+5 / 2 
`,expect:`5`},{stdin:`14-3/2
`,expect:`13`},{stdin:`2*3+4*5
`,expect:`26`}],hidden:[{stdin:`10/2*3
`,expect:`15`},{stdin:`5-2*3+4
`,expect:`3`},{stdin:`1+1+1+1
`,expect:`4`}],hint:`Consider using a stack to handle the operations and maintain the order of precedence.`,reference:`function solve(lines) {
  const out = [];
  const expression = lines[0];
  const tokens = expression.match(/\\d+|[+\\-*/]/g);
  let stack = [];
  let currentNum = 0;
  let operation = '+';

  for (let token of tokens) {
    if (!isNaN(token)) {
      currentNum = parseInt(token);
    }
    if (isNaN(token) || token === tokens[tokens.length - 1]) {
      if (operation === '+') stack.push(currentNum);
      else if (operation === '-') stack.push(-currentNum);
      else if (operation === '*') stack.push(stack.pop() * currentNum);
      else if (operation === '/') stack.push(Math.trunc(stack.pop() / currentNum));
      operation = token;
      currentNum = 0;
    }
  }

  out.push(stack.reduce((a, b) => a + b, 0).toString());
  return out;
}`,pattern:`stack`},{kind:`cli`,id:`can-place-flowers`,title:`Can Place Flowers`,difficulty:2,prompt:`You have a flowerbed represented as an array where 0 means empty and 1 means a flower is planted. You want to plant a new flower in the flowerbed without violating the no-adjacent-flowers rule. Given the flowerbed and the number of new flowers you want to plant, determine if you can plant all of them. Return 'true' if you can plant all flowers, otherwise return 'false'.`,io:`Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true`,starters:{python:`import sys

# Input:
#   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input:
[1,0,0,0,1]
1
Output:
true

Input:
[1,0,0,0,1]
2
Output:
false

Input:
[0,0,1,0,0]
2
Output:
true

Input:
[0,0,0,0,0]
3
Output:
true

Input:
[1,0,0,0,1]
0
Output:
true
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1,0,0,0,1]
1
`,expect:`true`},{stdin:`[1,0,0,0,1]
2
`,expect:`false`},{stdin:`[0,0,1,0,0]
2
`,expect:`true`},{stdin:`[0,0,0,0,0]
3
`,expect:`true`},{stdin:`[1,0,0,0,1]
0
`,expect:`true`}],hidden:[{stdin:`[0,0,0,0,0]
5
`,expect:`false`},{stdin:`[0,1,0,0,0,1,0]
1
`,expect:`true`},{stdin:`[1,0,0,1,0,0,1]
1
`,expect:`false`}],hint:`Consider the conditions for planting a flower carefully.`,reference:`function solve(lines) { const flowerbed = JSON.parse(lines[0]); const n = parseInt(lines[1]); let count = 0; for (let i = 0; i < flowerbed.length; i++) { if (flowerbed[i] === 0 && (i === 0 || flowerbed[i - 1] === 0) && (i === flowerbed.length - 1 || flowerbed[i + 1] === 0)) { flowerbed[i] = 1; count++; } } return [count >= n ? 'true' : 'false']; }`,pattern:`greedy`},{kind:`cli`,id:`construct-k-palindrome-strings`,title:`Construct K Palindrome Strings`,difficulty:2,prompt:"Given a string `s` and an integer `k`, determine if it is possible to construct `k` palindrome strings using all characters of `s`. Each palindrome string must use the characters from `s` without any leftover characters. A palindrome reads the same forwards and backwards. Return 'YES' if it's possible, otherwise return 'NO'.",io:`YES
NO
YES
NO`,starters:{python:`import sys

# Input:
#   YES
NO
YES
NO
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   YES
NO
YES
NO
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   YES
NO
YES
NO
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   YES
NO
YES
NO
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   YES
NO
YES
NO
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   YES
NO
YES
NO
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`aabb
2
`,expect:`YES`},{stdin:`abc
2
`,expect:`NO`},{stdin:`aaaabbbb
3
`,expect:`YES`},{stdin:`abcdefg
1
`,expect:`NO`}],hidden:[{stdin:`aabbcc
3
`,expect:`YES`},{stdin:`xyz
2
`,expect:`NO`}],hint:`Count character frequencies and check the number of odd counts against k.`,reference:`function solve(lines) {
  const out = [];
  const [s, k] = lines;
  const charCount = {};
  for (const char of s) {
    charCount[char] = (charCount[char] || 0) + 1;
  }
  const oddCount = Object.values(charCount).filter(count => count % 2 !== 0).length;
  out.push(oddCount <= k ? 'YES' : 'NO');
  return out;
}`,pattern:`hash-map`},{kind:`cli`,id:`dot-product-of-two-sparse-vectors`,title:`Dot Product of Two Sparse Vectors`,difficulty:2,prompt:`You are given two sparse vectors represented as arrays of integers. Each vector contains non-negative integers, where a value of zero indicates the absence of a corresponding dimension. Your task is to compute the dot product of these two vectors. The dot product is defined as the sum of the products of the corresponding entries of the two sequences. If the vectors are of different lengths, consider the shorter length for the calculation. Return the result as a single integer.

For example, given vectors [1, 0, 0, 2] and [0, 3, 0, 4], the dot product is 0*1 + 3*0 + 0*0 + 4*2 = 8.`,io:`8
0`,starters:{python:`import sys

# Input:
#   8
0
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   8
0
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   8
0
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   8
0
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   8
0
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   8
0
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1, 0, 0, 2]
[0, 3, 0, 4]
`,expect:`8
`},{stdin:`[0, 0, 0]
[0, 0, 0]
`,expect:`0
`},{stdin:`[1, 2, 3]
[4, 5, 6]
`,expect:`32
`},{stdin:`[1, 2, 0, 0]
[0, 0, 0, 3]
`,expect:`0
`}],hidden:[{stdin:`[0, 1, 0, 0, 5]
[0, 0, 2, 3, 0]
`,expect:`0
`},{stdin:`[1, 2, 3, 4]
[0, 0, 0, 0]
`,expect:`0
`}],hint:`Consider only the minimum length of the two vectors for the dot product calculation.`,reference:`function solve(lines) {
  const out = [];
  const vec1 = JSON.parse(lines[0]);
  const vec2 = JSON.parse(lines[1]);
  const minLength = Math.min(vec1.length, vec2.length);
  let dotProduct = 0;
  for (let i = 0; i < minLength; i++) {
    dotProduct += vec1[i] * vec2[i];
  }
  out.push(dotProduct.toString());
  return out;
}`,pattern:`mixed`},{kind:`cli`,id:`first-bad-version`,title:`First Bad Version`,difficulty:2,prompt:`You are given a function that checks if a version is bad. The versions are numbered from 1 to n. You need to find the first bad version among them. Implement a function that takes the total number of versions and returns the first bad version. The first bad version is defined as the lowest numbered version that is bad. You can assume that there is at least one bad version.`,io:`1
2
3
4
5`,starters:{python:`import sys

# Input:
#   1
2
3
4
5
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   1
2
3
4
5
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   1
2
3
4
5
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   1
2
3
4
5
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   1
2
3
4
5
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   1
2
3
4
5
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`5
4
`,expect:`4`},{stdin:`10
6
`,expect:`6`},{stdin:`7
3
`,expect:`3`},{stdin:`1
1
`,expect:`1`}],hidden:[{stdin:`100
50
`,expect:`50`},{stdin:`20
15
`,expect:`15`}],hint:`Use binary search to efficiently find the first bad version.`,reference:`function solve(lines) {
  const n = parseInt(lines[0]);
  const badVersion = parseInt(lines[1]);
  return [badVersion.toString()];
}`,pattern:`binary-search`},{kind:`cli`,id:`first-missing-positive`,title:`First Missing Positive`,difficulty:3,prompt:`Given an array of integers, find the smallest positive integer that is not present in the array. The solution should run in O(n) time and use O(1) space. You may assume the array contains no duplicates and can be of any length, including empty.`,io:`3
1
2
4
5
6`,starters:{python:`import sys

# Input:
#   3
1
2
4
5
6
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
1
2
4
5
6
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
1
2
4
5
6
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
1
2
4
5
6
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
1
2
4
5
6
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
1
2
4
5
6
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[3, 4, -1, 1]
`,expect:`2`},{stdin:`[1, 2, 0]
`,expect:`3`},{stdin:`[-1, -2, -3]
`,expect:`1`},{stdin:`[7, 8, 9, 11, 12]
`,expect:`1`},{stdin:`[1, 2, 3, 4, 5]
`,expect:`6`}],hidden:[{stdin:`[1, 2, 3, 5, 6, 7, 8, 9, 10]
`,expect:`4`},{stdin:`[2, 3, 4, 5, 6]
`,expect:`1`},{stdin:`[1, 1, 1, 1, 1]
`,expect:`2`}],hint:`Consider using the array indices to place numbers in their correct positions.`,reference:`function solve(lines) {
  const out = [];
  const nums = lines[0].slice(1, -1).split(',').map(Number);
  const n = nums.length;
  for (let i = 0; i < n; i++) {
    while (nums[i] > 0 && nums[i] <= n && nums[nums[i] - 1] !== nums[i]) {
      const temp = nums[i];
      nums[i] = nums[temp - 1];
      nums[temp - 1] = temp;
    }
  }
  for (let i = 0; i < n; i++) {
    if (nums[i] !== i + 1) {
      out.push(i + 1);
      return out;
    }
  }
  out.push(n + 1);
  return out;
}`,pattern:`hash-map`},{kind:`cli`,id:`flatten-2d-vector`,title:`Flatten 2D Vector`,difficulty:2,prompt:`You are given a 2D grid of integers where each row may have a different number of columns. Your task is to flatten this grid into a single list of integers. The order of elements in the flattened list should follow the row-major order, meaning you traverse each row from left to right before moving to the next row. Implement a function that takes this grid as input and returns the flattened list as output.`,io:`Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:`,starters:{python:`import sys

# Input:
#   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input:
[[1,2,3],[4,5],[6]]
Output:
1
2
3
4
5
6
Input:
[[7,8],[9]]
Output:
7
8
9
Input:
[[],[1,2]]
Output:
1
2
Input:
[[10]]
Output:
10
Input:
[[],[]]
Output:
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[[1,2,3],[4,5],[6]]
`,expect:`1
2
3
4
5
6
`},{stdin:`[[7,8],[9]]
`,expect:`7
8
9
`},{stdin:`[[],[1,2]]
`,expect:`1
2
`},{stdin:`[[10]]
`,expect:`10
`},{stdin:`[[],[]]
`,expect:``}],hidden:[{stdin:`[[1,2,3,4],[5,6],[7,8,9]]
`,expect:`1
2
3
4
5
6
7
8
9
`},{stdin:`[[0,0],[0,0],[0,0]]
`,expect:`0
0
0
0
0
0
`},{stdin:`[[1],[2],[3],[4],[5]]
`,expect:`1
2
3
4
5
`}],hint:`Think about how to iterate through each row and then each column to collect the numbers.`,reference:`function solve(lines) {
  const out = [];
  const grid = JSON.parse(lines[0]);
  for (const row of grid) {
    for (const num of row) {
      out.push(num);
    }
  }
  return out;
}`,pattern:`mixed`},{kind:`cli`,id:`generate-parentheses`,title:`Generate Parentheses`,difficulty:2,prompt:`Given an integer n, generate all combinations of well-formed parentheses of length 2n. Each combination should be unique and in lexicographical order. For example, if n = 3, the valid combinations are: "((()))", "(()())", "(())()", "()(())", and "()()()". Return the combinations as an array of strings.`,io:`((()))
(()())
(())()
()(())
()()()`,starters:{python:`import sys

# Input:
#   ((()))
(()())
(())()
()(())
()()()
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   ((()))
(()())
(())()
()(())
()()()
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   ((()))
(()())
(())()
()(())
()()()
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   ((()))
(()())
(())()
()(())
()()()
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   ((()))
(()())
(())()
()(())
()()()
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   ((()))
(()())
(())()
()(())
()()()
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`3
`,expect:`((()))
(()())
(())()
()(())
()()()`},{stdin:`2
`,expect:`(())
()()`},{stdin:`1
`,expect:`()`}],hidden:[{stdin:`4
`,expect:`(((())))
((()()))
((())())
((()))()
(()(()))
(()()())
(()())()
(())(())
(())()()
()((()))
()(()())
()(())()
()()(())
()()()()`}],hint:`Use a recursive approach to build combinations while ensuring valid parentheses.`,reference:`function solve(lines) {
  const n = parseInt(lines[0]);
  const out = [];
  function generate(p, left, right) {
    if (left === 0 && right === 0) {
      out.push(p);
      return;
    }
    if (left > 0) generate(p + '(', left - 1, right);
    if (right > left) generate(p + ')', left, right - 1);
  }
  generate('', n, n);
  return out;
}`,pattern:`backtracking`},{kind:`cli`,id:`happy-number`,title:`Happy Number`,difficulty:2,prompt:`A happy number is defined by the following process: starting with any positive integer, replace the number by the sum of the squares of its digits, and repeat the process until the number equals 1 (where it will stay), or it loops endlessly in a cycle that does not include 1. Write a function to determine if a given number is a happy number.`,io:`Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.`,starters:{python:`import sys

# Input:
#   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input: A single integer n (1 ≤ n ≤ 10^6).
Output: 'True' if n is a happy number, 'False' otherwise.
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`19`,expect:`True`},{stdin:`2`,expect:`False`},{stdin:`7`,expect:`True`},{stdin:`4`,expect:`False`}],hidden:[{stdin:`1`,expect:`True`},{stdin:`16`,expect:`False`}],hint:`Use a set to track seen numbers to detect cycles.`,reference:`function solve(lines) {
  const out = [];
  const isHappy = (n) => {
    const seen = new Set();
    while (n !== 1 && !seen.has(n)) {
      seen.add(n);
      n = n.toString().split('').reduce((sum, digit) => sum + Math.pow(parseInt(digit), 2), 0);
    }
    return n === 1;
  };
  const n = parseInt(lines[0]);
  out.push(isHappy(n) ? 'True' : 'False');
  return out;
}`,pattern:`hash-map`},{kind:`cli`,id:`intersection-of-two-linked-lists`,title:`Intersection of Two Linked Lists`,difficulty:2,prompt:`You are given two singly linked lists. Write a function to determine the node at which the two lists intersect. If they do not intersect, return null. The linked lists are represented as arrays of integers, where the last element of the first list points to the first element of the second list if they intersect. Otherwise, the last element of the first list points to null. Your task is to find the intersection node's value or return 'null' if there is no intersection.`,io:`input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3`,starters:{python:`import sys

# Input:
#   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   input: [1, 2, 3, 4, 5]
[6, 7, 8]
output: null

input: [1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
output: 3

input: [1, 2, 3]
[4, 5, 6, 3]
output: 3

input: [1, 2]
[3, 4]
output: null

input: [1, 2, 3, 4]
[5, 6, 3, 4]
output: 3
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1, 2, 3, 4, 5]
[6, 7, 8]
`,expect:`null`},{stdin:`[1, 2, 3, 4, 5]
[6, 7, 3, 4, 5]
`,expect:`3`},{stdin:`[1, 2, 3]
[4, 5, 6, 3]
`,expect:`3`},{stdin:`[1, 2]
[3, 4]
`,expect:`null`},{stdin:`[1, 2, 3, 4]
[5, 6, 3, 4]
`,expect:`3`}],hidden:[{stdin:`[1, 2, 3, 4, 5]
[6, 7, 8, 4, 5]
`,expect:`4`},{stdin:`[1, 2]
[2]
`,expect:`2`}],hint:`Use a set to track nodes from the first list and check for intersections in the second.`,reference:`function solve(lines) {
  const out = [];
  const list1 = lines[0].slice(1, -1).split(',').map(Number);
  const list2 = lines[1].slice(1, -1).split(',').map(Number);
  const set = new Set(list1);
  for (const num of list2) {
    if (set.has(num)) {
      out.push(num);
      return out;
    }
  }
  out.push('null');
  return out;
}`,pattern:`hash-map`},{kind:`cli`,id:`kth-largest-element-in-an-array`,title:`Kth Largest Element in an Array`,difficulty:2,prompt:`You are given an array of integers and an integer k. Your task is to find the k-th largest element in the array. Note that it is the k-th largest element in the sorted order, not the k-th distinct element. If k is greater than the number of elements in the array, return -1. The array can contain duplicate elements. Implement a function that reads the input and returns the k-th largest element as specified.`,io:`Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.`,starters:{python:`import sys

# Input:
#   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input:
- The first line contains an integer n (1 ≤ n ≤ 10^5), the number of elements in the array.
- The second line contains n integers (each between -10^9 and 10^9).
- The third line contains an integer k (1 ≤ k ≤ n).

Output:
- A single integer representing the k-th largest element in the array.
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`5
3 2 1 5 6
2
`,expect:`5`},{stdin:`3
1 2 3
1
`,expect:`3`},{stdin:`6
3 2 3 1 2 4
4
`,expect:`2`},{stdin:`4
1 1 1 1
1
`,expect:`1`}],hidden:[{stdin:`10
5 3 8 6 2 7 4 1 9 10
5
`,expect:`6`},{stdin:`7
1 2 3 4 5 6 7
8
`,expect:`-1`}],hint:`Sort the array and access the k-th largest element directly.`,reference:`function solve(lines) {
    const n = parseInt(lines[0]);
    const arr = lines[1].split(' ').map(Number);
    const k = parseInt(lines[2]);
    arr.sort((a, b) => b - a);
    return [k <= n ? arr[k - 1].toString() : '-1'];
}`,pattern:`sorting`},{kind:`cli`,id:`letter-combinations-of-a-phone-number`,title:`Letter Combinations of a Phone Number`,difficulty:2,prompt:`Given a string of digits from 2 to 9, return all possible letter combinations that the number could represent based on the mapping of digits to letters on a phone keypad. Each digit maps to a set of letters as follows: 2 -> 'abc', 3 -> 'def', 4 -> 'ghi', 5 -> 'jkl', 6 -> 'mno', 7 -> 'pqrs', 8 -> 'tuv', 9 -> 'wxyz'. The output should be in lexicographical order. If the input string is empty, return an empty list.`,io:`abc
def
abc
def`,starters:{python:`import sys

# Input:
#   abc
def
abc
def
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   abc
def
abc
def
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   abc
def
abc
def
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   abc
def
abc
def
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   abc
def
abc
def
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   abc
def
abc
def
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`23
`,expect:`ad
ae
af
bd
be
bf
cd
ce
cf
`},{stdin:`2
`,expect:`a
b
c
`},{stdin:`79
`,expect:`pw
px
py
pz
qw
qx
qy
qz
rw
rx
ry
rz
sw
sx
sy
sz
`},{stdin:`
`,expect:``}],hidden:[{stdin:`7
`,expect:`p
q
r
s
`},{stdin:`234
`,expect:`adg
adh
adi
aeg
aeh
aei
afg
afh
afi
bdg
bdh
bdi
beg
beh
bei
bfg
bfh
bfi
cdg
cdh
cdi
ceg
ceh
cei
cfg
cfh
cfi
`}],hint:`Consider using backtracking to explore all combinations of letters.`,reference:`function solve(lines) {
  const out = [];
  const digitToLetters = {
    '2': 'abc', '3': 'def', '4': 'ghi', '5': 'jkl',
    '6': 'mno', '7': 'pqrs', '8': 'tuv', '9': 'wxyz'
  };
  const digits = lines[0];
  if (!digits) return out;
  const combinations = [];
  const backtrack = (index, path) => {
    if (index === digits.length) {
      combinations.push(path);
      return;
    }
    const letters = digitToLetters[digits[index]];
    for (const letter of letters) {
      backtrack(index + 1, path + letter);
    }
  };
  backtrack(0, '');
  out.push(...combinations.sort());
  return out;
}`,pattern:`backtracking`},{kind:`cli`,id:`linked-list-cycle`,title:`Linked List Cycle`,difficulty:2,prompt:`You are given a linked list represented by an array of integers, where the last element points to the index of an element in the list, forming a cycle if it points to a valid index. Your task is to determine if the linked list has a cycle. If the last element is -1, it indicates that there is no cycle. Return 'True' if there is a cycle, otherwise return 'False'.`,io:`True
False
False`,starters:{python:`import sys

# Input:
#   True
False
False
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   True
False
False
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   True
False
False
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   True
False
False
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   True
False
False
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   True
False
False
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1, 2, 3, 4, 5]
-1
`,expect:`False`},{stdin:`[1, 2, 3, 4, 5]
2
`,expect:`True`},{stdin:`[1, 2, 3]
0
`,expect:`True`},{stdin:`[1]
-1
`,expect:`False`}],hidden:[{stdin:`[1, 2, 3, 4]
3
`,expect:`True`},{stdin:`[1, 2]
1
`,expect:`True`},{stdin:`[1, 2, 3, 4, 5]
4
`,expect:`True`}],hint:`Use a set to track visited nodes and check for cycles as you traverse.`,reference:`function solve(lines) {
  const out = [];
  const list = lines[0].slice(1, -1).split(',').map(Number);
  const pos = Number(lines[1]);
  const visited = new Set();
  let currentIndex = 0;
  while (currentIndex !== -1) {
    if (visited.has(currentIndex)) {
      out.push('True');
      return out;
    }
    visited.add(currentIndex);
    currentIndex = pos === -1 ? -1 : list[currentIndex];
  }
  out.push('False');
  return out;
}`,pattern:`hash-map`},{kind:`cli`,id:`longest-palindromic-substring`,title:`Longest Palindromic Substring`,difficulty:2,prompt:`Given a string, find the longest substring that is a palindrome. A palindrome reads the same forwards and backwards. If there are multiple longest palindromic substrings, return the first one found. The input string will have a length between 1 and 1000 characters. 

For example, in the string "babad", the longest palindromic substring is "bab" or "aba". 

Implement a function that takes the string as input and returns the longest palindromic substring.`,io:`aba`,starters:{python:`import sys

# Input:
#   aba
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   aba
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   aba
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   aba
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   aba
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   aba
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`babad
`,expect:`bab
`},{stdin:`cbbd
`,expect:`bb
`},{stdin:`a
`,expect:`a
`},{stdin:`racecar
`,expect:`racecar
`}],hidden:[{stdin:`abcdefg
`,expect:`a
`},{stdin:`abccba
`,expect:`abccba
`}],hint:`Consider expanding around potential centers of the palindrome.`,reference:`function solve(lines) {
  const out = [];
  const s = lines[0];
  let longest = '';

  for (let i = 0; i < s.length; i++) {
    for (let j = i; j < s.length; j++) {
      const substring = s.slice(i, j + 1);
      if (isPalindrome(substring) && substring.length > longest.length) {
        longest = substring;
      }
    }
  }

  out.push(longest);
  return out;
}

function isPalindrome(str) {
  return str === str.split('').reverse().join('');
}`,pattern:`dynamic-programming`},{kind:`cli`,id:`longest-substring-without-repeating-characters`,title:`Longest Substring Without Repeating Characters`,difficulty:2,prompt:`Given a string, find the length of the longest substring that contains at most two distinct characters. For example, in the string "eceba", the longest substring with at most two distinct characters is "ece", which has a length of 3. Your task is to implement a function that returns this length for any given input string.`,io:`3
5
4
2
6`,starters:{python:`import sys

# Input:
#   3
5
4
2
6
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
5
4
2
6
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
5
4
2
6
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
5
4
2
6
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
5
4
2
6
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
5
4
2
6
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`eceba
`,expect:`3`},{stdin:`ccaabbb
`,expect:`5`},{stdin:`abcabcabc
`,expect:`2`},{stdin:`aa
`,expect:`2`}],hidden:[{stdin:`aabbcc
`,expect:`4`},{stdin:`abaccc
`,expect:`4`},{stdin:`abcde
`,expect:`2`}],hint:`Use a sliding window approach to track distinct characters.`,reference:`function solve(lines) {
    const s = lines[0];
    let left = 0, right = 0;
    const charMap = {};
    let maxLength = 0;

    while (right < s.length) {
        charMap[s[right]] = (charMap[s[right]] || 0) + 1;

        while (Object.keys(charMap).length > 2) {
            charMap[s[left]]--;
            if (charMap[s[left]] === 0) delete charMap[s[left]];
            left++;
        }

        maxLength = Math.max(maxLength, right - left + 1);
        right++;
    }

    return [maxLength.toString()];
}`,pattern:`sliding-window`},{kind:`cli`,id:`median-of-two-sorted-arrays`,title:`Median of Two Sorted Arrays`,difficulty:3,prompt:"You are given two sorted arrays of integers, `array1` and `array2`. Your task is to find the median of the combined sorted array formed by merging both arrays. The median is defined as the middle value when the total number of elements is odd, or the average of the two middle values when the total number of elements is even. Implement a function that efficiently computes the median without fully merging the arrays. The input arrays may have different lengths.\n\nFunction Signature: `function solve(lines)`",io:`3
2
4`,starters:{python:`import sys

# Input:
#   3
2
4
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
2
4
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
2
4
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
2
4
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
2
4
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
2
4
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1, 3]
[2]
`,expect:`2
`},{stdin:`[1, 2]
[3, 4]
`,expect:`2.5
`},{stdin:`[0, 0]
[0, 0]
`,expect:`0
`},{stdin:`[]
[1]
`,expect:`1
`},{stdin:`[2]
[]
`,expect:`2
`}],hidden:[{stdin:`[1, 3, 8]
[7, 9, 10, 11]
`,expect:`8
`},{stdin:`[1, 2, 3, 4, 5]
[6, 7, 8, 9, 10]
`,expect:`5.5
`}],hint:`Consider using binary search to optimize the merging process.`,reference:`function solve(lines) {
  const out = [];
  const array1 = JSON.parse(lines[0]);
  const array2 = JSON.parse(lines[1]);
  const merged = [...array1, ...array2].sort((a, b) => a - b);
  const len = merged.length;
  if (len % 2 === 1) {
    out.push(merged[Math.floor(len / 2)].toString());
  } else {
    const mid1 = merged[len / 2 - 1];
    const mid2 = merged[len / 2];
    out.push(((mid1 + mid2) / 2).toString());
  }
  return out;
}`,pattern:`binary-search`},{kind:`cli`,id:`meeting-rooms-ii`,title:`Meeting Rooms II`,difficulty:2,prompt:`You are given a list of meeting time intervals, where each interval is represented as a pair of integers [start, end]. Your task is to determine the minimum number of meeting rooms required to accommodate all the meetings without overlap. Each meeting room can only hold one meeting at a time. If a meeting ends at the same time another meeting starts, they can use the same room. 

Write a function that takes a list of intervals and returns the minimum number of meeting rooms needed.`,io:`3
1
0
2
2`,starters:{python:`import sys

# Input:
#   3
1
0
2
2
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
1
0
2
2
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
1
0
2
2
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
1
0
2
2
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
1
0
2
2
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
1
0
2
2
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[[0, 30], [5, 10], [15, 20]]
`,expect:`2
`},{stdin:`[[7, 10], [2, 4]]
`,expect:`1
`},{stdin:`[[1, 2], [2, 3], [3, 4]]
`,expect:`1
`},{stdin:`[[0, 5], [5, 10], [10, 15]]
`,expect:`1
`}],hidden:[{stdin:`[[1, 5], [2, 6], [3, 7], [4, 8]]
`,expect:`4
`},{stdin:`[[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]
`,expect:`1
`}],hint:`Consider sorting the start and end times of the meetings.`,reference:`function solve(lines) {
  const out = [];
  const intervals = JSON.parse(lines[0]);
  const startTimes = intervals.map(interval => interval[0]).sort((a, b) => a - b);
  const endTimes = intervals.map(interval => interval[1]).sort((a, b) => a - b);

  let roomCount = 0, endIndex = 0;
  for (let startIndex = 0; startIndex < intervals.length; startIndex++) {
    if (startTimes[startIndex] >= endTimes[endIndex]) {
      endIndex++;
    } else {
      roomCount++;
    }
  }
  out.push(roomCount);
  return out;
}`,pattern:`greedy`},{kind:`cli`,id:`merge-intervals`,title:`Merge Intervals`,difficulty:2,prompt:`You are given a list of intervals where each interval is represented as a pair of integers [start, end]. Your task is to merge all overlapping intervals and return a list of the merged intervals in ascending order of their start times. If two intervals overlap, they should be combined into one. The output should maintain the same format as the input intervals. 

For example, given intervals [[1,3],[2,6],[8,10],[15,18]], the merged intervals would be [[1,6],[8,10],[15,18]].`,io:`1 6
8 10
15 18`,starters:{python:`import sys

# Input:
#   1 6
8 10
15 18
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   1 6
8 10
15 18
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   1 6
8 10
15 18
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   1 6
8 10
15 18
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   1 6
8 10
15 18
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   1 6
8 10
15 18
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[[1,3],[2,6],[8,10],[15,18]]
`,expect:`1 6
8 10
15 18`},{stdin:`[[1,4],[4,5]]
`,expect:`1 5`},{stdin:`[[1,2],[3,4],[5,6]]
`,expect:`1 2
3 4
5 6`},{stdin:`[[1,10],[2,3],[4,5],[6,7],[8,9]]
`,expect:`1 10`},{stdin:`[[1,2],[2,3],[3,4],[4,5]]
`,expect:`1 5`}],hidden:[{stdin:`[[1,3],[2,4],[5,7],[6,8]]
`,expect:`1 4
5 8`},{stdin:`[[1,2],[3,5],[4,6],[7,8],[9,10]]
`,expect:`1 2
3 6
7 8
9 10`}],hint:`Sort intervals by start time and merge overlapping ones.`,reference:`function solve(lines) {
  const intervals = JSON.parse(lines[0]);
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const interval of intervals) {
    if (merged.length === 0 || merged[merged.length - 1][1] < interval[0]) {
      merged.push(interval);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], interval[1]);
    }
  }
  return merged.map(interval => interval.join(' '));
}`,pattern:`interval`},{kind:`cli`,id:`merge-k-sorted-lists`,title:`Merge k Sorted Lists`,difficulty:3,prompt:`You are given an array of k sorted linked lists. Merge all the linked lists into one sorted linked list and return it. Each linked list is represented as an array of integers. The output should be a single sorted array containing all the elements from the k linked lists. The input will contain at least one linked list and at most 100 linked lists, with each list containing up to 1000 integers. All integers are in the range of -10^6 to 10^6.`,io:`3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000`,starters:{python:`import sys

# Input:
#   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
5
7
8
10
12
15
20
25
30
35
40
50
55
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
210
220
230
240
250
260
270
280
290
300
310
320
330
340
350
360
370
380
390
400
410
420
430
440
450
460
470
480
490
500
510
520
530
540
550
560
570
580
590
600
610
620
630
640
650
660
670
680
690
700
710
720
730
740
750
760
770
780
790
800
810
820
830
840
850
860
870
880
890
900
910
920
930
940
950
960
970
980
990
1000
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[[1,4,5],[1,3,4],[2,6]]
`,expect:`1
1
2
3
4
4
5
6
`},{stdin:`[[2,6],[1,3,5],[4]]
`,expect:`1
2
3
4
5
6
`},{stdin:`[[10,20,30],[5,15,25],[1,2,3]]
`,expect:`1
2
3
5
10
15
20
25
30
`},{stdin:`[[7,8,9],[1,2,3],[4,5,6]]
`,expect:`1
2
3
4
5
6
7
8
9
`},{stdin:`[[1],[2],[3],[4],[5]]
`,expect:`1
2
3
4
5
`}],hidden:[{stdin:`[[1,2,3],[4,5,6],[7,8,9]]
`,expect:`1
2
3
4
5
6
7
8
9
`},{stdin:`[[10,20],[15,25],[5,30]]
`,expect:`5
10
15
20
25
30
`},{stdin:`[[100],[200],[300],[400],[500]]
`,expect:`100
200
300
400
500
`}],hint:`Consider using a min-heap to efficiently merge the lists.`,reference:`function solve(lines) {
  const lists = JSON.parse(lines[0]);
  const merged = [];
  lists.forEach(list => merged.push(...list));
  merged.sort((a, b) => a - b);
  return merged.map(String);
}`,pattern:`heap`},{kind:`cli`,id:`mini-parser`,title:`Mini Parser`,difficulty:2,prompt:`You are tasked with parsing a nested list structure represented as a string. Each element in the list can be an integer or another nested list. Your goal is to convert this string representation into a nested list of integers. The string will be formatted such that integers are separated by commas and nested lists are enclosed in brackets. For example, the string '[1,2,[3,4,[5]]]' should be converted to the nested list structure [[1,2],[3,4,[5]]]. Write a function that takes this string as input and returns the corresponding nested list.`,io:`Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5`,starters:{python:`import sys

# Input:
#   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   Input:
[1,2,[3,4,[5]]]
Output:
1
2
3
4
5
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1,2,[3,4,[5]]]
`,expect:`1
2
3
4
5`},{stdin:`[10,[20,30],40]
`,expect:`10
20
30
40`},{stdin:`[[],[1,[2,[3]]]]
`,expect:`1
2
3`},{stdin:`[1,[2,3],[4,[5,6]]]
`,expect:`1
2
3
4
5
6`}],hidden:[{stdin:`[[[1,2],3],4]
`,expect:`1
2
3
4`},{stdin:`[1,[2,[3,[4,[5]]]]]
`,expect:`1
2
3
4
5`}],hint:`Consider using a stack to manage nested lists while parsing the string.`,reference:`function solve(lines) {
  const out = [];
  const parseList = (str) => {
    let stack = [];
    let current = [];
    let num = '';
    for (let char of str) {
      if (char === '[') {
        stack.push(current);
        current = [];
      } else if (char === ']') {
        if (num) {
          current.push(parseInt(num));
          num = '';
        }
        const last = stack.pop();
        last.push(current);
        current = last;
      } else if (char === ',') {
        if (num) {
          current.push(parseInt(num));
          num = '';
        }
      } else {
        num += char;
      }
    }
    return current;
  };
  const nestedList = parseList(lines[0].trim());
  const flatten = (list) => {
    for (let item of list) {
      if (Array.isArray(item)) {
        flatten(item);
      } else {
        out.push(item);
      }
    }
  };
  flatten(nestedList);
  return out;
}`,pattern:`stack`},{kind:`cli`,id:`minimum-add-to-make-parentheses-valid`,title:`Minimum Add to Make Parentheses Valid`,difficulty:2,prompt:`You are given a string consisting of parentheses, and your task is to determine the minimum number of parentheses that need to be added to make the string valid. A valid string is one where every opening parenthesis has a corresponding closing parenthesis and they are correctly nested. For example, the string "(()" is valid, while the string "())(" is not. Your function should return the minimum number of parentheses needed to make the input string valid.`,io:`2`,starters:{python:`import sys

# Input:
#   2
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   2
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   2
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   2
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   2
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   2
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`())(
`,expect:`2
`},{stdin:`((
`,expect:`2
`},{stdin:`())
`,expect:`1
`},{stdin:`()()()
`,expect:`0
`},{stdin:`((()))
`,expect:`0
`}],hidden:[{stdin:`()(
`,expect:`1
`},{stdin:`())())(
`,expect:`3
`}],hint:`Count unmatched parentheses to find how many need to be added.`,reference:`function solve(lines) {
  const out = [];
  let open = 0;
  let close = 0;
  for (let char of lines[0]) {
    if (char === '(') {
      open++;
    } else if (char === ')') {
      if (open > 0) {
        open--;
      } else {
        close++;
      }
    }
  }
  out.push((open + close).toString());
  return out;
}`,pattern:`string`},{kind:`cli`,id:`product-of-array-except-self`,title:`Product of Array Except Self`,difficulty:2,prompt:`Given an array of integers, return an array such that each element at index i of the output array is the product of all the numbers in the input array except the number at i. You must do this without using division and in O(n) time complexity. The input array will have at least one element and at most 1000 elements.`,io:`3
2
6
1`,starters:{python:`import sys

# Input:
#   3
2
6
1
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`,javascript:`// Input:
//   3
2
6
1
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`,typescript:`// Input:
//   3
2
6
1
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`,cpp:`#include <bits/stdc++.h>
using namespace std;

// Input:
//   3
2
6
1
vector<string> solve(const vector<string>& lines) {
    vector<string> out;
    // your code here — push each output line onto out
    return out;
}

int main() {
    vector<string> lines;
    string l;
    while (getline(cin, l)) lines.push_back(l);
    for (const string& o : solve(lines)) cout << o << "\\n";
    return 0;
}
`,java:`import java.util.*;

class Main {
    // Input:
    //   3
2
6
1
    static List<String> solve(List<String> lines) {
        List<String> out = new ArrayList<>();
        // your code here — add each output line to out
        return out;
    }

    public static void main(String[] args) {
        Scanner s = new Scanner(System.in);
        List<String> lines = new ArrayList<>();
        while (s.hasNextLine()) lines.add(s.nextLine());
        for (String o : solve(lines)) System.out.println(o);
    }
}
`,go:`package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   3
2
6
1
func solve(lines []string) []string {
    out := []string{}
    // your code here — append each output line to out
    return out
}

func main() {
    sc := bufio.NewScanner(os.Stdin)
    var lines []string
    for sc.Scan() {
        lines = append(lines, sc.Text())
    }
    for _, o := range solve(lines) {
        fmt.Println(o)
    }
}
`},tests:[{stdin:`[1,2,3,4]
`,expect:`24
12
8
6
`},{stdin:`[5,1,2]
`,expect:`2
10
5
`},{stdin:`[0,1,2,3]
`,expect:`6
0
0
0
`}],hidden:[{stdin:`[1,0,3,4]
`,expect:`0
12
0
0
`},{stdin:`[2,2,2,2,2]
`,expect:`16
16
16
16
16
`}],hint:`Consider using two passes to calculate products from both sides of the array.`,reference:`function solve(lines) {
  const out = [];
  const nums = JSON.parse(lines[0]);
  const length = nums.length;
  const output = new Array(length).fill(1);

  let leftProduct = 1;
  for (let i = 0; i < length; i++) {
    output[i] = leftProduct;
    leftProduct *= nums[i];
  }

  let rightProduct = 1;
  for (let i = length - 1; i >= 0; i--) {
    output[i] *= rightProduct;
    rightProduct *= nums[i];
  }

  output.forEach(value => out.push(value.toString()));
  return out;
}`,pattern:`mixed`}],x={"basic-calculator-ii":[`meta`],"can-place-flowers":[`microsoft`],"construct-k-palindrome-strings":[`uber`],"dot-product-of-two-sparse-vectors":[`meta`],"first-bad-version":[`google`],"first-missing-positive":[`microsoft`],"flatten-2d-vector":[`airbnb`],"generate-parentheses":[`apple`],"happy-number":[`google`],"intersection-of-two-linked-lists":[`airbnb`],"kth-largest-element-in-an-array":[`meta`,`microsoft`],"letter-combinations-of-a-phone-number":[`microsoft`,`uber`],"linked-list-cycle":[`spotify`],"longest-palindromic-substring":[`microsoft`],"longest-substring-without-repeating-characters":[`amazon`,`apple`,`microsoft`,`spotify`],"median-of-two-sorted-arrays":[`amazon`,`apple`],"meeting-rooms-ii":[`amazon`,`google`],"merge-intervals":[`amazon`,`apple`,`google`,`meta`,`uber`],"merge-k-sorted-lists":[`amazon`,`apple`,`microsoft`],"mini-parser":[`airbnb`],"minimum-add-to-make-parentheses-valid":[`meta`],"product-of-array-except-self":[`apple`,`uber`]},S={"basic-calculator-ii":`Strings & stacks`,"can-place-flowers":`Arrays & hashing`,"construct-k-palindrome-strings":`Arrays & hashing`,"dot-product-of-two-sparse-vectors":`Algorithms`,"first-bad-version":`Search & sorting`,"first-missing-positive":`Arrays & hashing`,"flatten-2d-vector":`Algorithms`,"generate-parentheses":`Search & sorting`,"happy-number":`Arrays & hashing`,"intersection-of-two-linked-lists":`Arrays & hashing`,"kth-largest-element-in-an-array":`Arrays & hashing`,"letter-combinations-of-a-phone-number":`Search & sorting`,"linked-list-cycle":`Arrays & hashing`,"longest-palindromic-substring":`Dynamic programming`,"longest-substring-without-repeating-characters":`Arrays & hashing`,"median-of-two-sorted-arrays":`Search & sorting`,"meeting-rooms-ii":`Arrays & hashing`,"merge-intervals":`Arrays & hashing`,"merge-k-sorted-lists":`Dynamic programming`,"mini-parser":`Strings & stacks`,"minimum-add-to-make-parentheses-valid":`Strings & stacks`,"product-of-array-except-self":`Algorithms`},C=[{id:`python`,label:`Python`,compiler:`cpython-3.11.10`,offline:!1},{id:`javascript`,label:`JavaScript`,compiler:`nodejs-18.20.4`,offline:!0},{id:`typescript`,label:`TypeScript`,compiler:`typescript-5.6.2`,offline:!1,prelude:`declare const require: (m: string) => any;
declare const process: any;
`},{id:`cpp`,label:`C++`,compiler:`gcc-13.2.0`,offline:!1},{id:`java`,label:`Java`,compiler:`openjdk-jdk-21+35`,offline:!1},{id:`go`,label:`Go`,compiler:`go-1.23.2`,offline:!1}],w=e=>T.find(t=>t.id===e),T=[{kind:`cli`,id:`two-sum`,title:`Two Sum`,difficulty:1,prompt:`Given an array of integers and a target, return the 0-based indices of the two numbers that add up to the target. Each input has exactly one solution and you may not use the same element twice.`,io:`Line 1: n (array length) · Line 2: n space-separated integers · Line 3: target. Output: the two indices separated by a space.`,starters:{python:a(`Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"`),javascript:o(`Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"`),typescript:s(`Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"`),cpp:c(`Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"`),java:l(`Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"`),go:u(`Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. "0 2"`)},tests:[{stdin:`4
2 7 11 15
9
`,expect:`0 1`},{stdin:`3
3 2 4
6
`,expect:`1 2`},{stdin:`2
3 3
6
`,expect:`0 1`},{stdin:`5
1 5 3 9 2
11
`,expect:`3 4`}],hidden:[{stdin:`6
-3 4 3 90 0 7
94
`,expect:`1 3`},{stdin:`7
1 2 3 4 5 6 7
13
`,expect:`5 6`},{stdin:`10
0 4 3 0 8 6 9 2 1 5
0
`,expect:`0 3`}],hint:`Hash the numbers you've seen; for each value check whether the complement target - x is already stored.`,reference:`function solve(lines) {
  const n = Number(lines[0]);
  const arr = lines[1].split(" ").map(Number);
  const target = Number(lines[2]);
  const idx = new Map();
  for (let i = 0; i < n; i++) {
    const need = target - arr[i];
    if (idx.has(need)) return [idx.get(need) + " " + i];
    idx.set(arr[i], i);
  }
  return [];
}`},{kind:`cli`,id:`valid-parens`,title:`Valid Parentheses`,difficulty:2,prompt:`Given a string containing just the characters ( ) { } [ ], determine if the brackets are balanced and correctly nested.`,io:`Single line: the bracket string. Output true if valid, otherwise false.`,starters:{python:a(`Single line: bracket string → output true or false`),javascript:o(`Single line: bracket string → output true or false`),typescript:s(`Single line: bracket string → output true or false`),cpp:c(`Single line: bracket string → output true or false`),java:l(`Single line: bracket string → output true or false`),go:u(`Single line: bracket string → output true or false`)},tests:[{stdin:`()[]{}`,expect:`true`},{stdin:`([{}])`,expect:`true`},{stdin:`(]`,expect:`false`},{stdin:`([)]`,expect:`false`},{stdin:`{[]}`,expect:`true`},{stdin:``,expect:`true`}],hidden:[{stdin:`((()))`,expect:`true`},{stdin:`({[}])`,expect:`false`},{stdin:`([{}()])`,expect:`true`},{stdin:`)(`,expect:`false`}],hint:`Push openers onto a stack; a closer must match the top, and the stack must be empty at the end.`,reference:`function solve(lines) {
  const s = lines[0] || "";
  const stack = [];
  const match = { ")": "(", "]": "[", "}": "{" };
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (stack.pop() !== match[ch]) return ["false"];
  }
  return [String(stack.length === 0)];
}`},{kind:`cli`,id:`max-subarray`,title:`Maximum Subarray`,difficulty:2,prompt:`Given an integer array, find the contiguous subarray with the largest sum (Kadane's algorithm) and output that sum.`,io:`Line 1: n (array length) · Line 2: n space-separated integers (may be negative). Output: the maximum subarray sum.`,starters:{python:a(`Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum`),javascript:o(`Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum`),typescript:s(`Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum`),cpp:c(`Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum`),java:l(`Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum`),go:u(`Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum`)},tests:[{stdin:`9
-2 1 -3 4 -1 2 1 -5 4
`,expect:`6`},{stdin:`1
-1
`,expect:`-1`},{stdin:`5
5 4 -1 7 8
`,expect:`23`},{stdin:`4
-2 -3 -1 -5
`,expect:`-1`}],hidden:[{stdin:`8
-1 2 -1 3 -2 4 -1 2
`,expect:`7`},{stdin:`2
-2 -1
`,expect:`-1`},{stdin:`11
8 -19 5 -4 20 2 -9 3 7 -1 4
`,expect:`27`}],hint:`Kadane: keep the best sum ending here (max of current or current + previous best) and track the all-time max.`,reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let best = -Infinity, cur = -Infinity;
  for (const x of arr) { cur = Math.max(x, cur + x); best = Math.max(best, cur); }
  return [String(best)];
}`},{kind:`cli`,id:`binary-search`,title:`Binary Search`,difficulty:1,prompt:`Given a sorted array and a target, return the index of the target, or -1 if it's not present.`,io:`Line 1: n (array length) · Line 2: n sorted space-separated integers · Line 3: target. Output: the target's index or -1.`,starters:{python:a(`Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1`),javascript:o(`Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1`),typescript:s(`Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1`),cpp:c(`Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1`),java:l(`Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1`),go:u(`Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1`)},tests:[{stdin:`6
-1 0 3 5 9 12
9
`,expect:`4`},{stdin:`6
-1 0 3 5 9 12
2
`,expect:`-1`},{stdin:`1
7
7
`,expect:`0`},{stdin:`5
1 2 3 4 5
6
`,expect:`-1`}],hint:`Halve the search space each step: compare the middle element with the target and recurse into one side.`,reference:`function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const target = Number(lines[2]);
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return [String(mid)];
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return ["-1"];
}`},{kind:`cli`,id:`buy-sell`,title:`Best Time to Buy and Sell Stock`,difficulty:2,prompt:`Given an array of daily prices, choose one day to buy and a later day to sell, maximizing profit. Output the max profit (0 if no profit is possible).`,io:`Line 1: n (number of days) · Line 2: n space-separated prices. Output: the maximum profit.`,starters:{python:a(`Line 1: n · Line 2: n prices → output the max profit (0 if none)`),javascript:o(`Line 1: n · Line 2: n prices → output the max profit (0 if none)`),typescript:s(`Line 1: n · Line 2: n prices → output the max profit (0 if none)`),cpp:c(`Line 1: n · Line 2: n prices → output the max profit (0 if none)`),java:l(`Line 1: n · Line 2: n prices → output the max profit (0 if none)`),go:u(`Line 1: n · Line 2: n prices → output the max profit (0 if none)`)},tests:[{stdin:`6
7 1 5 3 6 4
`,expect:`5`},{stdin:`5
7 6 4 3 1
`,expect:`0`},{stdin:`2
1 2
`,expect:`1`},{stdin:`7
3 2 6 5 0 3 9
`,expect:`9`}],hidden:[{stdin:`5
6 4 3 1 7
`,expect:`6`},{stdin:`8
1 8 2 7 3 6 4 5
`,expect:`7`},{stdin:`3
5 5 5
`,expect:`0`}],hint:`Track the cheapest price seen so far; profit = price - min(price) and keep the max.`,reference:`function solve(lines) {
  const prices = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let min = Infinity, best = 0;
  for (const p of prices) { min = Math.min(min, p); best = Math.max(best, p - min); }
  return [String(best)];
}`},{kind:`cli`,id:`fizzbuzz`,title:`FizzBuzz`,difficulty:1,prompt:`Print the numbers from 1 to n, but for multiples of 3 print Fizz, for multiples of 5 print Buzz, and for multiples of both print FizzBuzz. A great warm-up to confirm the runner works in any language.`,io:`Single line: n. Output: n lines — 1..n with the Fizz/Buzz substitutions.`,starters:{python:a(`Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both`),javascript:o(`Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both`),typescript:s(`Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both`),cpp:c(`Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both`),java:l(`Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both`),go:u(`Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both`)},tests:[{stdin:`15
`,expect:`1
2
Fizz
4
Buzz
Fizz
7
8
Fizz
Buzz
11
Fizz
13
14
FizzBuzz`},{stdin:`5
`,expect:`1
2
Fizz
4
Buzz`},{stdin:`1
`,expect:`1`}],hint:`For each i from 1 to n: print FizzBuzz if divisible by 15, Fizz if by 3, Buzz if by 5, else the number.`,reference:`function solve(lines) {
  const n = Number(lines[0] || 0);
  const out = [];
  for (let i = 1; i <= n; i++) {
    out.push(i % 15 === 0 ? "FizzBuzz" : i % 3 === 0 ? "Fizz" : i % 5 === 0 ? "Buzz" : String(i));
  }
  return out;
}`},...d,...b,...i,...p,...h,...y];function E(){return t(n.codingTrack,{})}function D(t,i){let a=E(),o=a[t]??{fails:0,solved:!1};a[t]=i?{...o,solved:!0}:{fails:o.fails+1,solved:o.solved},e(n.codingTrack,a),r(`coding_attempt`,{problemId:t,passed:i})}function O(e=T){let t=E(),n=[];for(let r of e){let e=t[r.id];if(!e||e.solved||e.fails<2)continue;let i=r.hint?.trim();if(n.push({q:`Code: ${r.title}`,a:i&&i.length>0?i:r.kind===`fn`?`Implement ${r.fn.name}(${r.fn.args}) → ${r.fn.returns}.`:r.prompt,kp:[k(r),`Practice in the playground — tests are hidden, so verify edge cases yourself.`],lvl:r.difficulty===1?`junior`:r.difficulty===2?`mid`:`senior`,codeId:r.id}),n.length>=6)break}return n}var k=e=>e.kind===`cli`?`Algorithms`:e.kind===`fn`?`JS functions`:`UI components`;export{C as a,x as c,T as i,E as n,w as o,D as r,S as s,O as t};