import { test, expect, checkpoint } from "./fixtures";
import { isLiveMutationRequest } from "../scripts/virtual-tester-live-lib.js";

test("anonymous deployed frontend renders and begins local practice @smoke @live-read-only", async ({ page }, info) => {
  await page.goto("");
  await expect(page.locator("main").getByRole("heading", { level: 1 })).toBeVisible();
  await checkpoint(page, info, "live-landing");
  await page.getByRole("link", { name: /Start practicing free/ }).first().click();
  await expect(page.getByRole("heading", { name: /What level are you interviewing/ })).toBeVisible();
  await checkpoint(page, info, "live-local-practice");
  // No sign-in, backend calls, notifications, external navigation or submissions.
});

test("anonymous deployed Jobs stays read-only @smoke @live-read-only", async ({ page, context }, info) => {
  let unsafeRequests = 0;
  context.on("request", request => {
    if (isLiveMutationRequest(request.url(), request.method())) unsafeRequests++;
  });
  await page.goto("#/jobs");
  await expect(page.getByRole("heading", { name: /Job Match/, level: 1 })).toBeVisible();
  const pipeline = page.getByRole("region", { name: "Application pipeline", exact: true });
  await expect(pipeline.getByRole("heading", { name: "Your autonomous application pipeline", exact: true })).toBeVisible();
  await expect(pipeline).toContainText("Sign in to confirm your own profile and manage a paired local worker. No application has been requested.");
  await expect(pipeline.getByRole("button", { includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /\brun\b/i, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Save profile/ })).toBeDisabled();
  // Observe only: no profile changes, account/portal actions or execution clicks.
  await checkpoint(page, info, "live-jobs-signed-out");
  expect(unsafeRequests, "Anonymous Jobs must not attempt mutations or execution requests").toBe(0);
});
