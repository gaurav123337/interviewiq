import { test, expect, checkpoint } from "./fixtures";

test("anonymous deployed frontend renders and begins local practice @smoke @live-read-only", async ({ page }, info) => {
  await page.goto("");
  await expect(page.locator("main").getByRole("heading", { level: 1 })).toBeVisible();
  await checkpoint(page, info, "live-landing");
  await page.getByRole("link", { name: /Start practicing free/ }).first().click();
  await expect(page.getByRole("heading", { name: /What level are you interviewing/ })).toBeVisible();
  await checkpoint(page, info, "live-local-practice");
  // No sign-in, backend calls, notifications, external navigation or submissions.
});
