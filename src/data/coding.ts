/* Code playground catalog — classic interview coding problems with per-language
   starter code and test cases. Every starter reads its input via `solve(lines)`
   where `lines` is the stdin split by newline, and returns the output lines —
   the runner (services/runner.ts) supplies the actual stdin/stdout wrapper per
   language, so the same problem + tests work everywhere (Wandbox online, or the
   built-in JavaScript engine when offline). */

export type LangId = "python" | "javascript" | "typescript" | "cpp" | "java" | "go";

export interface RunnerLang {
  id: LangId;
  label: string;
  /** Wandbox compiler name (verified against the live API). */
  compiler: string;
  /** Can run locally in the browser without a network (JS only). */
  offline: boolean;
  /** Optional shebang/prelude prepended before the starter (e.g. TS ambient types). */
  prelude?: string;
}

export const RUNNER_LANGS: RunnerLang[] = [
  { id: "python", label: "Python", compiler: "cpython-3.11.10", offline: false },
  { id: "javascript", label: "JavaScript", compiler: "nodejs-18.20.4", offline: true },
  { id: "typescript", label: "TypeScript", compiler: "typescript-5.6.2", offline: false, prelude: "declare const require: (m: string) => any;\ndeclare const process: any;\n" },
  { id: "cpp", label: "C++", compiler: "gcc-13.2.0", offline: false },
  { id: "java", label: "Java", compiler: "openjdk-jdk-21+35", offline: false },
  { id: "go", label: "Go", compiler: "go-1.23.2", offline: false }
];

/* CLI problem: classic stdin/stdout judging (any runner language). */
export interface CliTest { stdin: string; expect: string }

export interface CliProblem {
  kind: "cli";
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  /** What the candidate is asked to do. */
  prompt: string;
  /** Exact input/output contract shown to the user. */
  io: string;
  /** Starter `solve(lines)` skeleton per language (returns output lines). */
  starters: Record<LangId, string>;
  tests: CliTest[];
  /** Hidden judge cases — run with the visible ones but never shown to the user. */
  hidden?: CliTest[];
}

/* Function problem: implement a named function; the judge calls it with typed
   args (or hands it to an optional `drive` harness for multi-call / timer-based
   behavior like debounce or EventEmitter) and deep-compares the result. */
export interface FnTest {
  /** Shown in the results list. */
  label?: string;
  /** Arguments passed to the user's function (functions are allowed). */
  args: unknown[];
  /** Expected return value — deep-compared (supports Date, NaN, undefined). */
  expect: unknown;
  /** Optional harness: receives the user's function/class, drives it (multiple
      calls, timers, `new`), and returns the value to compare with `expect`. */
  drive?: (fn: unknown) => unknown | Promise<unknown>;
}

export interface FnProblem {
  kind: "fn";
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  /** Taxonomy bucket shown in the picker (async · timing · collections · …). */
  category: string;
  prompt: string;
  /** Signature banner shown above the editor. */
  fn: { name: string; args: string; returns: string };
  /** JavaScript starter (function mode runs in the browser, fully offline). */
  starter: string;
  tests: FnTest[];
  hidden?: FnTest[];
  /** Reference implementation — the bank self-test asserts it passes its own tests. */
  reference: string;
}

export type CodingProblem = CliProblem | FnProblem;

export const codingProblemById = (id: string): CodingProblem | undefined => CODING_PROBLEMS.find(p => p.id === id);

const PY = (body: string) => `import sys

# Input:
#   ${body}
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`;

const JS = (body: string) => `// Input:
//   ${body}
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`;

const TS = (body: string) => `// Input:
//   ${body}
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`;

const CPP = (body: string) => `#include <bits/stdc++.h>
using namespace std;

// Input:
//   ${body}
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
`;

const JAVA = (body: string) => `import java.util.*;

class Main {
    // Input:
    //   ${body}
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
`;

const GO = (body: string) => `package main

import (
    "bufio"
    "fmt"
    "os"
)

// Input:
//   ${body}
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
`;

