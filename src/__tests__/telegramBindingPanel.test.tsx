// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  user: { id: "account-a" } as { id: string } | null,
  entitled: true,
  cloud: new Set<(state: { user: { id: string } | null }) => void>(),
  entitlement: new Set<() => void>(),
  get: vi.fn(), save: vi.fn(), test: vi.fn(), disconnect: vi.fn(),
}));
vi.mock("../services/cloud", () => ({
  getCloudState: () => ({ user: state.user }),
  subscribeCloud: (fn: (s: { user: { id: string } | null }) => void) => { state.cloud.add(fn); return () => state.cloud.delete(fn); },
}));
vi.mock("../services/entitlement", () => ({
  serverAutoApply: () => state.entitled,
  subscribeEntitlement: (fn: () => void) => { state.entitlement.add(fn); return () => state.entitlement.delete(fn); },
}));
vi.mock("../services/jobSites", async importOriginal => ({
  ...await importOriginal<typeof import("../services/jobSites")>(),
  getNotifyConfig: state.get, setNotifyConfig: state.save, testNotifyConfig: state.test, disconnectNotifyConfig: state.disconnect,
}));
import TelegramBindingPanel from "../components/jobs/TelegramBindingPanel";
import type { NotifyConfig, NotifyTestResult } from "../services/jobSites";

const token = "123456789:synthetic_dummy_token_not_a_secret";
const binding: NotifyConfig = { chat_id: "42", has_token: true, time_zone: "Asia/Kolkata", delivery_tested_at: null, updated_at: "2026-11-12T12:00:00Z", revision: 0 };
const tested: NotifyConfig = { ...binding, delivery_tested_at: "2026-11-13T12:00:00Z", updated_at: "2026-11-13T12:00:00Z", revision: 1 };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function openPanel() {
  render(<TelegramBindingPanel />);
  await waitFor(() => expect(screen.getByRole("button", { name: /^Telegram ·/ }).textContent).not.toContain("Loading"));
  fireEvent.click(screen.getByRole("button", { name: /^Telegram ·/ }));
}
function switchAccount(id: string | null) {
  state.user = id ? { id } : null;
  for (const listener of [...state.cloud]) listener({ user: state.user });
}
function setEntitled(value: boolean) {
  act(() => { state.entitled = value; for (const listener of state.entitlement) listener(); });
}
beforeEach(() => {
  state.user = { id: "account-a" }; state.entitled = true; state.cloud.clear(); state.entitlement.clear();
  state.get.mockReset().mockResolvedValue(binding);
  state.save.mockReset().mockResolvedValue({ sent: true, config: tested });
  state.test.mockReset().mockResolvedValue({ sent: true, config: tested });
  state.disconnect.mockReset().mockResolvedValue({ sent: false, disconnected: true, config: null });
});
afterEach(cleanup);

