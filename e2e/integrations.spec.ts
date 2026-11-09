import { test, expect, checkpoint, signIn } from "./fixtures";

test("tutor handles an empty knowledge base honestly @integration @simulated", async ({ page }, info) => {
  await page.goto("#/practice");
  await page.getByRole("button", { name: "Open AI Coach", exact: true }).click();
  await expect(page.getByRole("button", { name: /General Chat/ })).toBeVisible();
  await page.getByRole("button", { name: /General Chat/ }).click();
  await page.getByPlaceholder("Ask me anything…", { exact: true }).fill("Explain synthetic unknown topic xyz");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/don't have info on this topic/)).toBeVisible();
  await checkpoint(page, info, "tutor-no-knowledge");
});

test("simulated AI reply and provider error are visible @integration @simulated", async ({ page, backend }, info) => {
  backend.persona = "pro";
  await signIn(page);
  await page.getByRole("button", { name: "Open AI Coach", exact: true }).click();
  await page.getByRole("button", { name: /General Chat/ }).click();
  await page.getByRole("button", { name: "🤖 AI", exact: true }).click();
  await page.getByPlaceholder("Ask me anything…", { exact: true }).fill("Explain testing boundaries");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/A synthetic tutor explanation/)).toBeVisible();
  await checkpoint(page, info, "tutor-synthetic-reply");
  backend.aiFailure = true;
  await page.getByPlaceholder("Ask me anything…", { exact: true }).fill("Exercise the provider error");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/Synthetic AI unavailable/)).toBeVisible();
  await checkpoint(page, info, "tutor-provider-error");
});

test("create a synthetic team through the real UI @integration @simulated", async ({ page, backend }, info) => {
  backend.persona = "free";
  await signIn(page);
  await page.goto("#/team");
  await expect(page.getByRole("textbox", { name: "Team name", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Team name", exact: true }).fill("Virtual Test Team");
  await page.getByRole("button", { name: "Create team", exact: true }).click();
  await expect(page.getByRole("button", { name: "Virtual Test Team", exact: true })).toBeVisible();
  expect(backend.teams).toHaveLength(1);
  await checkpoint(page, info, "synthetic-team");
});
