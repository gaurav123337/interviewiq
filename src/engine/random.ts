/* Small generic random-selection helpers shared across the engine. */

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickN<T>(arr: T[], n: number): T[] {
  if (n <= 0) return [];
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}
