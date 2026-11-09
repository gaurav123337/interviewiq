import { readFile } from "node:fs/promises";
import { test, expect } from "./fixtures";

/* Only selected by the runner self-test. An intentionally missing entry module
   must produce a failed run with a screenshot and trace; never run on live sites. */
test("manufactured missing bundle must fail @runner-selftest", async ({ page, context, baseURL }) => {
  if (process.env.VIRTUAL_TEST_PROBE !== "1") throw new Error("Failure probe is only valid in explicit self-test mode");
  const html = await readFile(".virtual-tester/fixture/index.html", "utf8");
  const bundle = html.match(/<script[^>]*src="\.\/(assets\/[^"]+)"/)?.[1];
  if (!bundle || !baseURL?.startsWith("http://127.0.0.1:8140/")) throw new Error("Probe requires an isolated local build");
  await context.route(new URL(bundle, baseURL).href, route => route.fulfill({ status: 503, contentType: "text/javascript", body: "Synthetic broken build" }));
  await page.goto("");
  await expect(page.locator("main"), "Deliberate fault: the tester must reject a broken frontend bundle").toBeVisible({ timeout: 1500 });
});
