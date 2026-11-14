import type { Page } from "@playwright/test";
import { test, expect, signIn } from "./fixtures";

/* Strict fixture-only browser coverage; delivery and RLS are not verified here.
   The request-policy guard blocks every real Telegram/network destination. */
const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const TOKEN = "123456789:synthetic_dummy_token_not_a_secret";
const OLD = { chat_id: "42", bot_token: TOKEN, time_zone: "UTC", delivery_tested_at: null, updated_at: "2026-11-12T12:00:00Z", revision: 0 };
async function openTelegram(page: Page) {
  await page.goto("#/jobs");
  const panel = page.getByRole("region", { name: "Telegram binding", exact: true });
  const toggle = panel.getByRole("button", { name: /^Telegram ·/ });
  await expect(toggle).not.toContainText("Loading");
  await toggle.click();
  await expect(panel.getByRole("button", { name: "Save and test", exact: true })).toBeVisible();
  return panel;
}

test("Telegram failed save preserves binding; success tests first, stamps metadata, tests again and disconnects @integration @simulated", async ({ page, backend }) => {
  backend.persona = "addon";
  backend.notifyConfigs.set(USER_A, { ...OLD });
  backend.notifyConfigs.set(USER_B, { ...OLD, chat_id: "84" });
  await signIn(page);
  const panel = await openTelegram(page);
  await expect(panel.getByRole("button", { name: /Configured · not delivery-tested/ })).toBeVisible();
  await expect(panel.getByLabel("BotFather token", { exact: true })).toHaveValue("");
  await expect(panel.getByText(/per-job submitted, needs_review and error/)).toBeVisible();
  await expect(panel.getByText(/not proof of chat ownership/)).toBeVisible();

  backend.notifyDeliveryFailure = true;
  await panel.getByLabel("Telegram chat ID", { exact: true }).fill("99");
  await panel.getByLabel("BotFather token", { exact: true }).fill(TOKEN);
  await panel.getByLabel("Telegram time zone", { exact: true }).fill("Asia/Kolkata");
  await panel.getByRole("button", { name: "Save and test", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("Delivery test failed");
  expect(backend.notifyConfigs.get(USER_A)).toEqual(OLD);
  expect(backend.notifyDeliveries).toEqual([]);
  await expect(panel.getByText(/Saved chat: 42/)).toBeVisible();
  await expect(panel.getByText(/Delivery tested: Never/)).toBeVisible();
  await expect(panel.getByLabel("BotFather token", { exact: true })).toHaveValue("");

  backend.notifyDeliveryFailure = false;
  await panel.getByRole("button", { name: "Save and test", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("Saved after delivery test passed");
  const saved = backend.notifyConfigs.get(USER_A)!;
  expect(saved.chat_id).toBe("99"); expect(saved.bot_token).toBe(TOKEN); expect(saved.time_zone).toBe("Asia/Kolkata");
  expect(saved.revision).toBe(1); expect(saved.delivery_tested_at).toEqual(expect.any(String));
  expect(Number.isNaN(Date.parse(String(saved.delivery_tested_at)))).toBe(false);
  await expect(panel.getByRole("button", { name: "Telegram · Delivery test passed", exact: true })).toBeVisible();
  await expect(panel.getByText(/Delivery tested:/)).not.toContainText("Never");
  expect(backend.notifyDeliveries).toEqual([{ user_id: USER_A, operation: "save", chat_id: "99", message_id: 1 }]);

  await panel.getByRole("button", { name: "Test again", exact: true }).click();
  await expect(panel.getByRole("status")).toHaveText("Delivery test passed. Check the test message arrived in the intended chat.");
  expect(backend.notifyDeliveries[1]).toEqual({ user_id: USER_A, operation: "test", chat_id: "99", message_id: 2 });
  expect(backend.notifyConfigs.get(USER_A)?.revision).toBe(2);
  await panel.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(panel.getByRole("status")).toHaveText("Telegram disconnected.");
  await expect(panel.getByRole("button", { name: "Telegram · Not configured", exact: true })).toBeVisible();
  expect(backend.notifyConfigs.get(USER_A)?.bot_token).toBeNull();
  expect(backend.notifyConfigs.get(USER_B)).toEqual({ ...OLD, chat_id: "84" });
  expect(backend.calls.filter(call => call.path === "/functions/v1/send-notify-test").map(call => call.body)).toEqual([
    { operation: "save", chatId: "99", botToken: TOKEN, timeZone: "Asia/Kolkata", revision: 0 },
    { operation: "save", chatId: "99", botToken: "", timeZone: "Asia/Kolkata", revision: 0 },
    { operation: "test", revision: 1 }, { operation: "unbind", revision: 2 },
  ]);
  expect(backend.calls.filter(call => call.path === "/rest/v1/user_notify_config")).toEqual([]);
});

test("Telegram first binding validates numeric chat, token and time zone, then records successful test @integration @simulated", async ({ page, backend }) => {
  backend.persona = "platinum";
  await signIn(page);
  const panel = await openTelegram(page);
  await expect(panel.getByLabel("Telegram time zone", { exact: true })).toHaveValue("UTC");
  await panel.getByLabel("Telegram chat ID", { exact: true }).fill("@wrongchat");
  await panel.getByRole("button", { name: "Save and test", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("numeric");
  await panel.getByLabel("Telegram chat ID", { exact: true }).fill("-100123456789");
  await panel.getByLabel("BotFather token", { exact: true }).fill("not-a-token");
  await panel.getByRole("button", { name: "Save and test", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("BotFather");
  await panel.getByLabel("BotFather token", { exact: true }).fill(TOKEN);
  await panel.getByLabel("Telegram time zone", { exact: true }).fill("Mars/Olympus");
  await panel.getByRole("button", { name: "Save and test", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("IANA");
  expect(backend.calls.filter(call => call.path === "/functions/v1/send-notify-test")).toEqual([]);
  await panel.getByLabel("Telegram time zone", { exact: true }).fill("Europe/London");
  await panel.getByRole("button", { name: "Save and test", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("Saved after delivery test passed");
  expect(backend.notifyConfigs.get(USER_A)?.delivery_tested_at).toEqual(expect.any(String));
  expect(backend.calls.find(call => call.path === "/functions/v1/send-notify-test")?.body).toEqual({ operation: "save", chatId: "-100123456789", botToken: TOKEN, timeZone: "Europe/London", revision: null });
});

test("Telegram stale acknowledgement never claims saved or replaces previous binding @integration @simulated", async ({ page, backend }) => {
  backend.persona = "addon"; backend.notifyConfigs.set(USER_A, { ...OLD }); backend.notifyStaleAfterDelivery = true;
  await signIn(page);
  const panel = await openTelegram(page);
  await panel.getByLabel("Telegram chat ID", { exact: true }).fill("99");
  await panel.getByRole("button", { name: "Save and test", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("Settings changed elsewhere");
  await expect(panel.getByText(/Saved chat: 42/)).toBeVisible();
  await expect(panel.getByText(/Delivery tested: Never/)).toBeVisible();
  expect(backend.notifyConfigs.get(USER_A)).toEqual(OLD);
  expect(backend.notifyDeliveries).toHaveLength(1);
});

test("Telegram account switching resets private drafts; expired accounts can disconnect only their binding @integration @simulated", async ({ page, backend }) => {
  backend.persona = "addon";
  backend.notifyConfigs.set(USER_A, { ...OLD }); backend.notifyConfigs.set(USER_B, { ...OLD, chat_id: "84", time_zone: "Europe/London" });
  await signIn(page);
  const first = await openTelegram(page);
  await first.getByLabel("Telegram chat ID", { exact: true }).fill("999");
  await first.getByLabel("BotFather token", { exact: true }).fill(TOKEN);
  await page.goto("#/settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByPlaceholder("you@example.com", { exact: true })).toBeVisible();
  backend.userId = USER_B; backend.persona = "free";
  await signIn(page);
  const second = await openTelegram(page);
  await expect(second.getByLabel("Telegram chat ID", { exact: true })).toHaveValue("84");
  await expect(second.getByLabel("BotFather token", { exact: true })).toHaveValue("");
  await expect(second.getByLabel("Telegram time zone", { exact: true })).toHaveValue("Europe/London");
  await expect(second.getByText(/Saved chat: 42/)).toHaveCount(0);
  await expect(second.getByRole("button", { name: "Save and test", exact: true })).toBeDisabled();
  await expect(second.getByRole("button", { name: "Test again", exact: true })).toBeDisabled();
  await expect(second.getByRole("button", { name: "Disconnect", exact: true })).toBeEnabled();
  await second.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(second.getByRole("status")).toHaveText("Telegram disconnected.");
  expect(backend.notifyConfigs.get(USER_A)).toEqual(OLD);
  expect(backend.notifyConfigs.get(USER_B)?.bot_token).toBeNull();
  expect(backend.notifyDeliveries).toEqual([]);
  expect(backend.calls.filter(call => call.path === "/functions/v1/send-notify-test").map(call => ({ userId: call.userId, body: call.body }))).toEqual([{ userId: USER_B, body: { operation: "unbind", revision: 0 } }]);
});
