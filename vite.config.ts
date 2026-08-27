import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/* Strict Content-Security-Policy (docs/app-security.md G2), injected into the
   BUILT index.html only — dev keeps no CSP so Vite's inline react-refresh
   preamble and HMR websockets work. Notes on the choices:
   - script-src 'unsafe-eval': the offline code playground executes user code
     via new Function (src/services/runner.ts) — required, and it does NOT
     allow script-tag injection (XSS) by itself.
   - style-src 'unsafe-inline': inline <style>/style attrs (tailwind + resume
     print window).
   - connect-src https:: user-supplied AI API bases (BYOK) can be any https
     host; ws: is absent because the CSP only ships in the built app (no HMR).
   - worker-src blob: https:: pdfjs uses a bundled ?worker (blob), tesseract
     OCR fetches its worker/wasm from the jsdelivr CDN (https).
   The service worker serves this same index.html offline, so the policy
   travels with the cached shell. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob: https:",
  "frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

const cspPlugin = {
  name: "inject-csp",
  apply: "build" as const,
  transformIndexHtml(html: string): string {
    const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
    return html.includes("Content-Security-Policy") ? html : html.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n' + meta);
  }
};

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), cspPlugin],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-redux": ["@reduxjs/toolkit", "react-redux"],
        },
      },
    },
  },
  server: {
    port: 8137,
    host: "127.0.0.1",
    /* the Freebuff desktop app keeps its own state in .freebuff/; exclude it from the file watcher so it can't trigger HMR reloads */
    watch: { ignored: ["**/.freebuff/**", "**/dist/**", "**/node_modules/**"] }
  },
  preview: { port: 8138, host: "127.0.0.1" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    /* hard cap so a hung test (e.g. a network fetch) fails instead of stalling the suite */
    testTimeout: 30_000,
    /* Deno tests for the edge functions run in the deploy pipeline (deno
       test) — vitest must not try to collect them */
    exclude: ["**/node_modules/**", "**/dist/**", "**/supabase/**"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
