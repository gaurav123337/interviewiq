import { test, expect, checkpoint, navigate } from "./fixtures";
import { readFile } from "node:fs/promises";

test("local export and reset operate only on synthetic browser data @journey @simulated", async ({ page }, info) => {
  await page.goto("#/settings");
  await page.getByRole("button", { name: "10", exact: true }).click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Your space/ })).toBeVisible();
  const exportButton = page.getByRole("button", { name: "📦 Export as JSON", exact: true });
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await readFile(path!, "utf8"));
  expect(exported["iq.settings"].count).toBe(10);
  await page.getByRole("button", { name: /Clear local data/ }).click();
  await page.getByRole("button", { name: "Confirm — erase everything on this device", exact: true }).click();
  await expect(page.getByRole("link", { name: /Start practicing free/ }).first()).toBeVisible();
  await checkpoint(page, info, "local-reset");
});

test("mobile More keeps desktop destinations but respects disabled features @navigation @simulated", async ({ page, backend }, info) => {
  test.skip(info.project.name !== "mobile", "Mobile navigation contract");
  backend.configRows.push(
    { key: "features", value: { jobs: false, drill: false } },
    {
      key: "site_config",
      value: {
        header: { primaryTabs: [
          { id: "onboard", label: "Practice", icon: "🎯" },
          { id: "planner", label: "Planner", icon: "🗓️" },
          { id: "jobs", label: "Jobs", icon: "💼" },
          { id: "drill", label: "Drill", icon: "🎴" }
        ] },
        menus: { mobileTabs: [{ id: "onboard", label: "Practice", icon: "🎯" }], moreMenu: [] }
      }
    }
  );
  await page.goto("#/practice");
  const more = page.getByRole("button", { name: "More", exact: true });
  await expect(more).toBeVisible();
  await more.click();
  await expect(page.getByRole("button", { name: /Planner/ }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Jobs/ }).filter({ visible: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Drill/ }).filter({ visible: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Planner/ }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: /A plan that ends with you ready/ })).toBeVisible();
  await checkpoint(page, info, "mobile-more-feature-gates");
});

test("language choice survives reload and browser navigation works @journey @simulated", async ({ page }, info) => {
  await page.goto("#/practice");
  await page.getByRole("button", { name: "Change language", exact: true }).click();
  await page.getByRole("button", { name: /हिन्दी/ }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("i18nextLng"))).toBe("hi");
  await page.reload();
  await expect(page.getByRole("button", { name: "Change language", exact: true })).toContainText("🇮🇳");
  await page.getByRole("button", { name: "Change language", exact: true }).click();
  await page.getByRole("button", { name: /English/ }).click();
  await navigate(page, /Planner/);
  await expect(page.getByRole("heading", { name: /A plan that ends with you ready/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: /What level are you interviewing/ })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: /A plan that ends with you ready/ })).toBeVisible();
  await checkpoint(page, info, "language-and-history");
});
