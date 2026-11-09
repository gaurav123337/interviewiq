import { test, expect, checkpoint } from "./fixtures";

/* Intentionally shallow inventory checks supplement, not replace, the journeys.
   Session-only results/interview and skill-detail are reached in their journeys. */
const routes = ["", "practice", "planner", "roadmap", "drill", "bank", "history", "progress", "settings", "account", "playground", "admin", "team", "terms", "privacy", "refunds", "shipping", "sources", "jobs", "articles", "resources", "counselor", "learn", "system-design"];

for (const route of routes) {
  test(`route inventory: ${route || "landing"} @inventory @simulated`, async ({ page }, info) => {
    await page.goto(route ? `#/${route}` : "");
    const main = page.locator("main");
    await expect(main).toBeVisible();
    await expect(main).not.toHaveText(/^\s*(Loading.*)?\s*$/);
    await expect(main.getByText(/Something went wrong|Failed to load module|Unexpected Application Error/i)).toHaveCount(0);
    if (route === "learn") {
      await expect(page.getByRole("heading", { name: /Your learning roadmap/ })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: /Your learning roadmap/ })).toBeVisible();
    }
    await checkpoint(page, info, `route-${route || "landing"}`);
    if (process.env.VIRTUAL_TEST_INSPECT === "1") console.log(`ROUTE ${route}\n${await main.ariaSnapshot()}`);
  });
}
