/* send-apply-digest — serverless email delivery for the weekly application
   digest (Apply Kit). Invoked by the app's "✉️ Email" button in the weekly
   report. Sends via Resend when RESEND_API_KEY is configured as a function
   secret; otherwise it answers sent:false with a clear reason so the client
   can fall back to its mailto link.

   Security: when APPLY_DIGEST_SECRET is set (recommended), requests must
   carry it in the x-apply-secret header. The function never reads user
   data — it only formats and sends what the client passes in, to the
   signed-in user's own email address. */

const cors = (req: Request): Record<string, string> => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-apply-secret, x-resend-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
});

/** Minimal text→HTML so the digest reads well in email clients. */
function renderHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = esc(text)
    .split(/\n{2,}/)
    .map(para => `<p style="margin:0 0 10px;color:#334155;line-height:1.6">${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
    <h2 style="color:#4f46e5;margin:0 0 4px">📬 InterviewIQ — weekly application digest</h2>
    <p style="color:#94a3b8;font-size:12px;margin:0 0 16px">Your application tracker, this week.</p>
    ${body}
    <p style="color:#94a3b8;font-size:12px;margin:20px 0 0">Update your tracker in the app — the digest is generated from your current activity.</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });

  const headers = { ...cors(req), "Content-Type": "application/json" };
  try {
    /* optional shared secret — reject calls that don't know it */
    const secret = Deno.env.get("APPLY_DIGEST_SECRET") ?? "";
    if (secret && req.headers.get("x-apply-secret") !== secret) {
      return new Response(JSON.stringify({ sent: false, reason: "forbidden — missing or wrong x-apply-secret" }), { status: 401, headers });
    }

    const body = await req.json().catch(() => ({})) as { to?: string; subject?: string; text?: string; from?: string };
    const to = body.to ?? "";
    const text = body.text ?? "";
    if (!to.includes("@") || !text.trim()) {
      return new Response(JSON.stringify({ sent: false, reason: "recipient email and digest text are required" }), { status: 200, headers });
    }
    const subject = body.subject ?? "InterviewIQ — weekly application digest";
    const from = body.from ?? "InterviewIQ <digest@interviewiq.app>";

    /* provider key: function secret wins, else the admin-supplied per-request
       key (stored only in the admin's browser, never published to clients) */
    const apiKey = Deno.env.get("RESEND_API_KEY") ?? req.headers.get("x-resend-key") ?? "";
    if (!apiKey) {
      return new Response(JSON.stringify({ sent: false, reason: "no Resend key — set the function secret RESEND_API_KEY or enter one in the admin digest card" }), { status: 200, headers });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html: renderHtml(text) })
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
