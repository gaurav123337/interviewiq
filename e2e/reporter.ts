import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

/* Results stay local/Actions-only. Never publish this report into the app. */
export default class VirtualTesterReporter implements Reporter {
  private config!: FullConfig;
  private rows = new Map<string, { title: string; project: string; status: string; duration: number; attempts: number }>();
  onBegin(config: FullConfig) { this.config = config; }
  onTestEnd(test: TestCase, result: TestResult) {
    const key = `${test.id}:${test.repeatEachIndex}`;
    const previous = this.rows.get(key);
    this.rows.set(key, {
      title: test.titlePath().slice(2).join(" > "), project: test.parent.project()?.name ?? "unknown",
      status: result.status === "passed" && result.retry > 0 ? "flaky" : result.status,
      duration: (previous?.duration ?? 0) + result.duration, attempts: result.retry + 1
    });
  }
  onEnd(result: FullResult) {
    const rows = [...this.rows.values()];
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
    const clean = (s: string) => s.replace(/[|\n\r]/g, " ");
    const summary = [
      "# InterviewIQ virtual tester", "",
      `**Result:** ${result.status} · **Commit:** ${this.config.metadata.commit}${this.config.metadata.sourceDirty ? " + uncommitted changes" : ""}`,
      `**Mode:** ${this.config.metadata.mode} · **Time:** ${new Date().toISOString()}`, "",
      "Browser actions exercise real frontend code. Fixture-backed scenarios simulate providers and do not prove backend authentication, RLS, payment settlement, or job submission.", "",
      `**Counts:** ${Object.entries(counts).map(([status, count]) => `${status}: ${count}`).join(", ") || "No scenarios completed"}`, "",
      "| Project | Scenario | Result | Attempts | Duration |", "| --- | --- | --- | --- | --- |",
      ...rows.map(row => `| ${clean(row.project)} | ${clean(row.title)} | ${row.status} | ${row.attempts} | ${(row.duration / 1000).toFixed(1)}s |`), "",
      "## Unverified / blocked boundaries", "",
      "- Real Supabase auth, RLS, database writes, and multi-user conflict handling: dedicated sandbox not configured.",
      "- Real AI/embedding availability, OAuth/MFA, payment settlement, email delivery, job submissions and the desktop auto-apply engine: not exercised.",
      "- Mobile is viewport/device emulation in Chromium, not a physical device; Firefox/WebKit are not covered.",
      "- Screenshots/traces are evidence; no automatic claim of visual-design acceptance.",
      "- PWA results cover explicitly warmed routes only; a failed/blocked PWA scenario does not establish offline readiness.", "",
      "See docs/testing/virtual-tester.md for coverage, docs/testing/known-regressions.md for current app issues, and playwright-report/index.html for evidence."
    ].join("\n") + "\n";
    const output = String(this.config.metadata.resultsDir ?? "test-results");
    mkdirSync(output, { recursive: true });
    writeFileSync(resolve(output, "summary.md"), summary);
    writeFileSync(resolve(output, "summary.json"), JSON.stringify({ status: result.status, metadata: this.config.metadata, counts, scenarios: rows }, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY && this.config.metadata.mode !== "failure-probe") appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}
