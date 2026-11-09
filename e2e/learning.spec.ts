import { test, expect, checkpoint, navigate } from "./fixtures";

test("planner leads into roadmap setup @journey @simulated", async ({ page }, info) => {
  await page.goto("#/planner");
  await page.getByRole("button", { name: /Go to Career Roadmap/ }).click();
  await expect(page.getByRole("heading", { name: /Your target role, broken down/ })).toBeVisible();
  await page.getByRole("combobox", { name: "Field", exact: true }).selectOption({ label: "⚙️ Backend Engineer" });
  await page.getByRole("button", { name: "Next: your skills →", exact: true }).click();
  await expect(page.getByRole("heading", { name: /How strong are you here/ })).toBeVisible();
  await page.getByRole("button", { name: "Next: check the gap →", exact: true }).click();
  await page.getByRole("button", { name: "Skip & build my roadmap", exact: true }).click();
  await expect(page.getByRole("button", { name: "▶ Practice this week", exact: true })).toBeVisible();
  await navigate(page, /Planner/);
  await expect(page.getByRole("heading", { name: /Set up your Career Roadmap first/ })).toHaveCount(0);
  await checkpoint(page, info, "generated-daily-plan");
});

test("spaced-repetition deck exposes answers and records a review @journey @simulated", async ({ page }, info) => {
  await page.goto("#/drill");
  await page.getByRole("button", { name: "Build deck", exact: true }).click();
  await page.getByRole("button", { name: /Reveal answer/ }).click();
  await expect(page.getByRole("button", { name: "🙂 Good", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "🙂 Good", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("iq.drillSrs") || "{}")).length)).toBeGreaterThan(0);
  await checkpoint(page, info, "drill-review-recorded");
});

test("local function exercise can be edited and executed @journey @simulated", async ({ page }, info) => {
  await page.goto("#/playground");
  await page.getByRole("button", { name: "🧩 Once Easy Functions", exact: true }).click();
  await page.getByRole("textbox", { name: "", exact: true }).fill("function once(fn) { let called = false, result; return function(...args) { if (!called) { called = true; result = fn.apply(this, args); } return result; }; }");
  await page.getByRole("button", { name: "✓ Test (3)", exact: true }).click();
  await expect(page.getByText("3/3 passing", { exact: true })).toBeVisible();
  await expect(page.getByText("✅ Solved", { exact: true })).toBeVisible();
  await checkpoint(page, info, "function-results");
});

test("system design filters and opens a case study @journey @simulated", async ({ page }, info) => {
  await page.goto("#/system-design");
  await page.getByPlaceholder(/Search case studies by title/).fill("no-such-case");
  await expect(page.getByRole("button", { name: /URL Shortener \(TinyURL\) core/ })).toHaveCount(0);
  await page.getByPlaceholder(/Search case studies by title/).fill("URL Shortener");
  await page.getByRole("button", { name: /URL Shortener \(TinyURL\) core/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /URL Shortener/ })).toBeVisible();
  await dialog.getByRole("button", { name: "✓ Mark as done", exact: true }).click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("main")).toContainText("1/15 completed");
  await page.reload();
  await expect(page.locator("main")).toContainText("1/15 completed");
  await checkpoint(page, info, "system-design-progress");
});

test("skill explorer navigation and detail remain reachable @journey @simulated", async ({ page }, info) => {
  await page.goto("#/practice");
  await navigate(page, /Learn a Skill/);
  await expect(page.getByRole("heading", { name: /Your learning roadmap/ })).toBeVisible();
  await page.getByPlaceholder(/What do you want to learn/).fill("React");
  await page.getByRole("button", { name: /React ●●○/ }).click();
  await expect(page.getByRole("heading", { name: "React", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Learning Path/ })).toBeVisible();
  await page.getByRole("button", { name: "▶ Start Practice", exact: true }).click();
  await expect(page.getByText(/Question 1 of/)).toBeVisible();
  await checkpoint(page, info, "skill-detail-practice");
});