const CLI_PROBLEMS: CliProblem[] = [
  {
    kind: "cli",
    id: "two-sum",
    title: "Two Sum",
    difficulty: 1,
    prompt: "Given an array of integers and a target, return the 0-based indices of the two numbers that add up to the target. Each input has exactly one solution and you may not use the same element twice.",
    io: "Line 1: n (array length) · Line 2: n space-separated integers · Line 3: target. Output: the two indices separated by a space.",
    starters: {
      python: PY("Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. \"0 2\""),
      javascript: JS("Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. \"0 2\""),
      typescript: TS("Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. \"0 2\""),
      cpp: CPP("Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. \"0 2\""),
      java: JAVA("Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. \"0 2\""),
      go: GO("Line 1: n · Line 2: n ints · Line 3: target → output two indices, e.g. \"0 2\"")
    },
    tests: [
      { stdin: "4\n2 7 11 15\n9\n", expect: "0 1" },
      { stdin: "3\n3 2 4\n6\n", expect: "1 2" },
      { stdin: "2\n3 3\n6\n", expect: "0 1" },
      { stdin: "5\n1 5 3 9 2\n11\n", expect: "3 4" }
    ],
    hidden: [
      { stdin: "6\n-3 4 3 90 0 7\n94\n", expect: "3 4" },
      { stdin: "7\n1 2 3 4 5 6 7\n13\n", expect: "5 6" },
      { stdin: "10\n0 4 3 0 8 6 9 2 1 5\n0\n", expect: "0 3" }
    ]
  },
  {
    kind: "cli",
    id: "valid-parens",
    title: "Valid Parentheses",
    difficulty: 2,
    prompt: "Given a string containing just the characters ( ) { } [ ], determine if the brackets are balanced and correctly nested.",
    io: "Single line: the bracket string. Output true if valid, otherwise false.",
    starters: {
      python: PY("Single line: bracket string → output true or false"),
      javascript: JS("Single line: bracket string → output true or false"),
      typescript: TS("Single line: bracket string → output true or false"),
      cpp: CPP("Single line: bracket string → output true or false"),
      java: JAVA("Single line: bracket string → output true or false"),
      go: GO("Single line: bracket string → output true or false")
    },
    tests: [
      { stdin: "()[]{}", expect: "true" },
      { stdin: "([{}])", expect: "true" },
      { stdin: "(]", expect: "false" },
      { stdin: "([)]", expect: "false" },
      { stdin: "{[]}", expect: "true" },
      { stdin: "", expect: "true" }
    ],
    hidden: [
      { stdin: "((()))", expect: "true" },
      { stdin: "({[}])", expect: "false" },
      { stdin: "([{}()])", expect: "true" },
      { stdin: ")(", expect: "false" }
    ]
  },
  {
    kind: "cli",
    id: "max-subarray",
    title: "Maximum Subarray",
    difficulty: 2,
    prompt: "Given an integer array, find the contiguous subarray with the largest sum (Kadane's algorithm) and output that sum.",
    io: "Line 1: n (array length) · Line 2: n space-separated integers (may be negative). Output: the maximum subarray sum.",
    starters: {
      python: PY("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),
      javascript: JS("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),
      typescript: TS("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),
      cpp: CPP("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),
      java: JAVA("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum"),
      go: GO("Line 1: n · Line 2: n ints (may be negative) → output the max subarray sum")
    },
    tests: [
      { stdin: "9\n-2 1 -3 4 -1 2 1 -5 4\n", expect: "6" },
      { stdin: "1\n-1\n", expect: "-1" },
      { stdin: "5\n5 4 -1 7 8\n", expect: "23" },
      { stdin: "4\n-2 -3 -1 -5\n", expect: "-1" }
    ],
    hidden: [
      { stdin: "8\n-1 2 -1 3 -2 4 -1 2\n", expect: "6" },
      { stdin: "2\n-2 -1\n", expect: "-1" },
      { stdin: "11\n8 -19 5 -4 20 2 -9 3 7 -1 4\n", expect: "28" }
    ]
  },
  {
    kind: "cli",
    id: "binary-search",
    title: "Binary Search",
    difficulty: 1,
    prompt: "Given a sorted array and a target, return the index of the target, or -1 if it's not present.",
    io: "Line 1: n (array length) · Line 2: n sorted space-separated integers · Line 3: target. Output: the target's index or -1.",
    starters: {
      python: PY("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),
      javascript: JS("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),
      typescript: TS("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),
      cpp: CPP("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),
      java: JAVA("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1"),
      go: GO("Line 1: n · Line 2: n sorted ints · Line 3: target → output the index or -1")
    },
    tests: [
      { stdin: "6\n-1 0 3 5 9 12\n9\n", expect: "4" },
      { stdin: "6\n-1 0 3 5 9 12\n2\n", expect: "-1" },
      { stdin: "1\n7\n7\n", expect: "0" },
      { stdin: "5\n1 2 3 4 5\n6\n", expect: "-1" }
    ]
  },
  {
    kind: "cli",
    id: "buy-sell",
    title: "Best Time to Buy and Sell Stock",
    difficulty: 2,
    prompt: "Given an array of daily prices, choose one day to buy and a later day to sell, maximizing profit. Output the max profit (0 if no profit is possible).",
    io: "Line 1: n (number of days) · Line 2: n space-separated prices. Output: the maximum profit.",
    starters: {
      python: PY("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),
      javascript: JS("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),
      typescript: TS("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),
      cpp: CPP("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),
      java: JAVA("Line 1: n · Line 2: n prices → output the max profit (0 if none)"),
      go: GO("Line 1: n · Line 2: n prices → output the max profit (0 if none)")
    },
    tests: [
      { stdin: "6\n7 1 5 3 6 4\n", expect: "5" },
      { stdin: "5\n7 6 4 3 1\n", expect: "0" },
      { stdin: "2\n1 2\n", expect: "1" },
      { stdin: "7\n3 2 6 5 0 3 9\n", expect: "9" }
    ],
    hidden: [
      { stdin: "5\n6 4 3 1 7\n", expect: "6" },
      { stdin: "8\n1 8 2 7 3 6 4 5\n", expect: "7" },
      { stdin: "3\n5 5 5\n", expect: "0" }
    ]
  },
  {
    kind: "cli",
    id: "fizzbuzz",
    title: "FizzBuzz",
    difficulty: 1,
    prompt: "Print the numbers from 1 to n, but for multiples of 3 print Fizz, for multiples of 5 print Buzz, and for multiples of both print FizzBuzz. A great warm-up to confirm the runner works in any language.",
    io: "Single line: n. Output: n lines — 1..n with the Fizz/Buzz substitutions.",
    starters: {
      python: PY("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),
      javascript: JS("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),
      typescript: TS("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),
      cpp: CPP("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),
      java: JAVA("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both"),
      go: GO("Single line: n → n lines, Fizz for %3, Buzz for %5, FizzBuzz for both")
    },
    tests: [
      { stdin: "15\n", expect: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz" },
      { stdin: "5\n", expect: "1\n2\nFizz\n4\nBuzz" },
      { stdin: "1\n", expect: "1" }
    ]
  }
];

/* Function-mode problems (JS, runs offline in the browser). */
import { JS_FUNCTION_PROBLEMS } from "./codingBank/jsFunctions";

export const CODING_PROBLEMS: CodingProblem[] = [...CLI_PROBLEMS, ...JS_FUNCTION_PROBLEMS];
