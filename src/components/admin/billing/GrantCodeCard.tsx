import { memo, useState } from "react";
import {
  adminCreateGrant, COMPLIMENTARY_PRODUCTS,
  type ComplimentaryProduct
} from "../../../services/entitlement";
import { toast } from "../../../toast";
import { cardCls, btnPrimary, btnGhost, btnSm } from "../../ui";

export const GrantCodeCard = memo(function GrantCodeCard({ busy, setBusy }: { busy: boolean; setBusy: (v: boolean) => void }) {
  const [cProduct, setCProduct] = useState<ComplimentaryProduct>("monthly");
  const [cExpiry, setCExpiry] = useState<"standard" | "lifetime" | "custom">("standard");
  const [cDays, setCDays] = useState(30);
  const [code, setCode] = useState<string>("");
  const selected = COMPLIMENTARY_PRODUCTS.find(product => product.id === cProduct)!;
  const standardDays = selected.defaultDays;
  const grantDays = cExpiry === "custom" ? cDays : cExpiry === "lifetime" ? 0 : standardDays;

  const selectProduct = (product: ComplimentaryProduct) => {
    const next = COMPLIMENTARY_PRODUCTS.find(item => item.id === product)!;
    setCProduct(product);
    setCExpiry(next.defaultDays > 0 ? "standard" : "lifetime");
    if (next.defaultDays > 0) setCDays(next.defaultDays);
  };

  const createCode = async () => {
    setBusy(true);
    try {
      const c = await adminCreateGrant(cProduct, grantDays);
      setCode(c);
      toast("🎁 Gift code created — copy it to your user");
    } catch (e) { toast("✗ " + ((e as Error).message || "Create failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className={`${cardCls} p-5`}>
      <h3 className="text-[14.5px] font-extrabold">🎁 Create a gift code</h3>
      <p className="mb-3 text-[12px] text-mut">Single-use complimentary access. It grants the selected product after sign-in, without checkout or a payment record. Coupons below remain payment discounts.</p>
      <div className="flex flex-wrap items-center gap-2.5">
        <select value={cProduct} onChange={e => selectProduct(e.target.value as ComplimentaryProduct)} className="inp w-44">
          {COMPLIMENTARY_PRODUCTS.map(product => <option key={product.id} value={product.id}>{product.label}</option>)}
        </select>
        <select value={cExpiry} onChange={e => setCExpiry(e.target.value as typeof cExpiry)} className="inp w-40" aria-label="Gift expiry">
          {standardDays > 0 && <option value="standard">Standard ({standardDays} days)</option>}
          <option value="lifetime">No expiry</option>
          <option value="custom">Custom days</option>
        </select>
        {cExpiry === "custom" && (
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-mut">
            days
            <input type="number" min={1} value={cDays} onChange={e => setCDays(Math.max(1, Number(e.target.value) || 1))} className="inp w-20 py-1.5 text-center" />
          </label>
        )}
        <button className={btnPrimary + btnSm} disabled={busy} onClick={createCode}>Create gift code</button>
      </div>
      {code && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-3 py-2">
          <span className="font-mono text-[13px] font-extrabold">{code}</span>
          <span className="text-[11.5px] font-bold text-mut">Gift · {selected.label} · {grantDays ? `${grantDays} days` : "no expiry"}</span>
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
});
