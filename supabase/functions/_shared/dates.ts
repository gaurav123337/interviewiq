/* dates — shared timestamp helpers for the job feed.

   Feeds disagree on epoch units: Lever returns createdAt in MILLISECONDS
   despite docs saying seconds (a 2026 posting arrives as ~1.75e12, not
   ~1.75e9). Naively multiplying by 1000 lands ~58k years in the future and
   toISOString() throws "time zone displacement out of range", killing the
   whole source. Normalize by magnitude instead: >1e11 is already ms. */

/** Convert a feed epoch (seconds OR milliseconds) to epoch milliseconds.
    Returns null for missing/invalid values so callers can skip cleanly. */
export function toEpochMs(ts: number): number | null {
  if (!ts || !Number.isFinite(ts) || ts < 0) return null;
  return ts > 1e11 ? ts : ts * 1000;
}
