/* Generic, dependency-free helpers. */

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

export const fmtTime = (s: number): string => {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const r = t % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};
