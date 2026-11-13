import type { Page } from "@playwright/test";
import { test, expect, signIn } from "./fixtures";
import type { FixtureBackend } from "./backend";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const CORE_LISTS = [
  { p_action: "results.list", p_args: { limit: 1 } },
  { p_action: "results.list", p_args: { limit: 150 } },
  { p_action: "reviews.list", p_args: {} },
  { p_action: "reviews.resolved", p_args: { limit: 150 } },
  { p_action: "variants.list", p_args: { limit: 50 } },
  { p_action: "exemplars.list", p_args: { limit: 200 } },
  { p_action: "memory.stats", p_args: {} },
  { p_action: "strikes.list", p_args: {} },
];

async function openCore(page: Page) {
  await page.goto("#/jobs");
  await expect(page.getByRole("heading", { name: /Auto-apply engine/ })).toBeVisible();
  for (const name of [/Applications report/, /Applied by User/, /Tailored resumes/, /Review queue/, /What the judge learned/]) {
    await page.getByRole("button", { name }).click();
  }
}

async function expectOwnContracts(backend: FixtureBackend) {
  await expect.poll(() => backend.calls.filter(call => call.method === "POST" && call.path === "/rest/v1/rpc/my_apply_action").map(call => call.body)).toEqual(expect.arrayContaining(CORE_LISTS));
  const calls = backend.calls.filter(call => call.method === "POST" && call.path === "/rest/v1/rpc/my_apply_action");
  for (const call of calls) expect(CORE_LISTS).toContainEqual(call.body);
  expect(backend.calls.filter(call => /\/rest\/v1\/rpc\/admin_/.test(call.path)), "Customer core must never fall back to global admin APIs").toEqual([]);
}

async function expectNoAdminControls(page: Page) {
  await expect(page.getByRole("region", { name: "Legacy administrator controls", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Run now/ })).toHaveCount(0);
}

for (const persona of ["addon", "complimentary", "platinum"] as const) {
  test(`${persona} opens only own core and pairs/revokes a synthetic agent @integration @simulated`, async ({ page, backend }) => {
    backend.persona = persona;
    backend.agentBindings.push({ user_id: USER_A, binding_id: "synthetic-agent-a", label: "Synthetic laptop A", created_at: new Date().toISOString(), last_used_at: null, revoked_at: null });
    backend.agentBindings.push({ user_id: USER_B, binding_id: "synthetic-agent-b", label: "Synthetic laptop B", created_at: new Date().toISOString(), last_used_at: null, revoked_at: null });
    await signIn(page);
    await openCore(page);
    await expect(page.getByText("Auto-apply active", { exact: true })).toBeVisible();
    await expectNoAdminControls(page);
    await expect(page.getByText(/No decisions recorded yet/)).toBeVisible();
    await expect(page.getByText(/Nothing here yet — resolve/)).toBeVisible();
    await expect(page.getByText(/No tailored variants yet/)).toBeVisible();
    await expect(page.getByText(/Nothing waiting — auto-submit/)).toBeVisible();
    await expect(page.getByText(/Nothing learned yet/)).toBeVisible();

    const agent = page.getByRole("region", { name: "Personal agent", exact: true });
    await expect(agent.getByText("Synthetic laptop A", { exact: true })).toBeVisible();
    await expect(agent.getByText("Synthetic laptop B", { exact: true })).toHaveCount(0);
    await agent.getByRole("button", { name: "Create pairing code", exact: true }).click();
    await expect(agent.getByText("SYNTHETIC-PAIR-1", { exact: true })).toBeVisible();
    expect(backend.pairingCodes).toHaveLength(1);
    expect(backend.pairingCodes[0].user_id).toBe(USER_A);
    await agent.getByRole("button", { name: "Revoke agent", exact: true }).click();
    await expect(agent.getByText("revoked", { exact: true })).toBeVisible();
    await expect(agent.getByRole("button", { name: "Revoke agent", exact: true })).toHaveCount(0);
    expect(backend.agentBindings[0].revoked_at).not.toBeNull();
    expect(backend.agentBindings[1].revoked_at).toBeNull();
    expect(backend.calls.filter(call => call.method === "POST" && call.path === "/functions/v1/apply-agent").map(call => call.body)).toEqual([
      { operation: "bindings.list" }, { operation: "pair.create" },
      { operation: "bindings.revoke", binding_id: "synthetic-agent-a" }, { operation: "bindings.list" },
    ]);
    await expectOwnContracts(backend);
  });
}

