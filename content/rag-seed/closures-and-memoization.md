# Closures and Memoization

A closure is a function bundled together with the surrounding state it was created in. In a language with lexical scope, an inner function can read the variables of the function that defined it — and it keeps that access even after the outer function has returned. A closure captures the lexical scope, so the function remembers variables after the outer call returns.

## Why closures matter

Closures let a function carry private, persistent state without a global variable or an object. A counter factory returns a function that increments a variable defined in its parent; each returned function keeps its own independent copy of that variable. This is the foundation of data privacy, partial application, and callbacks that need to remember context.

A classic pitfall is capturing a loop variable declared with `var`: because `var` is function-scoped, every closure shares the *same* variable and sees its final value. Declaring the variable with `let`, which is block-scoped, gives each iteration its own binding and fixes the bug.

## Memoization

Memoization is a specific, powerful use of closures. We memoize expensive functions to avoid repeating work: memoization caches the result of a pure function keyed by its arguments, so a repeated call with the same inputs returns the stored result instead of recomputing.

The cache lives in a closure over the wrapped function, invisible to callers. Memoization only works for pure functions — those whose output depends solely on their inputs and which have no side effects — because a cached result must stay valid for the same arguments forever. It trades memory for speed, so an unbounded cache on a function with many distinct inputs can leak memory; a bounded cache with LRU eviction is the usual remedy.
