import { useMemo, useState } from "react";
import { cloudFnHeaders, getCloudState } from "../../services/cloud";
import { CONFIG } from "../../config";
import { toast } from "../../toast";
import { btnGhost, btnPrimary, btnSm, Modal } from "../ui";
import { recommendationsDigest, type CompanyRank } from "../../services/jobs";
import type { CareerProfile } from "../../types";

export function RecsDigestModal({ profile, ranks, onClose }: { profile: CareerProfile; ranks: CompanyRank[]; onClose: () => void }) {
  const digest = useMemo(() => recommendationsDigest(profile, ranks), [profile, ranks]);
  const [sending, setSending] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(digest).then(
      () => toast("📋 Digest copied — paste it into your email or notes"),
      () => toast("✗ Clipboard blocked — copy manually")
    );
  };
  const email = async () => {
    const user = getCloudState().user;
    /* real email via the send-apply-digest Edge Function when signed in;
       falls back to a mailto link so the flow always works */
    const fallback = () => {
      const url = `mailto:?subject=${encodeURIComponent("InterviewIQ — weekly company recommendations")}&body=${encodeURIComponent(digest)}`;
      window.location.href = url;
    };
    if (!user?.email) { fallback(); return; }
    setSending(true);
    try {
      const headers = await cloudFnHeaders();
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-apply-digest`, {
        method: "POST",
        headers,
        body: JSON.stringify({ to: user.email, subject: "InterviewIQ — weekly company recommendations", text: digest })
      });
      const body = await res.json().catch(() => ({}));
      if ((body as { sent?: boolean }).sent) {
        toast(`📧 Digest emailed to ${user.email}`);
      } else {
        toast(`✉️ Email not configured (${(body as { reason?: string }).reason ?? "unknown"}) — opening your mail app instead`);
        fallback();
      }
    } catch {
      toast("✉️ Couldn't reach the email service — opening your mail app instead");
      fallback();
    } finally {
      setSending(false);
    }
  };
  return (
    <Modal onClose={onClose} title="📧 Weekly recommendations digest" desc="Your top picks and the biggest learnable gap — copy it, or email it to yourself each week.">
      <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/50 p-4 text-[12.5px] leading-relaxed text-fnt">
        {digest}
      </pre>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className={btnGhost + btnSm} onClick={copy}>📋 Copy</button>
        <button className={btnPrimary + btnSm} onClick={email} disabled={sending}>
          {sending ? "⏳ Sending…" : "📧 Email to me"}
        </button>
      </div>
    </Modal>
  );
}
