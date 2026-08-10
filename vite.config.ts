import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
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
    testTimeout: 30_000
  }
});
