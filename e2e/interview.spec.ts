import { test, expect, checkpoint, navigate } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";

async function startInterview(page: Page, info: TestInfo) {
  await page.goto("");
  const start = page.getByRole("link", { name: "Start practicing free →", exact: true });
  // The first CTA is in the hero; later duplicates are pricing/footer CTAs.
  await start.first().click();
  await expect(page.getByRole("heading", { name: /What level are you interviewing/ })).toBeVisible();
  await page.getByRole("button", { name: /Senior 4–7 years/ }).click();
  await expect(page.getByRole("heading", { name: /Pick your field/ })).toBeVisible();
  await page.getByRole("button", { name: /Security Engineer/ }).click();
  await expect(page.getByRole("heading", { name: /Which company/ })).toBeVisible();
  await page.getByRole("button", { name: /Stripe/ }).click();
  await expect(page.getByRole("heading", { name: /Ready to be interviewed/ })).toBeVisible();
  await page.getByRole("button", { name: /Start Interview/ }).click();
  await expect(page.getByText("Configure your interview", { exact: true })).toBeVisible();
  await checkpoint(page, info, "interview-config");
  await page.getByRole("button", { name: /Begin interview/ }).click();
  await expect(page.getByText(/Question 1 of/)).toBeVisible();
}

test("complete interview, persist history, review and bank search @core @simulated", async ({ page }, info) => {
  await startInterview(page, info);
  for (let index = 0; index < 8; index++) {
    await page.getByPlaceholder(/Type your answer/).fill("I would analyze the requirements, define trust boundaries, validate inputs, apply least privilege, and use authentication and authorization. I would test edge cases and measure trade-offs with a concrete example.");
    await page.getByRole("button", { name: /Submit answer/ }).click();
    await expect(page.getByRole("button", { name: /Next question →|See my results/ })).toBeVisible();
    if (index === 0) await checkpoint(page, info, "answer-feedback");
    await page.getByRole("button", { name: /Next question →|See my results/ }).click();
  }
  await expect(page.getByText(/Session complete/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Category breakdown/ })).toBeVisible();
  await checkpoint(page, info, "session-results");
  await navigate(page, /History/);
  await expect(page.getByText(/Stripe · Security Engineer/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Stripe · Security Engineer/)).toBeVisible();
  await page.getByRole("button", { name: /Review/ }).click();
  await expect(page.getByText(/Session complete/)).toBeVisible();
  await page.locator("main details summary").first().click();
  await expect(page.getByText(/I would analyze the requirements/).first()).toBeVisible();
  await navigate(page, /Bank/);
  await page.getByPlaceholder(/Search questions/).fill("virtual-no-match-zzzz");
  await expect(page.getByText(/No questions found/)).toBeVisible();
  await page.getByPlaceholder(/Search questions/).fill("");
  await page.locator("main details summary").first().click();
  await expect(page.getByText(/Model answer/).first()).toBeVisible();
  await checkpoint(page, info, "history-and-bank");
});

test("early exit does not create a completed session @core @simulated", async ({ page }, info) => {
  await startInterview(page, info);
  await page.getByRole("button", { name: /← End/ }).click();
  await page.getByRole("button", { name: /End & see results/ }).click();
  await expect(page.getByRole("heading", { name: /Ready to be interviewed/ })).toBeVisible();
  await expect(page.getByText(/Session complete/)).toHaveCount(0);
  await navigate(page, /History/);
  await expect(page.getByRole("button", { name: /Review/ })).toHaveCount(0);
  await checkpoint(page, info, "empty-history-after-exit");
});

test("job-description tailoring reaches a tailored interview @core @simulated", async ({ page }, info) => {
  await page.goto("#/practice");
  await page.getByRole("button", { name: /I have a job description/ }).click();
  await page.getByPlaceholder(/Senior Backend Engineer at Stripe/).fill("Senior Backend Engineer at Stripe. Five years building TypeScript and PostgreSQL APIs, Kubernetes and AWS. Design distributed systems, test APIs, lead microservice architecture and reliability reviews.");
  await page.getByRole("button", { name: /Analyze & continue/ }).click();
  await expect(page.getByRole("heading", { name: /Ready to be interviewed/ })).toBeVisible();
  await page.getByRole("button", { name: /Start Interview/ }).click();
  await page.getByRole("button", { name: /Begin interview/ }).click();
  await expect(page.getByText(/Question 1 of/)).toBeVisible();
  await checkpoint(page, info, "jd-interview");
});
