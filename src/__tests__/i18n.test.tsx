// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "../i18n";
import en from "../i18n/locales/en.json";
import hi from "../i18n/locales/hi.json";
import { LanguageSwitcher, LANGUAGES } from "../components/LanguageSwitcher";

/* Item 19 (Phase 3) — i18n honesty. The switcher must never advertise a
   language that silently falls back to English. These tests lock the three
   honesty invariants so the language list can't drift back out of sync:
     1. every language i18next accepts has a real resource bundle;
     2. every offered translation is complete (leaf-parity with English);
     3. the switcher only offers languages that are actually registered.
   Invariant 3 is verified by RENDERING the real component (not by re-deriving
   its filter in the test) so reverting the component's filter fails a test. */

// Recurse into arrays too, so a shortened translated array (e.g. one fewer
// bullet in landing.freeFeatures) is caught as a missing leaf, not hidden
// behind an opaque array-valued key.
const leaves = (val: unknown, prefix = ""): string[] =>
  val && typeof val === "object"
    ? Object.entries(val as Record<string, unknown>).flatMap(([k, v]) =>
        leaves(v, prefix ? `${prefix}.${k}` : k)
      )
    : [prefix];

const registered = () => Object.keys(i18n.options.resources ?? {});
// i18next appends a synthetic "cimode" entry to supportedLngs; ignore it.
const advertised = () =>
  (i18n.options.supportedLngs || []).filter(l => l && l !== "cimode");

// Languages that were advertised before Item 19 but have no resource bundle —
// none of these must ever appear in the switcher again.
const DROPPED = [
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "ko", label: "한국어" },
];

describe("i18n honesty", () => {
  afterEach(cleanup);

  it("advertises exactly the honest set (en + hi), no more", () => {
    expect(registered().sort()).toEqual(["en", "hi"]);
  });

  it("every supported language has a registered resource bundle", () => {
    const reg = new Set(registered());
    expect(advertised().length).toBeGreaterThan(0);
    for (const lng of advertised()) expect(reg.has(lng)).toBe(true);
  });

  it("supportedLngs is derived from the resources (single source of truth)", () => {
    expect(advertised().sort()).toEqual(registered().sort());
  });

  it("Hindi is complete — leaf-parity with English, no fallback leaks", () => {
    const enKeys = new Set(leaves(en));
    const hiKeys = new Set(leaves(hi));
    const missing = [...enKeys].filter(k => !hiKeys.has(k));
    const extra = [...hiKeys].filter(k => !enKeys.has(k));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
    expect(hiKeys.size).toBe(enKeys.size);
  });

  it("every registered language has switcher display metadata", () => {
    const meta = new Set(LANGUAGES.map(l => l.code));
    for (const lng of registered()) expect(meta.has(lng)).toBe(true);
  });

  it("the switcher renders only registered languages — no dead advertised entries", () => {
    render(<LanguageSwitcher />);
    // open the dropdown (the option list is behind `open &&`)
    fireEvent.click(screen.getByLabelText("Change language"));

    // every registered language is offered, by its display label
    for (const code of registered()) {
      const meta = LANGUAGES.find(l => l.code === code)!;
      expect(screen.getByText(meta.label)).toBeTruthy();
    }
    // and nothing that lacks a resource bundle is advertised
    for (const gone of DROPPED) {
      expect(registered()).not.toContain(gone.code);
      expect(screen.queryByText(gone.label)).toBeNull();
    }
  });
});
