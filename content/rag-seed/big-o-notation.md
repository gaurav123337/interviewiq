# Big-O Notation

Big-O notation describes how an algorithm's cost grows as its input grows. It ignores constant factors and lower-order terms to capture the shape of that growth, because for large inputs the shape dominates everything else. It is an upper bound on the worst case unless stated otherwise.

## Common classes

- **O(1), constant:** the cost does not depend on input size — a hash-table lookup, an array index.
- **O(log n), logarithmic:** each step discards a fraction of the input — binary search, a balanced-tree lookup.
- **O(n), linear:** the cost is proportional to the input — a single scan.
- **O(n log n):** the best achievable for comparison-based sorting — mergesort, heapsort.
- **O(n²), quadratic:** nested passes over the input — a naive pairwise comparison. Bad beyond modest sizes.
- **O(2ⁿ) and O(n!):** exponential and factorial — feasible only for tiny inputs, typical of brute-force search over subsets or permutations.

## Time and space

The same notation describes memory. An algorithm can trade time for space: memoization spends memory to avoid recomputation; an in-place algorithm spends time to save memory. Interviewers usually want both the time and the space complexity.

## Amortized analysis

Some operations are usually cheap but occasionally expensive. Appending to a dynamic array is O(1) most of the time, but when the array is full it must resize and copy every element, an O(n) step. Averaged over many appends, the cost is still O(1) — this is the amortized complexity. Amortized analysis matters when a rare expensive step is paid for by many cheap ones, so the per-operation average is what actually governs performance.
