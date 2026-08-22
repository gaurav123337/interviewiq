import { useState, useEffect } from "react";
import { REFUND_POLICY_DEFAULTS, publishRefundPolicy, getRefundPolicy, type RefundPolicy } from "../../../services/billing";
import { toast } from "../../../toast";
import { cardCls, btnPrimary, btnSm } from "../../ui";

export function RefundPolicyCard({ busy }: { busy: boolean }) {
  const [policyDraft, setPolicyDraft] = useState<RefundPolicy>({ ...REFUND_POLICY_DEFAULTS });
  const [presetsText, setPresetsText] = useState((REFUND_POLICY_DEFAULTS.reason_presets ?? []).join(", "));

  useEffect(() => {
    void getRefundPolicy().then(p => { setPolicyDraft(p); setPresetsText((p.reason_presets ?? []).join(", ")); }).catch(() => {});
  }, []);

  const savePolicy = async () => {
    try {
      const next: RefundPolicy = {
        grace_days: Math.max(0, Number(policyDraft.grace_days) || 0),
        max_refunds_per_user: Math.max(0, Number(policyDraft.max_refunds_per_user) || 0),
        reason_presets: presetsText.split(",").map(s => s.trim()).filter(Boolean)
      };
      await publishRefundPolicy(next);
      setPolicyDraft(next);
      toast("📋 Refund policy published");
    } catch (e) { toast("✗ " + ((e as Error).message || "Publish failed")); }
  };

  return (
    <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <h3 className="text-[14.5px] font-extrabold">📋 Refund policy</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Purchases inside the grace window always refund; outside it, a per-user refund cap applies unless the admin overrides. pay-refund enforces this server-side — no deploy needed.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Grace window (days)</span>
            <input type="number" min={0} className="inp" value={policyDraft.grace_days ?? 0} onChange={e => setPolicyDraft({ ...policyDraft, grace_days: Number(e.target.value) || 0 })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Max refunds per user</span>
            <input type="number" min={0} className="inp" value={policyDraft.max_refunds_per_user ?? 0} onChange={e => setPolicyDraft({ ...policyDraft, max_refunds_per_user: Number(e.target.value) || 0 })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Reason presets (comma-separated)</span>
            <input className="inp" value={presetsText} onChange={e => setPresetsText(e.target.value)} placeholder="Duplicate purchase, Requested by user, …" />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
          <span className="text-[11.5px] text-fnt">0 = unlimited. Presets appear as a picker in the refund form.</span>
          <button className={btnPrimary + btnSm} onClick={savePolicy} disabled={busy}>📋 Publish policy</button>
        </div>
      </div>

  );
}
