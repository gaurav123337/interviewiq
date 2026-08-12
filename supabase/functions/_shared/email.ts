/* Minimal provider-swappable email helper. Resend is the first adapter —
   adding another provider means adding a function behind the same
   signature. No key → a clean { sent: false, note } so callers can surface
   the outcome without throwing (the app works fully without email). */

export interface EmailResult {
  sent: boolean;
  note: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  apiKey?: string;
  from?: string;
}): Promise<EmailResult> {
  if (!opts.apiKey) {
    return { sent: false, note: "Email not configured — set RESEND_API_KEY to enable emails." };
  }
  const from = opts.from ?? "InterviewIQ <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, note: `Email failed (${res.status}): ${body.slice(0, 160)}` };
    }
    return { sent: true, note: "Email sent." };
  } catch (e) {
    return { sent: false, note: `Email failed: ${(e as Error).message}` };
  }
}

/** Refund notification — subject/body stay consistent across providers. */
export async function sendRefundEmail(opts: {
  to: string;
  plan: string;
  amountLabel: string;
  reason?: string;
  refundId?: string | null;
  apiKey?: string;
  from?: string;
}): Promise<EmailResult> {
  const plan = opts.plan.charAt(0).toUpperCase() + opts.plan.slice(1);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#0f172a">Your payment was refunded</h2>
      <p style="color:#334155;line-height:1.6">
        Hi, we refunded your <strong>${plan}</strong> purchase of
        <strong>${opts.amountLabel}</strong>${opts.reason ? ` — reason: <em>${opts.reason}</em>` : ""}.
      </p>
      ${opts.refundId ? `<p style="color:#94a3b8;font-size:12px">Refund reference: ${opts.refundId}</p>` : ""}
      <p style="color:#64748b;font-size:13px;line-height:1.6">
        If the money doesn't appear in a few business days, contact your payment provider. Questions about your
        account? Reply to this email.
      </p>
    </div>`;
  return sendEmail({
    to: opts.to,
    subject: `Your ${plan} payment was refunded`,
    html,
    apiKey: opts.apiKey,
    from: opts.from
  });
}
