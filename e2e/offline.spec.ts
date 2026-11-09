import { test, expect, checkpoint } from "./fixtures";

test("warmed practice and legal routes survive offline reload @pwa @browser", async ({ page, context }, info) => {
  await page.goto("#/practice");
  await expect(page.getByRole("heading", { name: /What level are you interviewing/ })).toBeVisible({ timeout: 30_000 });
  // Activation legitimately reloads clients; retry this read across that navigation.
  await expect.poll(async () => {
    try { return await page.evaluate(() => !!navigator.serviceWorker.controller); }
    catch (error) {
      if (String(error).includes("Execution context was destroyed")) return false;
      throw error;
    }
  }, { timeout: 45_000 }).toBe(true);
  await expect(page.getByRole("heading", { name: /What level are you interviewing/ })).toBeVisible({ timeout: 30_000 });
  await page.goto("#/privacy");
  await expect(page.locator("main")).toContainText(/Privacy/);
  await checkpoint(page, info, "online-warmed-privacy");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("main")).toContainText(/Privacy/);
  await expect(page.getByText("Offline — cached", { exact: true })).toBeVisible();
  await page.goto("#/practice");
  await expect(page.getByRole("heading", { name: /What level are you interviewing/ })).toBeVisible({ timeout: 30_000 });
  await checkpoint(page, info, "offline-warmed-practice");
});