test("free cannot create a pairing code but can revoke an existing synthetic agent @integration @simulated", async ({ page, backend }) => {
  backend.persona = "free";
  backend.agentBindings.push({ user_id: USER_A, binding_id: "synthetic-expired-grant-agent", label: "Synthetic old agent", created_at: new Date().toISOString(), last_used_at: null, revoked_at: null });
  await signIn(page);
  await page.goto("#/jobs");
  const agent = page.getByRole("region", { name: "Personal agent", exact: true });
  await expect(agent.getByRole("button", { name: "Create pairing code", exact: true })).toBeDisabled();
  await expect(agent.getByText(/An active auto-apply grant is required/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Unlock with Platinum or add-on", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Applications report/ })).toHaveCount(0);
  await expectNoAdminControls(page);
  await agent.getByRole("button", { name: "Revoke agent", exact: true }).click();
  await expect(agent.getByText("revoked", { exact: true })).toBeVisible();
  expect(backend.pairingCodes).toEqual([]);
  expect(backend.calls.filter(call => call.path === "/rest/v1/rpc/my_apply_action" || /\/rpc\/admin_/.test(call.path))).toEqual([]);
  expect(backend.calls.filter(call => call.method === "POST" && call.path === "/functions/v1/apply-agent").map(call => call.body)).toEqual([
    { operation: "bindings.list" }, { operation: "bindings.revoke", binding_id: "synthetic-expired-grant-agent" }, { operation: "bindings.list" },
  ]);
});

test("switching synthetic accounts never displays the other user's core history @integration @simulated", async ({ page, backend }) => {
  backend.persona = "addon";
  const now = new Date().toISOString();
  for (const [user_id, label] of [[USER_A, "Alpha"], [USER_B, "Beta"]] as const) {
    const posting = { user_id, site_host: "employer.example.invalid", job_url: `https://employer.example.invalid/${label}`, company: null, fit: null, posted_age_h: null, created_at: now };
    backend.applyResults.push({ ...posting, id: `${label}-result`, title: `Synthetic ${label} result`, result: "submitted", detail: null, feedback: null });
    backend.reviews.push({ ...posting, id: `${label}-review`, title: `Synthetic ${label} pending posting`, form_url: null, reason: null, form_fields: null, status: "pending" });
    backend.reviews.push({ ...posting, id: `${label}-resolved`, title: `Synthetic ${label} resolved posting`, form_url: null, reason: null, form_fields: null, status: "done", resolved_at: now });
    backend.variants.push({ ...posting, id: `${label}-variant`, title: `Synthetic ${label} resume variant`, master_text: null, variant_text: null, diff_summary: null, variant_id: `${label}-content`, approved: false, approved_at: null });
    backend.exemplars.push({ user_id, id: `${label}-exemplar`, kind: "positive", summary: `Synthetic ${label} learned exemplar`, reason: null, source_url: null, created_at: now });
    backend.agentBindings.push({ user_id, binding_id: `${label}-binding`, label: `Synthetic ${label} agent`, created_at: now, last_used_at: null, revoked_at: null });
  }

  // One browser keeps its local state through sign-out/sign-in; the fixture filters
  // synthetic rows. This is UI account-isolation coverage, not proof of real RLS.
  for (const [userId, own, other] of [[USER_A, "Alpha", "Beta"], [USER_B, "Beta", "Alpha"], [USER_A, "Alpha", "Beta"]] as const) {
    backend.userId = userId;
    await signIn(page);
    await openCore(page);
    for (const suffix of ["result", "pending posting", "resolved posting", "resume variant", "learned exemplar", "agent"]) {
      await expect(page.getByText(`Synthetic ${own} ${suffix}`, { exact: true })).toBeVisible();
      await expect(page.getByText(`Synthetic ${other} ${suffix}`, { exact: true })).toHaveCount(0);
    }
    await expectNoAdminControls(page);
    await page.goto("#/settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByPlaceholder("you@example.com", { exact: true })).toBeVisible();
  }
  await expectOwnContracts(backend);
  expect(backend.calls.filter(call => call.path === "/rest/v1/rpc/my_apply_action").map(call => call.userId)).toEqual(expect.arrayContaining([USER_A, USER_B]));
});

test("redeeming a synthetic gift code unlocks Platinum without checkout @integration @simulated", async ({ page, backend }) => {
  backend.persona = "free";
  backend.giftCodes.set("IQGRANT-SYNTHETIC-GIFT", { product: "platinum" });
  await signIn(page);
  await page.getByPlaceholder("IQGRANT-…", { exact: true }).fill(" iqgrant-synthetic-gift ");
  await page.getByRole("button", { name: "Redeem", exact: true }).click();
  await expect(page.getByText(/Code redeemed — Pro is now active on your account/)).toBeVisible();
  expect(backend.redeemedGifts.get(USER_A)).toBe("platinum");
  expect(backend.giftCodes.get("IQGRANT-SYNTHETIC-GIFT")?.redeemedBy).toBe(USER_A);
  expect(backend.calls.filter(call => call.path === "/rest/v1/rpc/redeem_grant").map(call => call.body)).toEqual([{ p_code: "IQGRANT-SYNTHETIC-GIFT" }]);
  await page.reload();
  await expect(page.getByText("virtual-tester@example.invalid", { exact: true })).toBeVisible();
  await openCore(page);
  await expect(page.getByText("Auto-apply active", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Personal agent", exact: true }).getByRole("button", { name: "Create pairing code", exact: true })).toBeEnabled();
  await expectNoAdminControls(page);
  await expect(page.getByText(/Nothing learned yet/)).toBeVisible();
  await expectOwnContracts(backend);
  expect(backend.calls.filter(call => call.path === "/functions/v1/pay-checkout" || call.path === "/functions/v1/pay-verify")).toEqual([]);
});
