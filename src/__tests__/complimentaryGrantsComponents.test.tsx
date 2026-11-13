// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adminCreateGrant = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());

vi.mock("../services/entitlement", () => ({
  adminCreateGrant,
  COMPLIMENTARY_PRODUCTS: [
    { id: "monthly", label: "Monthly", defaultDays: 30 },
    { id: "yearly", label: "Yearly", defaultDays: 365 },
    { id: "lifetime", label: "Lifetime", defaultDays: 0 },
    { id: "platinum", label: "Platinum", defaultDays: 0 },
    { id: "auto_apply", label: "Auto-apply add-on", defaultDays: 0 }
  ]
}));
vi.mock("../toast", () => ({ toast }));

beforeEach(() => {
  adminCreateGrant.mockReset();
  adminCreateGrant.mockResolvedValue("IQGRANT-AUTO");
  toast.mockReset();
});
afterEach(cleanup);

describe("complimentary gift-code card", () => {
  it("offers every complimentary product and clearly separates gifts from coupons", async () => {
    const setBusy = vi.fn();
    const { GrantCodeCard } = await import("../components/admin/billing/GrantCodeCard");
    render(createElement(GrantCodeCard, { busy: false, setBusy }));

    expect(screen.getByRole("heading", { name: /Create a gift code/i })).toBeTruthy();
    expect(screen.getByText(/without checkout or a payment record/i)).toBeTruthy();
    expect(screen.getByText(/Coupons below remain payment discounts/i)).toBeTruthy();
    for (const label of ["Monthly", "Yearly", "Lifetime", "Platinum", "Auto-apply add-on"]) {
      expect(screen.getByRole("option", { name: label })).toBeTruthy();
    }
    expect(screen.queryByText(/% off/i)).toBeNull();

    fireEvent.change(screen.getByDisplayValue("Monthly"), { target: { value: "auto_apply" } });
    expect(screen.getByDisplayValue("No expiry")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create gift code" }));

    await waitFor(() => expect(adminCreateGrant).toHaveBeenCalledWith("auto_apply", 0));
    expect(setBusy).toHaveBeenNthCalledWith(1, true);
    expect(setBusy).toHaveBeenLastCalledWith(false);
    expect(await screen.findByText("IQGRANT-AUTO")).toBeTruthy();
    expect(screen.getByText(/Gift · Auto-apply add-on · no expiry/i)).toBeTruthy();
  });

  it("passes a custom duration instead of inventing a checkout discount", async () => {
    const { GrantCodeCard } = await import("../components/admin/billing/GrantCodeCard");
    render(createElement(GrantCodeCard, { busy: false, setBusy: vi.fn() }));
    fireEvent.change(screen.getByLabelText("Gift expiry"), { target: { value: "custom" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Create gift code" }));
    await waitFor(() => expect(adminCreateGrant).toHaveBeenCalledWith("monthly", 45));
  });
});
