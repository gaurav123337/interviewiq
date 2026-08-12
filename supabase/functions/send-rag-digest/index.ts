/* send-rag-digest — serverless email delivery for the weekly RAG digest.
   Invoked by the admin dashboard instead of a webhook bridge. Sends via
   Resend when RESEND_API_KEY is configured as a function secret; otherwise
   it answers sent:false with a clear reason so the UI can say what's missing.

   Security: when RAG_DIGEST_SECRET is set (recommended), requests must carry
   it in the x-rag-secret header. The function never touches user data — it
   only formats and sends what the admin client passes in. */

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rag-secret, x-resend-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
});

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });

  const headers = { ...cors(req), "Content-Type": "application/json" };
  try {
    /* optional shared secret — reject calls that don't know it */
    const secret = Deno.env.get("RAG_DIGEST_SECRET") ?? "";
    if (secret && req.headers.get("x-rag-secret") !== secret) {
      return new Response(JSON.stringify({ sent: false, reason: "forbidden — missing or wrong x-rag-secret" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({})) as { to?: string[]; from?: string; digest?: Record<string, unknown> };
    const to = (body.to ?? []).filter((e): e is string => typeof e === "string" && e.includes("@"));
    const digest = body.digest ?? {};
    const from = body.from ?? "InterviewIQ <digest@interviewiq.app>";

    /* provider key: function secret wins, else the admin-supplied per-request
       key (stored only in the admin's browser, never published to clients) */
    const apiKey = Deno.env.get("RESEND_API_KEY") ?? req.headers.get("x-resend-key") ?? "";
    if (!apiKey) {
      return new Response(JSON.stringify({ sent: false, reason: "no Resend key — set the function secret RESEND_API_KEY or enter one in the RAG digest card" }), { status: 200, headers });
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
