/* Display currency — the app shows every salary in ONE currency so a feed
   mixing USD (global ATS/RSS) and INR (Indian boards/imports) postings reads
   consistently. Pure + testable; the preference is stored locally and
   defaults from the profile location (India → INR, everywhere else → USD).

   FX rates are the same approximate table the salary benchmark uses
   (₹83/USD, £0.78/USD, €0.92/USD) — display conversions are labelled
   approximate and never change the stored posting values. */

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export const CURRENCIES = ["USD", "INR", "GBP", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Approximate units of each currency per 1 USD. */
export const FX: Record<string, number> = { USD: 1, INR: 83, GBP: 0.78, EUR: 0.92 };

/** Convert an amount between currencies (via USD). Unknown currencies are
    treated as USD; 0/NaN in → 0 out. Rounding is to whole units. */
export function toCurrency(amount: number, from: string, to: string): number {
  if (!isFinite(amount) || amount <= 0) return 0;
  if (!from || !to || from === to) return Math.round(amount);
  const usd = amount / (FX[from] ?? 1);
  return Math.round(usd * (FX[to] ?? 1));
}

/** Default display currency for a profile location: India → INR, else USD. */
export function defaultCurrencyFor(location?: string | null): string {
  const loc = (location ?? "").toLowerCase();
  return /india|bengaluru|bangalore|mumbai|delhi|hyderabad|pune|chennai|gurgaon|gurugram|noida|kolkata|ahmedabad/.test(loc)
    ? "INR"
    : "USD";
}

/** The user's chosen display currency — persisted, or the location default. */
export function getDisplayCurrency(location?: string | null): string {
  const saved = storageGet<string>(STORAGE_KEYS.displayCurrency, "");
  return saved || defaultCurrencyFor(location);
}

/** Persist the display currency preference. */
export function setDisplayCurrency(c: string): void {
  storageSet(STORAGE_KEYS.displayCurrency, c);
}

/** A salary band converted to the display currency (values only — the caller
    keeps source metadata like "posting"/"estimate"). */
export function salaryInCurrency(
  s: { min: number; max: number; currency: string },
  to: string
): { min: number; max: number; currency: string } {
  return { min: toCurrency(s.min, s.currency, to), max: toCurrency(s.max, s.currency, to), currency: to };
}
