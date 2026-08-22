import { useState } from "react";
import { PLANS } from "../../../services/entitlement";
import { adminCreateGrant } from "../../../services/entitlement";
import { toast } from "../../../toast";
import { cardCls, btnPrimary, btnGhost, btnSm } from "../../ui";

export function GrantCodeCard({ busy, setBusy, load }: { busy: boolean; setBusy: (v: boolean) => void; load: () => void }) {
  const [cPlan, setCPlan] = useState<string>("monthly");
  const [cDays, setCDays] = useState(30);
  const [cPct, setCPct] = useState(0);
  const [code, setCode] = useState<string>("");

  const createCode = async () => {
    setBusy(true);
    try {
      const c = await adminCreateGrant(cPlan, cDays, cPct);
      setCode(c);
      toast("🎟️ Grant code created — copy it to your user");
    } catch (e) { toast("✗ " + ((e as Error).message || "Create failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className={`${cardCls} p-5`}>
        <h3 className="text-[14.5px] font-extrabold">🎟️ Create a grant code</h3>
        <p className="mb-3 text-[12px] text-mut">Single-use, server-verified. The user signs in and redeems it in Settings — no storefront needed.</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <select value={cPlan} onChange={e => setCPlan(e.target.value)} className="inp w-32">
            {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            days
            <input type="number" min={1} value={cDays} onChange={e => setCDays(Math.max(1, Number(e.target.value) || 30))} className="inp w-20 py-1.5 text-center" />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            −% off
            <input type="number" min={0} max={100} value={cPct} onChange={e => setCPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="inp w-20 py-1.5 text-center" />
          </label>
          <button className={btnPrimary + btnSm} disabled={busy} onClick={createCode}>Create code</button>
        </div>
        {code && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2">
            <span className="font-mono text-[13px] font-extrabold">{code}</span>
            <button
              className={btnGhost + btnSm}
              onClick={() => { navigator.clipboard?.writeText(code).then(() => toast("📋 Copied"), () => {}); }}
            >
              Copy
            </button>
            <button className={btnGhost + btnSm} onClick={() => setCode("")}>✕</button>
          </div>
        )}
      </div>

  );
}
