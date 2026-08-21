import { useState } from "react";
import { cloudFnHeaders, getCloudState } from "../../services/cloud";
import { CONFIG } from "../../config";
import { toast } from "../../toast";
import { btnGhost, btnSm, Modal } from "../ui";
import { applyDigest, weeklyReport } from "../../services/applyTrack";

export function ReportModal({ onClose }: { onClose: () => void }) {
  const r = weeklyReport();
  const maxApplied = Math.max(1, ...r.byWeek.map(w => w.applied));
  const digest = applyDigest();
  const copyDigest = () => {
    navigator.clipboard?.writeText(digest).then(
      () => toast("📋 Digest copied — paste it into your email or notes"),
      () => toast("✗ Clipboard blocked — copy manually")
    );
  };
  const [sending, setSending] = useState(false);
  const mailDigest = async () => {
    const user = getCloudState().user;
    /* real email via the send-apply-digest Edge Function when signed in;
       falls back to a mailto link so the flow always works */
    const fallback = () => {
      const url = `mailto:?subject=${encodeURIComponent("InterviewIQ — weekly application digest")}&body=${encodeURIComponent(digest)}`;
      window.location.href = url;
    };
    if (!user?.email) { fallback(); return; }
    setSending(true);
    try {
      const headers = await cloudFnHeaders();
      const res = await fetch(`${CONFIG.supabase.url}/functions/v1/send-apply-digest`, {
        method: "POST",
        headers,
        body: JSON.stringify({ to: user.email, subject: "InterviewIQ — weekly application digest", text: digest })
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
    <Modal onClose={onClose} title="📊 Weekly report" desc="Your last 7 days of application activity — where the funnel moves, and where it stalls.">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Applied", value: r.applied, tone: "text-acc3" },
          { label: "Interviews", value: r.interviews, tone: "text-ok" },
          { label: "Offers", value: r.offers, tone: "text-ok" },
          { label: "Rejections", value: r.rejections, tone: "text-bad" }
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-line/15 bg-deep/30 p-3 text-center">
            <div className={`text-2xl font-extrabold ${c.tone}`}>{c.value}</div>
            <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-mut">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-line/15 bg-deep/30 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Response rate</div>
          <div className="mt-1 text-xl font-extrabold text-acc1">{r.responseRate}%</div>
          <p className="mt-0.5 text-[11px] text-mut">{r.interviews} of {r.applied} applications advanced to an interview.</p>
        </div>
        <div className="rounded-xl border border-line/15 bg-deep/30 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Pipeline funnel</div>
          <div className="mt-2 space-y-1.5">
            {[
              { label: "Applied", n: r.applied, w: 100 },
              { label: "Interviews", n: r.interviews, w: r.applied ? Math.max(8, (r.interviews / r.applied) * 100) : 0 },
              { label: "Offers", n: r.offers, w: r.applied ? Math.max(4, (r.offers / r.applied) * 100) : 0 }
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="w-[64px] text-[10.5px] font-bold text-mut">{s.label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-deep/40">
                  <div className="flex h-full items-center justify-end rounded bg-acc1/40 px-1" style={{ width: `${s.w}%` }}>
                    <span className="text-[10px] font-extrabold text-acctxt">{s.n}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-line/15 bg-deep/30 p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-mut">Follow-ups</div>
          <div className="mt-1 text-xl font-extrabold">{r.followUpsDone}<span className="text-mut">/{r.followUpsDue + r.followUpsDone} done</span></div>
          <p className="mt-0.5 text-[11px] text-mut">{r.followUpsDue > 0 ? `${r.followUpsDue} still due — use the ✍️ Follow-up drafts on each card.` : "All caught up — nice."}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mut">Applications — last 4 weeks</div>
        <div className="space-y-1.5">
          {r.byWeek.map(w => (
            <div key={w.label} className="flex items-center gap-2">
              <span className="w-16 text-[11px] font-bold text-mut">{w.label}</span>
              <div className="h-5 flex-1 overflow-hidden rounded-md bg-deep/40">
                <div className="flex h-full items-center gap-1 rounded-md bg-acc1/30 px-1.5" style={{ width: `${(w.applied / maxApplied) * 100}%` }}>
                  <span className="text-[10px] font-extrabold text-acctxt">{w.applied}</span>
                </div>
              </div>
              <span className="w-16 text-right text-[10.5px] text-mut">{w.interviews} 📞</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mut">Momentum — last 8 weeks</div>
        <div className="flex h-24 items-end gap-1.5">
          {(() => {
            const max = Math.max(1, ...r.momentum.map(w => w.applied));
            return r.momentum.map(w => (
              <div key={w.label} className="flex flex-1 flex-col items-center gap-1" title={`${w.label}: ${w.applied} applied, ${w.interviews} interviews`}>
                <span className="text-[10px] font-extrabold text-acc1">{w.applied > 0 ? w.applied : ""}</span>
                <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-acc1/40" style={{ height: `${(w.applied / max) * 100}%` }} />
                  <div className="w-1/2 rounded-t bg-ok/50" style={{ height: `${((w.interviews || 0) / max) * 100}%` }} />
                </div>
                <span className="w-full truncate text-center text-[9px] font-bold text-mut">{w.label}</span>
              </div>
            ));
          })()}
        </div>
        <div className="mt-1.5 flex justify-center gap-4 text-[10.5px] text-mut">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-acc1/50" /> Applied</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-ok/60" /> Interviews</span>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-acc1/25 bg-acc1/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-extrabold text-acc1">📬 Weekly digest</p>
          <div className="flex gap-2">
            <button className={btnGhost + btnSm} onClick={copyDigest}>📋 Copy</button>
            <button className={btnGhost + btnSm} onClick={() => void mailDigest()} disabled={sending}>
              {sending ? "⏳ Sending…" : "✉️ Email"}
            </button>
          </div>
        </div>
        <pre className="mt-2 max-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-deep/40 p-3 font-sans text-[11.5px] leading-relaxed text-fnt">{digest}</pre>
        <p className="mt-2 text-[10.5px] text-mut">A weekly summary you can share or email — your numbers, follow-ups, and 8-week momentum.</p>
      </div>

      <button className="mt-5 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
        Done — close
      </button>
    </Modal>
  );
}
