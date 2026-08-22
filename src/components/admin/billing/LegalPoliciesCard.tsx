import { memo, useState, useEffect } from "react";
import { getPublishedPolicies, publishPolicies } from "../../../services/policies";
import { POLICY_DEFAULTS, POLICY_META, type PolicyId } from "../../../data/policies";
import { toast } from "../../../toast";
import { cardCls, btnPrimary, btnSm } from "../../ui";

export const LegalPoliciesCard = memo(function LegalPoliciesCard({ busy }: { busy: boolean }) {
  const [policyDocs, setPolicyDocs] = useState<Record<PolicyId, string>>({ ...POLICY_DEFAULTS });

  useEffect(() => {
    void getPublishedPolicies().then(p => { if (Object.keys(p).length) setPolicyDocs({ ...POLICY_DEFAULTS, ...p }); }).catch(() => {});
  }, []);

  const savePolicies = async () => {
    try {
      await publishPolicies(policyDocs);
      toast("⚖️ Legal pages published");
    } catch (e) { toast("✗ " + ((e as Error).message || "Publish failed")); }
  };

  return (
    <div className={`${cardCls} overflow-hidden`}>
        <div className="border-b border-line/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14.5px] font-extrabold">⚖️ Legal &amp; Policies</h3>
            <span className="text-[11.5px] font-bold text-ok">✓ 4/4 published</span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-fnt">Terms, Privacy, Refund &amp; Cancellation and Shipping are the pages payment providers require before international payments can be enabled. Edit the templates and publish — no deploy. The public site shows these at the landing footer → Terms / Privacy / Refunds / Shipping.</p>
        </div>
        <div className="grid gap-4 p-5">
          {POLICY_META.map(m => (
            <div key={m.id} className="rounded-xl border border-line/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-extrabold">{m.icon} {m.title}</span>
                <button
                  className="rounded-lg border border-line/15 bg-wht/10 px-2.5 py-1 text-[11px] font-bold text-mut transition-all hover:bg-wht/20 hover:text-ink"
                  onClick={() => setPolicyDocs(d => ({ ...d, [m.id]: POLICY_DEFAULTS[m.id] }))}
                >↺ Reset to default</button>
              </div>
              <textarea
                className="inp mt-2 h-40 w-full resize-y font-mono text-[12px] leading-relaxed"
                value={policyDocs[m.id]}
                onChange={e => setPolicyDocs(d => ({ ...d, [m.id]: e.target.value }))}
              />
              <p className="mt-1 text-[10.5px] text-mut">Placeholders {"{{company}}"}, {"{{url}}"} and {"{{email}}"} are filled automatically on the public page.</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
          <span className="text-[11.5px] text-fnt">Live at https://gaurav123337.github.io/interviewiq — footer → Terms / Privacy / Refunds / Shipping.</span>
          <button className={btnPrimary + btnSm} onClick={savePolicies} disabled={busy}>⚖️ Publish legal pages</button>
        </div>
      </div>

  );
});
