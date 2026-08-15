/* ratelimit — tiny fixed-window in-memory limiter (docs/app-security.md G5).
   Best-effort: Supabase edge-function instances are ephemeral and multiple
   instances can run in parallel, so this bounds abuse per instance rather
   than globally. Paired with JWT/secret auth + the CORS allow-list, it
   raises the bar for spam and free-proxy abuse without external state. */

export function makeLimiter(limit: number, windowMs: number): (key: string) => boolean {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count += 1;
    return true;
  };
}

/** Best-effort client key: the caller's IP when available, else a fallback. */
export function clientKey(req: Request, fallback = "anon"): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? fallback;
}
