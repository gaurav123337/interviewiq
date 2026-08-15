/* send-rag-digest — serverless email delivery for the weekly RAG digest.
   Invoked by the admin dashboard instead of a webhook bridge. Sends via
   Resend using the RESEND_API_KEY function secret — the client no longer
   supplies any key (docs/app-security.md G3/G6).

   Security: the caller must be a signed-in ADMIN (Supabase JWT verified
   server-side against app_admins / the owner). The function never touches
   user data — it only formats and sends what the admin client passes in.
   CORS is restricted to the app's origins. */

import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, isAllowedOrigin, preflightResponse } from "../_shared/cors.ts";

function renderDigest(d: Record<string, unknown>): string {
  const lines = [
    `InterviewIQ weekly RAG digest — week ${String(d.week ?? "?")}`,
    "",
    `Retrievals: ${d.total ?? 0}  (${d.groundedRate ?? 0}% grounded, ${d.emptyRate ?? 0}% empty)`,
    `Avg top similarity: ${d.avgTopSim ?? 0}`,
    `Concept-gate rejections: ${d.gateRejects ?? 0}`,
    `Week-over-week: ${d.prevTotal ?? 0} → ${d.total ?? 0} retrievals, ${d.prevGrounded ?? 0} → ${d.grounded ?? 0} grounded`
  ];
  const queries = d.topQueries as { q: string; n: number }[] | undefined;
  if (queries?.length) {
    lines.push("", "Top asked:", ...queries.map(q => `  - ${q.q} (${q.n})`));
  }
  const docs = d.topDocs as { id: number; n: number }[] | undefined;
  if (docs?.length) {
    lines.push("", "Top cited documents (ids):", ...docs.map(doc => `  - #${doc.id} (${doc.n})`));
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (!isAllowedOrigin(req)) {
    return new Response(JSON.stringify({ sent: false, reason: "origin not allowed" }), { status: 403, headers });
  }
  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return new Response(JSON.stringify({ sent: false, reason: "forbidden — admin session required" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({})) as { to?: string[]; from?: string; digest?: Record<string, unknown> };
    const to = (body.to ?? []).filter((e): e is string => typeof e === "string" && e.includes("@"));
    const digest = body.digest ?? {};
    const from = body.from ?? "InterviewIQ <digest@interviewiq.app>";

    /* provider key: function secret only — never accepted from the client */
    const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!apiKey) {
      return new Response(JSON.stringify({ sent: false, reason: "no Resend key — set the function secret RESEND_API_KEY" }), { status: 200, headers });
    }
    if (!to.length) {
      return new Response(JSON.stringify({ sent: false, reason: "no valid recipient emails" }), { status: 200, headers });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `InterviewIQ RAG digest — ${digest.groundedRate ?? 0}% grounded this week`,
        text: renderDigest(digest)
      })
    });
    const data = await res.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ sent: res.ok, id: (data as { id?: string }).id ?? null, reason: res.ok ? "sent" : `provider error ${res.status}` }),
      { status: res.ok ? 200 : 502, headers }
    );
  } catch (e) {
    return new Response(JSON.stringify({ sent: false, reason: "error: " + String(e) }), { status: 500, headers });
  }
});
