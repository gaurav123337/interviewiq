import { test, expect, checkpoint, signIn } from "./fixtures";

for (const outcome of ["success", "cancel", "error"] as const) {
  test(`synthetic payment ${outcome} never reaches a provider @integration @simulated`, async ({ page, backend }, info) => {
    backend.persona = "free";
    backend.paymentAvailable = outcome !== "error";
    await signIn(page);
    await page.goto("");
    await page.getByRole("button", { name: "Go Pro", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Something went wrong", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "✨ InterviewIQ Pro", exact: true })).toBeVisible();
    await checkpoint(page, info, "upgrade-options");
    await page.getByRole("button", { name: /Monthly.*Choose/ }).click();
    if (outcome === "error") {
      await expect(page.getByText(/Synthetic payment provider unavailable/)).toBeVisible();
      expect(backend.persona).toBe("free");
    } else {
      const provider = page.getByRole("dialog", { name: "Synthetic payment provider", exact: true });
      await expect(provider).toBeVisible();
      await provider.getByRole("button", { name: outcome === "success" ? "Complete synthetic payment" : "Cancel synthetic payment", exact: true }).click();
      if (outcome === "success") {
        await expect(page.getByText(/Payment verified — Pro unlocked/)).toBeVisible();
        expect(backend.writes).toContain("synthetic-pay-verify");
      } else {
        await expect(page.getByText(/Checkout cancelled — no charge was made/)).toBeVisible();
        expect(backend.writes).not.toContain("synthetic-pay-verify");
      }
    }
    await checkpoint(page, info, `synthetic-payment-${outcome}`);
  });
}

test("approved article filtering uses synthetic content @journey @simulated", async ({ page, backend }, info) => {
  backend.articles.push({ id: "virtual-article", title: "Synthetic TypeScript Testing Guide", summary: "A fixture for testing article search.", content: "Write deterministic tests with clear assertions.", content_refined: { beginner: "Tests compare outcomes with expectations.", intermediate: "Use isolated data and repeatable setup.", advanced: "Verify failure paths and trust boundaries.", tableOfContents: ["Testing"], keyTakeaways: ["Assert outcomes"], glossary: [], estimatedReadMinutes: 2, keywords: ["typescript", "testing"] }, source_name: "Synthetic docs", source_url: "https://docs.example.invalid/testing", domain: "docs.example.invalid", content_type: "article", field_id: "frontend", tags: ["testing"], created_at: "2026-01-01T00:00:00Z" });
  await page.goto("#/articles");
  await expect(page.getByText("Synthetic TypeScript Testing Guide", { exact: true })).toBeVisible();
  await page.getByPlaceholder("🔍 Search articles...", { exact: true }).fill("no-matching-article");
  await expect(page.getByRole("heading", { name: "Synthetic TypeScript Testing Guide", exact: true })).toHaveCount(0);
  await page.getByPlaceholder("🔍 Search articles...", { exact: true }).fill("TypeScript");
  await expect(page.getByRole("heading", { name: "Synthetic TypeScript Testing Guide", exact: true })).toBeVisible();
  await checkpoint(page, info, "synthetic-article");
});