describe("Telegram account-bound delivery-first controls", () => {
  it("shows configured separately from delivery-tested; never populates saved token", async () => {
    await openPanel();
    expect(screen.getByRole("button", { name: /Configured · not delivery-tested/ })).toBeTruthy();
    expect((screen.getByLabelText("Telegram chat ID") as HTMLInputElement).value).toBe("42");
    expect((screen.getByLabelText("BotFather token") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Telegram time zone") as HTMLInputElement).value).toBe("Asia/Kolkata");
    expect(screen.getByText(/Delivery tested: Never/)).toBeTruthy();
    expect(screen.getByText(/per-job submitted, needs_review and error/)).toBeTruthy();
    expect(screen.getByText(/not proof of chat ownership/)).toBeTruthy();
  });

  it("validates first bindings and time zones before any save/delivery", async () => {
    state.get.mockResolvedValue(null);
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Save and test" }));
    expect(screen.getByRole("status").textContent).toMatch(/numeric/);
    fireEvent.change(screen.getByLabelText("Telegram chat ID"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and test" }));
    expect(screen.getByRole("status").textContent).toMatch(/BotFather/);
    fireEvent.change(screen.getByLabelText("BotFather token"), { target: { value: token } });
    fireEvent.change(screen.getByLabelText("Telegram time zone"), { target: { value: "Mars/Olympus" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and test" }));
    expect(screen.getByRole("status").textContent).toMatch(/IANA/);
    expect(state.save).not.toHaveBeenCalled();
    expect(state.test).not.toHaveBeenCalled();
  });

  it("save success sends one delivery-first operation with blank token reuse and updates timestamp", async () => {
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Save and test" }));
    await screen.findByText(/Saved after delivery test passed/);
    expect(state.save.mock.calls).toEqual([["42", "", "Asia/Kolkata", 0]]);
    expect(state.test).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Telegram · Delivery test passed" })).toBeTruthy();
    expect(screen.getByText(/Delivery tested:/).textContent).not.toContain("Never");
    expect((screen.getByLabelText("BotFather token") as HTMLInputElement).value).toBe("");
  });

  it.each(["delivery failure", "transport failure", "stale after sent"])("%s keeps old binding and clears replacement token", async outcome => {
    if (outcome === "transport failure") state.save.mockRejectedValue(new Error(token));
    else state.save.mockResolvedValue({ sent: outcome === "stale after sent", reason: outcome === "stale after sent" ? "stale_binding" : "telegram_rejected", config: tested });
    await openPanel();
    fireEvent.change(screen.getByLabelText("Telegram chat ID"), { target: { value: "99" } });
    fireEvent.change(screen.getByLabelText("BotFather token"), { target: { value: token } });
    fireEvent.click(screen.getByRole("button", { name: "Save and test" }));
    await screen.findByRole("status");
    expect(screen.getByText(/Saved chat: 42/)).toBeTruthy();
    expect(screen.getByText(/Delivery tested: Never/)).toBeTruthy();
    expect(screen.queryByText(/Saved after delivery test passed/)).toBeNull();
    expect(screen.getByRole("status").textContent).not.toContain(token);
    expect((screen.getByLabelText("BotFather token") as HTMLInputElement).value).toBe("");
  });

  it("Test again uses persisted revision, not an unsaved replacement; Disconnect clears binding", async () => {
    await openPanel();
    fireEvent.change(screen.getByLabelText("Telegram chat ID"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "Test again" }));
    await screen.findByText(/^Delivery test passed\. Check/);
    expect(state.test.mock.calls).toEqual([[0]]);
    expect(state.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await screen.findByText("Telegram disconnected.");
    expect(state.disconnect.mock.calls).toEqual([[1]]);
    expect(screen.getByRole("button", { name: "Telegram · Not configured" })).toBeTruthy();
    expect((screen.getByLabelText("Telegram chat ID") as HTMLInputElement).value).toBe("");
  });

  it("blocks duplicate operations and editing while busy", async () => {
    const pending = deferred<NotifyTestResult>(); state.save.mockReturnValue(pending.promise);
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Save and test" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving and testing…" }));
    for (const name of ["Saving and testing…", "Test again", "Disconnect", "Reload Telegram settings"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByLabelText("Telegram chat ID") as HTMLInputElement).disabled).toBe(true);
    expect(state.save).toHaveBeenCalledOnce();
    await act(async () => pending.resolve({ sent: true, config: tested }));
    expect((screen.getByRole("button", { name: "Save and test" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("reacts to canonical entitlement changes, disallows tests, still allows disconnect expired", async () => {
    await openPanel();
    fireEvent.change(screen.getByLabelText("BotFather token"), { target: { value: token } });
    setEntitled(false);
    expect((screen.getByLabelText("BotFather token") as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Save and test" }));
    fireEvent.click(screen.getByRole("button", { name: "Test again" }));
    expect(state.save).not.toHaveBeenCalled(); expect(state.test).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Disconnect" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await screen.findByText("Telegram disconnected.");
  });

  it("switching accounts clears drafts, hides prior config and ignores late save", async () => {
    const pending = deferred<NotifyTestResult>(); state.save.mockReturnValue(pending.promise);
    await openPanel();
    fireEvent.change(screen.getByLabelText("BotFather token"), { target: { value: token } });
    fireEvent.click(screen.getByRole("button", { name: "Save and test" }));
    state.get.mockResolvedValue(null);
    act(() => switchAccount("account-b"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Telegram · Not configured" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Telegram · Not configured" }));
    expect((screen.getByLabelText("Telegram chat ID") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("BotFather token") as HTMLInputElement).value).toBe("");
    await act(async () => pending.resolve({ sent: true, config: tested }));
    expect(screen.queryByText(/Saved chat: 42/)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("batched A→B→A switches reset drafts rather than preserving the old keyed instance", async () => {
    await openPanel();
    fireEvent.change(screen.getByLabelText("BotFather token"), { target: { value: token } });
    act(() => { switchAccount("account-b"); switchAccount("account-a"); });
    await waitFor(() => expect(screen.getByRole("button", { name: /Configured/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Configured/ }));
    expect((screen.getByLabelText("BotFather token") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("button", { name: "Save and test" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("ignores a late prior-account read, and sign-out removes account data", async () => {
    const pending = deferred<NotifyConfig | null>(); state.get.mockReturnValueOnce(pending.promise);
    render(<TelegramBindingPanel />);
    state.get.mockResolvedValue(null);
    act(() => switchAccount("account-b"));
    await screen.findByRole("button", { name: "Telegram · Not configured" });
    await act(async () => pending.resolve(binding));
    expect(screen.queryByRole("button", { name: /Configured ·/ })).toBeNull();
    act(() => switchAccount(null));
    expect(screen.queryByRole("button", { name: /^Telegram ·/ })).toBeNull();
    expect(screen.getByText(/Sign in to manage Telegram/)).toBeTruthy();
  });
});
