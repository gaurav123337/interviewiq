/* cors — explicit origin allow-list for edge functions (docs/app-security.md G5/G6).
   Browser requests from a disallowed origin get NO Access-Control-Allow-Origin,
   so the browser blocks the response. Server-to-server callers (pg_cron via
   pg_net, curl, the GitHub Actions run) send no Origin header and are
   unaffected — CORS is a browser concept, not an auth boundary. Auth is
   enforced separately per function (JWT / shared secret). */

export const ALLOWED_ORIGINS: string[] = [
  "https://gaurav123337.github.io",
  "http://localhost:8137",
  "http://127.0.0.1:8137",
  "http://localhost:8138",
  "http://127.0.0.1:8138"
];

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; /* server-to-server — not a browser request */
  return ALLOWED_ORIGINS.includes(origin);
}

export function corsHeaders(req: Request, extraAllowHeaders?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":
      `authorization, x-client-info, apikey, content-type${extraAllowHeaders ? `, ${extraAllowHeaders}` : ""}`,
    "Access-Control-Max-Age": "86400"
  };
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Vary"] = "Origin";
  }
  return h;
}

/** Standard preflight answer (204) when the origin is allowed. */
export function preflightResponse(req: Request): Response {
  if (!isAllowedOrigin(req)) {
    return new Response("origin not allowed", { status: 403 });
  }
  return new Response("ok", { status: 204, headers: corsHeaders(req) });
}
