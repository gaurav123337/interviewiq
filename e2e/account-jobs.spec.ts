import { test, expect, checkpoint, signIn } from "./fixtures";

test("settings persist across reload and theme changes @journey @simulated", async ({ page }, info) => {
  await page.goto("#/settings");
  await page.getByRole("button", { name: "10", exact: true }).click();
  await page.getByRole("button", { name: "☀️ Light", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("iq.settings") || "{}").count)).toBe(10);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Tune your coach/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("iq.settings") || "{}").count)).toBe(10);
  await expect(page.getByTitle("Switch to dark mode")).toBeVisible();
  await checkpoint(page, info, "persisted-settings-light");
});

test("simulated sign-in, sync write, reload and sign-out @integration @simulated", async ({ page, backend }, info) => {
  backend.persona = "free";
  await signIn(page);
  await page.getByRole("button", { name: "10", exact: true }).click();
  await page.getByRole("button", { name: /Sync now/ }).click();
  await expect.poll(() => [...backend.syncRows.values()].some(row => row.key === "iq.settings" && (row.value as { count?: number })?.count === 10)).toBe(true);
  await page.reload();
  await expect(page.getByText("virtual-tester@example.invalid", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByPlaceholder("you@example.com", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("iq.settings") || "{}").count)).toBe(10);
  await checkpoint(page, info, "signed-out-local-data-retained");
});

test("invalid simulated credentials show failure without signing in @integration @simulated", async ({ page, backend }, info) => {
  backend.authFailure = true;
  await page.goto("#/settings");
  await page.getByPlaceholder("you@example.com", { exact: true }).fill("virtual-tester@example.invalid");
  await page.getByPlaceholder("Password (min 6 characters)").fill("wrong-synthetic-password");
  const cloud = page.locator("section").filter({ has: page.getByRole("heading", { name: /Cloud sync/ }) });
  await cloud.locator('input[type="password"] + button').click();
  await expect(page.getByText(/Invalid login credentials/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await checkpoint(page, info, "invalid-sign-in");
});

test("simulated pro entitlement and admin restrictions @integration @simulated", async ({ page, backend }, info) => {
  backend.persona = "pro";
  await signIn(page);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByText("SIGNED IN", { exact: true })).toBeVisible();
  await expect(page.getByText("PRO", { exact: true })).toBeVisible();
  await page.goto("#/admin");
  await expect(page.getByRole("heading", { name: "Admin only", exact: true })).toBeVisible();
  await checkpoint(page, info, "pro-not-admin");
});

test("simulated admin dashboard opens without granting live privileges @integration @simulated", async ({ page, backend }, info) => {
  backend.persona = "admin";
  await signIn(page);
  await page.goto("#/admin");
  await expect(page.getByRole("heading", { name: "Admin only", exact: true })).toHaveCount(0);
  await expect(page.locator("main main")).toContainText(/Overview/);
  await checkpoint(page, info, "simulated-admin-dashboard");
  if (process.env.VIRTUAL_TEST_INSPECT === "1") console.log(`ADMIN\n${await page.locator("main main").ariaSnapshot()}`);
});

test("resume profile and job filters persist locally without submitting @journey @simulated", async ({ page }, info) => {
  await page.goto("#/jobs");
  await page.getByPlaceholder(/paste your resume text here/).fill("Alex Example\nSenior TypeScript Engineer\nFive years of experience building React and TypeScript applications, Node.js APIs and PostgreSQL databases. Testing with unit tests and browser automation. Remote.");
  await page.getByRole("button", { name: /Analyze & match/ }).click();
  await expect(page.getByRole("textbox", { name: "Headline", exact: true })).not.toHaveValue("");
  await page.getByRole("textbox", { name: "Headline", exact: true }).fill("Synthetic TypeScript Engineer");
  await page.getByRole("button", { name: /Save profile/ }).click();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Headline", exact: true })).toHaveValue("Synthetic TypeScript Engineer");
  await page.getByPlaceholder(/Search title, company, skill/).fill("no-such-synthetic-employer");
  await expect(page.locator("main")).toContainText(/Match feed \(0 of 1\)/);
  await page.getByPlaceholder(/Search title, company, skill/).fill("TypeScript");
  await expect(page.locator("main")).toContainText("Synthetic TypeScript Engineer");
  await checkpoint(page, info, "resume-and-filter");
});
