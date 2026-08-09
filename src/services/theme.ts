/* Light/dark theme — persisted per-device and applied by toggling the
   "light" class on <html> (all Tailwind tokens are CSS variables, so the
   whole app re-themes instantly; see index.css for the light palette). */

import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  return storageGet<Theme>(STORAGE_KEYS.theme, "dark");
}

export function applyTheme(t: Theme): void {
  document.documentElement.classList.toggle("light", t === "light");
  /* keep the browser chrome (status bar etc.) in sync */
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", t === "light" ? "#eef1f8" : "#0a0e1a");
}

export function setTheme(t: Theme): void {
  storageSet(STORAGE_KEYS.theme, t);
  applyTheme(t);
}

export function initTheme(): void {
  applyTheme(getTheme());
}
