/* Line-based diff (LCS) for the resume kit's "compare vs previous job" view.
   Pure + testable — no DOM, no storage. */

export type DiffLine = { type: "same" | "add" | "del"; text: string };

/** Diff `a` (previous) against `b` (current): removed lines are "del",
    added lines are "add", unchanged lines are "same". Preserves order. */
export function diffLines(a: string, b: string): DiffLine[] {
  /* an empty document has zero lines, not one empty line */
  const A = a === "" ? [] : a.split("\n");
  const B = b === "" ? [] : b.split("\n");
  const n = A.length;
  const m = B.length;

  /* dp[i][j] = LCS length of A[i..] and B[j..] */
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ type: "same", text: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: A[i] });
      i++;
    } else {
      out.push({ type: "add", text: B[j] });
      j++;
    }
  }
  while (i < n) { out.push({ type: "del", text: A[i] }); i++; }
  while (j < m) { out.push({ type: "add", text: B[j] }); j++; }
  return out;
}
