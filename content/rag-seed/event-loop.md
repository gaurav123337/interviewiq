# The Event Loop

JavaScript runs on a single thread, yet it handles network calls, timers, and user input without blocking. The event loop is what makes that possible: it lets a single thread do non-blocking I/O by running work in response to events rather than waiting on each operation.

## The call stack and the queues

Synchronous code runs on the call stack, one frame per function call. When an asynchronous operation completes, its callback is placed on a queue rather than run immediately. The event loop's job is simple to state: whenever the call stack is empty, take the next ready callback and run it.

There are two queues, and their priority matters. The macrotask queue holds callbacks from timers (`setTimeout`), I/O, and UI events. The microtask queue holds promise reactions (`.then`, `await` continuations) and `queueMicrotask` callbacks.

## Microtasks drain first

After each macrotask, and after the current synchronous run finishes, the event loop drains the entire microtask queue before picking up the next macrotask. In other words, microtasks drain before the next macrotask, so a promise's then callback runs before a setTimeout scheduled at the same moment. This is why `Promise.resolve().then(...)` fires ahead of `setTimeout(..., 0)` even though both look "immediate."

A practical consequence: a runaway chain of microtasks can starve macrotasks, delaying timers and rendering, because the loop will not move on until the microtask queue is empty.

## Why it doesn't block

Because long operations hand their work to the host (the browser or Node) and register a callback instead of waiting, the thread stays free to process other events. The cost of this model is that any long *synchronous* computation blocks everything — the single thread can only be in one place at a time — so heavy work belongs in a worker or must be broken into chunks.
