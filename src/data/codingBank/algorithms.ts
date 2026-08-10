/* Algorithm CLI bank — classic coding problems in the stdin/stdout format,
   judged by Wandbox (or the local JS engine). Every problem carries a JS
   `reference` — the bank self-test (src/__tests__/algorithms.test.ts) runs each
   through the local engine against its own visible + hidden cases, so a broken
   problem or test can never ship silently. */

import type { CliProblem } from "../coding";
import { CPP, GO, JAVA, JS, PY, TS } from "../starters";

export const ALGORITHM_PROBLEMS: CliProblem[] = [
  {
    kind: "cli",
    id: "reverse-string",
    title: "Reverse String",
    difficulty: 1,
    prompt: "Reverse the given string.",
    io: "Single line: the string. Output: the reversed string.",
    starters: { python: PY("single line: string → reversed string"), javascript: JS("single line: string → reversed string"), typescript: TS("single line: string → reversed string"), cpp: CPP("single line: string → reversed string"), java: JAVA("single line: string → reversed string"), go: GO("single line: string → reversed string") },
    tests: [
      { stdin: "hello\n", expect: "olleh" },
      { stdin: "a\n", expect: "a" },
      { stdin: "A man a plan\n", expect: "nalp a nam A" }
    ],
    hidden: [
      { stdin: "\n", expect: "" },
      { stdin: "racecar\n", expect: "racecar" }
    ],
    hint: "Split into characters, reverse, join.",
    reference: `function solve(lines) {
  return [(lines[0] || "").split("").reverse().join("")];
}`
  },
  {
    kind: "cli",
    id: "palindrome",
    title: "Palindrome Check",
    difficulty: 1,
    prompt: "Determine whether a string reads the same forward and backward, ignoring case. Output true or false.",
    io: "Single line: the string. Output: true if a palindrome, otherwise false.",
    starters: { python: PY("single line: string → true or false"), javascript: JS("single line: string → true or false"), typescript: TS("single line: string → true or false"), cpp: CPP("single line: string → true or false"), java: JAVA("single line: string → true or false"), go: GO("single line: string → true or false") },
    tests: [
      { stdin: "racecar\n", expect: "true" },
      { stdin: "Racecar\n", expect: "true" },
      { stdin: "hello\n", expect: "false" },
      { stdin: "a\n", expect: "true" }
    ],
    hidden: [
      { stdin: "\n", expect: "true" },
      { stdin: "never odd or even\n", expect: "false" }
    ],
    hint: "Compare the lowercased string with its reverse.",
    reference: `function solve(lines) {
  const s = (lines[0] || "").toLowerCase();
  return [String(s === s.split("").reverse().join(""))];
}`
  },
  {
    kind: "cli",
    id: "contains-duplicate",
    title: "Contains Duplicate",
    difficulty: 1,
    prompt: "Given an array of integers, output true if any value appears at least twice, otherwise false.",
    io: "Line 1: n (array length) · Line 2: n space-separated integers. Output: true or false.",
    starters: { python: PY("Line 1: n · Line 2: n ints → true or false"), javascript: JS("Line 1: n · Line 2: n ints → true or false"), typescript: TS("Line 1: n · Line 2: n ints → true or false"), cpp: CPP("Line 1: n · Line 2: n ints → true or false"), java: JAVA("Line 1: n · Line 2: n ints → true or false"), go: GO("Line 1: n · Line 2: n ints → true or false") },
    tests: [
      { stdin: "4\n1 2 3 1\n", expect: "true" },
      { stdin: "4\n1 2 3 4\n", expect: "false" },
      { stdin: "3\n1 1 1\n", expect: "true" }
    ],
    hidden: [
      { stdin: "0\n\n", expect: "false" },
      { stdin: "2\n-1 -1\n", expect: "true" }
    ],
    hint: "A Set is shorter than the array iff a duplicate exists.",
    reference: `function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  return [String(new Set(arr).size !== arr.length)];
}`
  },
  {
    kind: "cli",
    id: "valid-anagram",
    title: "Valid Anagram",
    difficulty: 1,
    prompt: "Given two strings, output true if they are anagrams (same characters with the same counts), otherwise false.",
    io: "Line 1: first string · Line 2: second string. Output: true or false.",
    starters: { python: PY("Line 1: s · Line 2: t → true or false"), javascript: JS("Line 1: s · Line 2: t → true or false"), typescript: TS("Line 1: s · Line 2: t → true or false"), cpp: CPP("Line 1: s · Line 2: t → true or false"), java: JAVA("Line 1: s · Line 2: t → true or false"), go: GO("Line 1: s · Line 2: t → true or false") },
    tests: [
      { stdin: "anagram\nnagaram\n", expect: "true" },
      { stdin: "rat\ncar\n", expect: "false" },
      { stdin: "a\na\n", expect: "true" },
      { stdin: "ab\nba\n", expect: "true" }
    ],
    hidden: [
      { stdin: "abc\nabd\n", expect: "false" },
      { stdin: "\n\n", expect: "true" }
    ],
    hint: "Two strings are anagrams iff sorting their characters gives the same result.",
    reference: `function solve(lines) {
  const key = (s) => (s || "").split("").sort().join("");
  return [String(key(lines[0]) === key(lines[1]))];
}`
  },
  {
    kind: "cli",
    id: "fibonacci",
    title: "Fibonacci",
    difficulty: 1,
    prompt: "Output the n-th Fibonacci number, 0-indexed: fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2).",
    io: "Single line: n. Output: the n-th Fibonacci number.",
    starters: { python: PY("single line: n → fib(n)"), javascript: JS("single line: n → fib(n)"), typescript: TS("single line: n → fib(n)"), cpp: CPP("single line: n → fib(n)"), java: JAVA("single line: n → fib(n)"), go: GO("single line: n → fib(n)") },
    tests: [
      { stdin: "0\n", expect: "0" },
      { stdin: "1\n", expect: "1" },
      { stdin: "10\n", expect: "55" },
      { stdin: "20\n", expect: "6765" }
    ],
    hidden: [
      { stdin: "2\n", expect: "1" },
      { stdin: "30\n", expect: "832040" }
    ],
    hint: "Iterate with two running values — O(n) time, O(1) space.",
    reference: `function solve(lines) {
  const n = Number(lines[0] || 0);
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; }
  return [String(a)];
}`
  },
  {
    kind: "cli",
    id: "merge-sorted",
    title: "Merge Sorted Arrays",
    difficulty: 2,
    prompt: "Merge two sorted arrays into one sorted array.",
    io: "Line 1: n m (lengths) · Line 2: n sorted integers · Line 3: m sorted integers. Output: the merged, sorted array.",
    starters: { python: PY("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"), javascript: JS("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"), typescript: TS("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"), cpp: CPP("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"), java: JAVA("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints"), go: GO("Line 1: n m · Line 2: n sorted ints · Line 3: m sorted ints → merged sorted ints") },
    tests: [
      { stdin: "3 3\n1 2 4\n1 3 4\n", expect: "1 1 2 3 4 4" },
      { stdin: "0 1\n\n2\n", expect: "2" },
      { stdin: "2 0\n1 5\n\n", expect: "1 5" },
      { stdin: "3 2\n1 3 5\n2 4\n", expect: "1 2 3 4 5" }
    ],
    hidden: [
      { stdin: "1 1\n0\n0\n", expect: "0 0" },
      { stdin: "0 0\n\n\n", expect: "" }
    ],
    hint: "Two pointers from the front, appending the smaller element each step.",
    reference: `function solve(lines) {
  const a = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const b = (lines[2] || "").split(" ").filter(Boolean).map(Number);
  const out = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] <= b[j])) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return [out.join(" ")];
}`
  },
  {
    kind: "cli",
    id: "longest-common-prefix",
    title: "Longest Common Prefix",
    difficulty: 2,
    prompt: "Given a list of strings, output their longest common prefix (empty string if there is none).",
    io: "Line 1: n · next n lines: the strings. Output: the common prefix.",
    starters: { python: PY("Line 1: n · next n lines: strings → longest common prefix"), javascript: JS("Line 1: n · next n lines: strings → longest common prefix"), typescript: TS("Line 1: n · next n lines: strings → longest common prefix"), cpp: CPP("Line 1: n · next n lines: strings → longest common prefix"), java: JAVA("Line 1: n · next n lines: strings → longest common prefix"), go: GO("Line 1: n · next n lines: strings → longest common prefix") },
    tests: [
      { stdin: "3\nflower\nflow\nflight\n", expect: "fl" },
      { stdin: "3\ndog\nracecar\ncar\n", expect: "" },
      { stdin: "1\nalone\n", expect: "alone" }
    ],
    hidden: [
      { stdin: "2\n\nx\n", expect: "" },
      { stdin: "2\ninterspecies\ninterstellar\n", expect: "inters" }
    ],
    hint: "Start with the first string as the prefix and shrink it against each next string.",
    reference: `function solve(lines) {
  const n = Number(lines[0] || 0);
  const strs = lines.slice(1, 1 + n).map(s => s ?? "");
  if (!strs.length) return [""];
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return [prefix];
}`
  },
  {
    kind: "cli",
    id: "first-unique-char",
    title: "First Unique Character",
    difficulty: 2,
    prompt: "Output the index of the first non-repeating character in the string, or -1 if every character repeats.",
    io: "Single line: the string. Output: the index or -1.",
    starters: { python: PY("single line: string → index of first unique char or -1"), javascript: JS("single line: string → index of first unique char or -1"), typescript: TS("single line: string → index of first unique char or -1"), cpp: CPP("single line: string → index of first unique char or -1"), java: JAVA("single line: string → index of first unique char or -1"), go: GO("single line: string → index of first unique char or -1") },
    tests: [
      { stdin: "leetcode\n", expect: "0" },
      { stdin: "loveleetcode\n", expect: "2" },
      { stdin: "aabb\n", expect: "-1" },
      { stdin: "a\n", expect: "0" }
    ],
    hidden: [
      { stdin: "\n", expect: "-1" },
      { stdin: "abcdefghijklmnopqrstuvwxyz\n", expect: "0" }
    ],
    hint: "Count occurrences in one pass, then scan for the first char with count 1.",
    reference: `function solve(lines) {
  const s = lines[0] || "";
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (let i = 0; i < s.length; i++) if (counts.get(s[i]) === 1) return [String(i)];
  return ["-1"];
}`
  },
  {
    kind: "cli",
    id: "move-zeroes",
    title: "Move Zeroes",
    difficulty: 2,
    prompt: "Move all zeros in the array to the end while preserving the relative order of the non-zero elements.",
    io: "Line 1: n · Line 2: n space-separated integers. Output: the rearranged array.",
    starters: { python: PY("Line 1: n · Line 2: n ints → array with zeros at the end"), javascript: JS("Line 1: n · Line 2: n ints → array with zeros at the end"), typescript: TS("Line 1: n · Line 2: n ints → array with zeros at the end"), cpp: CPP("Line 1: n · Line 2: n ints → array with zeros at the end"), java: JAVA("Line 1: n · Line 2: n ints → array with zeros at the end"), go: GO("Line 1: n · Line 2: n ints → array with zeros at the end") },
    tests: [
      { stdin: "5\n0 1 0 3 12\n", expect: "1 3 12 0 0" },
      { stdin: "1\n0\n", expect: "0" },
      { stdin: "3\n1 2 3\n", expect: "1 2 3" },
      { stdin: "3\n0 0 1\n", expect: "1 0 0" }
    ],
    hidden: [
      { stdin: "4\n0 0 0 0\n", expect: "0 0 0 0" },
      { stdin: "5\n4 0 5 0 6\n", expect: "4 5 6 0 0" }
    ],
    hint: "A write pointer overwrites non-zeros in order; fill the tail with zeros.",
    reference: `function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let write = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] !== 0) arr[write++] = arr[i];
  while (write < arr.length) arr[write++] = 0;
  return [arr.join(" ")];
}`
  },
  {
    kind: "cli",
    id: "missing-number",
    title: "Missing Number",
    difficulty: 2,
    prompt: "Given n distinct integers in the range [0, n], output the one integer from that range that is missing.",
    io: "Line 1: n · Line 2: n space-separated integers. Output: the missing integer.",
    starters: { python: PY("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"), javascript: JS("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"), typescript: TS("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"), cpp: CPP("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"), java: JAVA("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int"), go: GO("Line 1: n · Line 2: n distinct ints in [0, n] → the missing int") },
    tests: [
      { stdin: "3\n3 0 1\n", expect: "2" },
      { stdin: "2\n0 1\n", expect: "2" },
      { stdin: "1\n0\n", expect: "1" }
    ],
    hidden: [
      { stdin: "8\n9 6 4 2 3 5 7 0 1\n", expect: "8" },
      { stdin: "2\n0 2\n", expect: "1" }
    ],
    hint: "Sum of 0..n minus the sum of the array gives the missing number.",
    reference: `function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const n = arr.length;
  return [String((n * (n + 1)) / 2 - arr.reduce((a, b) => a + b, 0))];
}`
  },
  {
    kind: "cli",
    id: "majority-element",
    title: "Majority Element",
    difficulty: 2,
    prompt: "Given an array where one element appears more than n/2 times, output that element.",
    io: "Line 1: n · Line 2: n space-separated integers. Output: the majority element.",
    starters: { python: PY("Line 1: n · Line 2: n ints → the majority element"), javascript: JS("Line 1: n · Line 2: n ints → the majority element"), typescript: TS("Line 1: n · Line 2: n ints → the majority element"), cpp: CPP("Line 1: n · Line 2: n ints → the majority element"), java: JAVA("Line 1: n · Line 2: n ints → the majority element"), go: GO("Line 1: n · Line 2: n ints → the majority element") },
    tests: [
      { stdin: "3\n3 2 3\n", expect: "3" },
      { stdin: "7\n2 2 1 1 1 2 2\n", expect: "2" },
      { stdin: "1\n1\n", expect: "1" }
    ],
    hidden: [
      { stdin: "5\n-1 -1 -1 2 2\n", expect: "-1" },
      { stdin: "9\n6 6 6 1 2 3 6 6 6\n", expect: "6" }
    ],
    hint: "Boyer-Moore: cancel different pairs; the survivor is the majority.",
    reference: `function solve(lines) {
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  let candidate = arr[0], count = 0;
  for (const x of arr) {
    if (count === 0) candidate = x;
    count += x === candidate ? 1 : -1;
  }
  return [String(candidate)];
}`
  },
  {
    kind: "cli",
    id: "rotate-array",
    title: "Rotate Array",
    difficulty: 2,
    prompt: "Rotate the array to the right by k steps.",
    io: "Line 1: n k · Line 2: n space-separated integers. Output: the rotated array.",
    starters: { python: PY("Line 1: n k · Line 2: n ints → array rotated right by k"), javascript: JS("Line 1: n k · Line 2: n ints → array rotated right by k"), typescript: TS("Line 1: n k · Line 2: n ints → array rotated right by k"), cpp: CPP("Line 1: n k · Line 2: n ints → array rotated right by k"), java: JAVA("Line 1: n k · Line 2: n ints → array rotated right by k"), go: GO("Line 1: n k · Line 2: n ints → array rotated right by k") },
    tests: [
      { stdin: "7 3\n1 2 3 4 5 6 7\n", expect: "5 6 7 1 2 3 4" },
      { stdin: "4 2\n-1 -100 3 99\n", expect: "3 99 -1 -100" },
      { stdin: "2 3\n1 2\n", expect: "2 1" },
      { stdin: "3 0\n1 2 3\n", expect: "1 2 3" }
    ],
    hidden: [
      { stdin: "5 7\n1 2 3 4 5\n", expect: "4 5 1 2 3" },
      { stdin: "1 10\n9\n", expect: "9" }
    ],
    hint: "Normalize k modulo n, then slice the last k elements in front.",
    reference: `function solve(lines) {
  const [n, k] = (lines[0] || "").split(" ").map(Number);
  const arr = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  if (!n) return [""];
  const r = ((k % n) + n) % n;
  return [arr.slice(n - r).concat(arr.slice(0, n - r)).join(" ")];
}`
  },
  {
    kind: "cli",
    id: "climbing-stairs",
    title: "Climbing Stairs",
    difficulty: 2,
    prompt: "You can climb 1 or 2 steps at a time. Output the number of distinct ways to reach the top of n stairs.",
    io: "Single line: n. Output: the number of ways.",
    starters: { python: PY("single line: n → number of ways to climb n stairs"), javascript: JS("single line: n → number of ways to climb n stairs"), typescript: TS("single line: n → number of ways to climb n stairs"), cpp: CPP("single line: n → number of ways to climb n stairs"), java: JAVA("single line: n → number of ways to climb n stairs"), go: GO("single line: n → number of ways to climb n stairs") },
    tests: [
      { stdin: "2\n", expect: "2" },
      { stdin: "3\n", expect: "3" },
      { stdin: "4\n", expect: "5" },
      { stdin: "10\n", expect: "89" }
    ],
    hidden: [
      { stdin: "1\n", expect: "1" },
      { stdin: "45\n", expect: "1836311903" }
    ],
    hint: "ways(n) = ways(n-1) + ways(n-2) — iterate with two variables.",
    reference: `function solve(lines) {
  const n = Number(lines[0] || 0);
  if (n <= 2) return [String(n === 0 ? 0 : n === 1 ? 1 : 2)];
  let a = 1, b = 2;
  for (let i = 3; i <= n; i++) { const t = a + b; a = b; b = t; }
  return [String(b)];
}`
  },
  {
    kind: "cli",
    id: "intersection",
    title: "Intersection of Two Arrays",
    difficulty: 2,
    prompt: "Output the unique values present in both arrays, in the order they first appear in the first array.",
    io: "Line 1: n m · Line 2: n integers · Line 3: m integers. Output: the intersection, space-separated (empty line if none).",
    starters: { python: PY("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"), javascript: JS("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"), typescript: TS("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"), cpp: CPP("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"), java: JAVA("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order"), go: GO("Line 1: n m · Line 2: n ints · Line 3: m ints → unique common values in first-array order") },
    tests: [
      { stdin: "4 2\n1 2 2 1\n2 2\n", expect: "2" },
      { stdin: "3 4\n4 9 5\n9 4 9 8 4\n", expect: "4 9" },
      { stdin: "1 1\n1\n2\n", expect: "" }
    ],
    hidden: [
      { stdin: "0 2\n\n7 8\n", expect: "" },
      { stdin: "5 3\n1 2 3 4 5\n5 4 3\n", expect: "3 4 5" }
    ],
    hint: "Put the second array in a Set, then scan the first array for members you haven't emitted yet.",
    reference: `function solve(lines) {
  const a = (lines[1] || "").split(" ").filter(Boolean).map(Number);
  const b = new Set((lines[2] || "").split(" ").filter(Boolean).map(Number));
  const seen = new Set();
  const out = [];
  for (const x of a) {
    if (b.has(x) && !seen.has(x)) { seen.add(x); out.push(x); }
  }
  return [out.join(" ")];
}`
  }
];
