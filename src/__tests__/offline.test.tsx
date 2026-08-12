// @vitest-environment jsdom
/* Offline-readiness: the service worker must precache exactly the built
   JS/CSS assets (so the whole app — including the legal pages reachable from
   the footer on every view — works with no network), and the legal views
   must render purely from bundled data + local cache, never fetching.

   The service worker is a plain JS file in public/ and the dist/ artifacts
   are read via Vite-native ?raw / import.meta.glob (no Node built-ins, to
   stay inside the project's browser-only type space). A build must have run
   (npm run build) — the deploy pipeline always builds first. */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AppProvider } from "../store";
import { Legal } from "../components/Legal";

import swRaw from "../../public/sw.js?raw";

/* dist/ contents, keyed by their path relative to this file (eager: true
   loads them as strings at module scope). Empty when no build has run. */
const distFiles = import.meta.glob("../../dist/**/*", { eager: true, query: "?raw" }) as Record<string, string>;

/* Must stay in sync with the regex literal inside public/sw.js — this is the
   pattern the SW uses at install to precache every hashed JS/CSS asset. */
const ASSET_RE = /(?:src|href)="([^"]+\.(?:js|css))"/g;

/* eager globs resolve to module namespaces; unwrap to the raw file text */
const fileText = (k: string): string => {
  const v = distFiles[k];
  if (typeof v === "string") return v;
  const d = (v as { default?: unknown } | undefined)?.default;
  return typeof d === "string" ? d : "";
};

const extractAssets = (html: string): string[] => [...html.matchAll(ASSET_RE)].map(m => m[1]);

const distPath = (rel: string): string => `../../dist/${rel.replace(/^\.\//, "")}`;

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

describe("service-worker offline shell", () => {
  it("sw.js precaches the hashed JS/CSS bundle at install time", () => {
    expect(swRaw).toContain("interviewiq-v"); // cache version (bumped per deploy)
    expect(swRaw).toContain("c.addAll(SHELL)");
    /* the runtime precache: parse index.html and add every referenced asset */
    expect(swRaw).toContain('(?:src|href)="([^"]+\\.(?:js|css))"');
    expect(swRaw).toContain("c.add(a).catch");
    expect(swRaw).toContain("skipWaiting()");
  });

  it("precache list matches the built assets (every js/css in index.html exists)", () => {
    const htmlKey = Object.keys(distFiles).find(k => k.endsWith("/dist/index.html"));
    expect(htmlKey, "dist/index.html missing — run `npm run build` before the offline tests").toBeTruthy();
    const html = fileText(htmlKey!);

    const assets = extractAssets(html);
    /* a deploy always has at least the JS bundle + stylesheet */
    expect(assets.length).toBeGreaterThanOrEqual(2);
    for (const a of assets) {
      expect(distFiles[distPath(a)], `built asset missing in dist: ${a}`).toBeTruthy();
    }
    /* shell entries the SW addAll's must exist too */
    for (const s of ["./index.html", "./manifest.webmanifest"]) {
      expect(distFiles[distPath(s)], `shell entry missing in dist: ${s}`).toBeTruthy();
    }
  });
});

describe("legal views render offline (fetch fails)", () => {
  it("renders the Terms document from bundled data without a single fetch", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(
      <AppProvider>
        <Legal />
      </AppProvider>
    );
    expect(screen.getByRole("heading", { name: /Terms of Service/i })).toBeTruthy();
    expect(screen.getByText(/Acceptance of Terms/i)).toBeTruthy();
    /* contact placeholder filled from config — no network involved */
    expect(screen.getAllByText(/gaurav\.123337@gmail\.com/).length).toBeGreaterThan(0);
    /* compliance banner proving all four provider-required pages exist */
    expect(screen.getByText(/All four required pages are published/i)).toBeTruthy();
    /* the view must never touch the network */
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("switches to the Privacy document via hash while offline", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    window.location.hash = "privacy";
    render(
      <AppProvider>
        <Legal />
      </AppProvider>
    );
    expect(screen.getByRole("heading", { name: /Privacy Policy/i })).toBeTruthy();
    expect(screen.getAllByText(/What we collect/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/What we never collect/i).length).toBeGreaterThan(0);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
