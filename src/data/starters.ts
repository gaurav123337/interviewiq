/* Per-language stdin/stdout starter skeletons for CLI problems. Lives in its
   own module so both src/data/coding.ts and src/data/codingBank/algorithms.ts
   can import it without a circular dependency. Each starter defines
   `solve(lines)` reading stdin split by newline and returning output lines. */

export const PY = (body: string) => `import sys

# Input:
#   ${body}
def solve(lines):
    out = []
    # your code here — append each output line to out
    return out
`;

export const JS = (body: string) => `// Input:
//   ${body}
// lines = input split by newline (no trailing newlines)
function solve(lines) {
  const out = [];
  // your code here — push each output line onto out
  return out;
}
`;

export const TS = (body: string) => `// Input:
//   ${body}
function solve(lines: string[]): string[] {
  const out: string[] = [];
  // your code here — push each output line onto out
  return out;
}
`;

export const CPP = (body: string) => `#include <bits/stdc++.h>
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

export const JAVA = (body: string) => `import java.util.*;

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

export const GO = (body: string) => `package main

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
