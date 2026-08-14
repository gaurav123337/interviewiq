/* pdfjs worker entry — installs the ES2024 Uint8Array polyfills (toHex /
   fromHex) that pdfjs-dist 6.x needs but older Chromium/Safari lack, then
   boots the real pdf.worker. Bundled by Vite via `?worker` so the polyfill
   runs inside the worker's own global scope (a main-thread polyfill would
   not reach a real Web Worker). The polyfill module self-applies on import,
   and is imported first so it evaluates before the worker module. */
import "./uint8Polyfill";
import "pdfjs-dist/build/pdf.worker.min.mjs";
