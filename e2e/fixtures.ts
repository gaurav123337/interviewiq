import { test as base, expect, type Page, type TestInfo } from "@playwright/test";
import { requestPolicy } from "../scripts/virtual-tester-lib.js";
import { FixtureBackend } from "./backend";
import { PAYMENT_FIXTURE_SCRIPT } from "./payment-fixture";

export async function checkpoint(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
  await info.attach(`${name}-accessibility`, { body: await page.locator("body").ariaSnapshot(), contentType: "text/plain" });
}

export const test = base.extend<{ backend: FixtureBackend; safety: void }>({
  backend: async ({}, use) => { await use(new FixtureBackend()); },
  safety: [async ({ context, baseURL, backend }, use, info) => {
    if (!baseURL) throw new Error("Test requires an explicitly approved base URL");
    const mode = info.project.name.startsWith("live-") ? "live" : info.project.name === "offline" ? "offline" : "fixture";
    const unexpected: string[] = [];
    const denied: string[] = [];
    const errors: string[] = [];
    const consoleErrors: string[] = [];
    const expectedErrors = () => info.annotations.some(item => item.type === "expected-error");
    const observe = (page: Page) => {
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        if (message.type() !== "error") return;
        const text = message.text().slice(0, 500);
        consoleErrors.push(text);
        // Browser HTTP-error messages are handled by the request/response guard;
        // unexpected application errors must still fail even when React catches them.
        if (!text.startsWith("Failed to load resource:") && !expectedErrors()) errors.push(`Console: ${text}`);
      });
      page.on("response", response => {
        if (response.status() >= 400 && requestPolicy(response.url(), response.request().method(), baseURL, mode) === "static") errors.push(`Required asset HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
      });
    };
    context.on("page", observe);
    for (const page of context.pages()) observe(page);
    await context.route("**/*", async route => {
      const request = route.request();
      const decision = requestPolicy(request.url(), request.method(), baseURL, mode);
      if (decision === "static") {
        if (mode !== "live") return route.continue();
        // Routing only sees the initial URL, not redirect hops. Fetch without
        // following redirects so an approved site cannot send us elsewhere.
        const response = await route.fetch({ maxRedirects: 0, timeout: 25_000 });
        if (response.status() >= 300 && response.status() < 400) {
          errors.push(`Redirect rejected on approved static path: ${new URL(request.url()).pathname}`);
          await response.dispose();
          return route.abort("blockedbyclient");
        }
        await route.fulfill({ response });
        await response.dispose();
        return;
      }
      if (decision === "fixture") return backend.handle(route);
      if (decision === "checkout-fixture") return route.fulfill({ contentType: "text/javascript", body: PAYMENT_FIXTURE_SCRIPT });
      const safeUrl = (() => { try { const u = new URL(request.url()); return u.origin + u.pathname; } catch { return "unsupported protocol"; } })();
      denied.push(`${request.method()} ${safeUrl}`);
      if (mode !== "live") unexpected.push(`${request.method()} ${safeUrl}`);
      return route.abort("blockedbyclient");
    });
    await context.routeWebSocket(/.*/, socket => {
      denied.push("WebSocket blocked");
      if (mode !== "live") unexpected.push("Unexpected WebSocket");
      socket.close();
    });
    await use();
    for (const page of context.pages()) {
      if (!expectedErrors() && !page.isClosed()) {
        const boundary = page.getByRole("heading", { name: "Something went wrong", exact: true });
        if (await boundary.count()) errors.push("Application error boundary is visible");
      }
    }
    await info.attach("network-safety", { body: JSON.stringify({ mode, denied, unexpected, fixtureCalls: backend.calls, unsupportedFixtureCalls: backend.unexpected, pageErrors: errors, consoleErrors }, null, 2), contentType: "application/json" });
    expect(backend.unexpected, "Every simulated API contract must be explicitly implemented").toEqual([]);
    expect(unexpected, "Unexpected network requests were blocked before leaving the browser").toEqual([]);
    if (!expectedErrors()) expect(errors, "Uncaught browser errors or failed required assets").toEqual([]);
  }, { auto: true }]
});
export { expect };

export async function navigate(page: Page, label: string | RegExp) {
  const button = page.getByRole("button", { name: label, exact: typeof label === "string" }).filter({ visible: true });
  if (!(await button.count())) {
    await page.getByRole("button", { name: "More", exact: true }).filter({ visible: true }).click();
  }
  await expect(button).toHaveCount(1);
  await button.click();
}

export async function signIn(page: Page) {
  await page.goto("#/settings");
  await page.getByPlaceholder("you@example.com", { exact: true }).fill("virtual-tester@example.invalid");
  await page.getByPlaceholder("Password (min 6 characters)").fill("Synthetic-password-not-a-secret");
  const cloud = page.locator("section").filter({ has: page.getByRole("heading", { name: /Cloud sync/ }) });
  await cloud.locator('input[type="password"] + button').click();
  await expect(page.getByText("virtual-tester@example.invalid", { exact: true })).toBeVisible();
}
