import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { LIVE_SITES, LOCAL_SITES, PROXY_URL } from "./scripts/virtual-tester-lib.js";

const live = process.env.VIRTUAL_TEST_MODE === "live";
const probe = process.env.VIRTUAL_TEST_PROBE === "1";
const probeRunId = process.env.VIRTUAL_TEST_PROBE_ID;
if (probe && (live || !probeRunId || !/^[0-9a-f-]{36}$/.test(probeRunId))) {
  throw new Error("Failure probes require a unique runner invocation ID and cannot target live sites");
}
const resultsDir = probe ? `.virtual-tester/probe/${probeRunId}/test-results` : "test-results";
const htmlDir = probe ? `.virtual-tester/probe/${probeRunId}/playwright-report` : "playwright-report";
let commit = "unknown";
let sourceDirty = true;
try {
  commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  sourceDirty = !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
} catch { /* source archives have no git metadata */ }

export default defineConfig({
  testDir: "./e2e",
  testMatch: probe ? "**/failure-probe.spec.ts" : live ? "**/live.spec.ts" : "**/*.spec.ts",
  testIgnore: probe ? [] : live ? ["**/failure-probe.spec.ts"] : ["**/live.spec.ts", "**/failure-probe.spec.ts"],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  outputDir: `${resultsDir}/browser`,
  metadata: { commit, sourceDirty, mode: probe ? "failure-probe" : live ? "live-read-only" : "isolated", resultsDir, backendVerification: "NOT VERIFIED — fixture responses are simulated", generatedAt: new Date().toISOString() },
  reporter: [
    ["list"],
    ["html", { outputFolder: htmlDir, open: "never" }],
    ["json", { outputFile: `${resultsDir}/results.json` }],
    ["junit", { outputFile: `${resultsDir}/junit.xml` }],
    ["./e2e/reporter.ts"]
  ],
  use: {
    browserName: "chromium", locale: "en-US", timezoneId: "UTC", colorScheme: "dark",
    actionTimeout: 20_000, navigationTimeout: 25_000,
    permissions: [], serviceWorkers: "block", trace: "retain-on-failure",
    screenshot: "only-on-failure", video: "off",
    launchOptions: live ? {} : {
      proxy: { server: PROXY_URL },
      args: ["--proxy-bypass-list=<-loopback>", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"]
    }
  },
  projects: live ? LIVE_SITES.map((baseURL, index) => ({
    name: index === 0 ? "live-pages" : "live-wasmer", use: { baseURL, viewport: { width: 1440, height: 900 } }
  })) : [
    { name: "desktop", testIgnore: probe ? [] : /(?:offline|live|failure-probe)\.spec\.ts/, use: { baseURL: LOCAL_SITES[0], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", testIgnore: probe ? [] : /(?:offline|live|failure-probe)\.spec\.ts/, use: { ...devices["Pixel 7"], baseURL: LOCAL_SITES[0] } },
    { name: "offline", testMatch: /offline\.spec\.ts/, use: { baseURL: LOCAL_SITES[1], serviceWorkers: "allow", viewport: { width: 1440, height: 900 } } }
  ],
  webServer: live ? undefined : {
    command: "node scripts/virtual-test-server.mjs", url: "http://127.0.0.1:8140/__virtual_health",
    reuseExistingServer: false, timeout: 30_000
  }
});
