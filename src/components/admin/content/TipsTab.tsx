import { type TipConfig, fetchTips, saveTips } from '../../../services/contentService';
import { useState, useEffect } from 'react';
import { toast } from '../../../toast';
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from '../../ui';

export function TipsTab() {
  const [config, setConfig] = useState<TipConfig>({ id: "default", amounts: [5, 15, 30], labels: ["☕ Coffee", "🍕 Lunch", "🎉 Celebration"], descriptions: ["Buy me a coffee", "Buy me lunch", "Celebrating a new offer?"], stripe_link: "", buymeacoffee_link: "", enabled: true });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchTips().then(t => { setConfig(t); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const updateAmount = (idx: number, val: number) => {
    const next = { ...config, amounts: [...config.amounts] };
    next.amounts[idx] = Math.max(1, val);
    setConfig(next);
  };
  const updateLabel = (idx: number, val: string) => {
    const next = { ...config, labels: [...config.labels] };
    next.labels[idx] = val;
    setConfig(next);
  };
  const updateDesc = (idx: number, val: string) => {
    const next = { ...config, descriptions: [...config.descriptions] };
    next.descriptions[idx] = val;
    setConfig(next);
  };
  const addTier = () => setConfig({ ...config, amounts: [...config.amounts, 50], labels: [...config.labels, "🎁 Gift"], descriptions: [...config.descriptions, "Buy me a gift"] });
  const removeTier = (idx: number) => {
    if (config.amounts.length <= 1) { toast("Need at least one tier"); return; }
    setConfig({ ...config, amounts: config.amounts.filter((_, i) => i !== idx), labels: config.labels.filter((_, i) => i !== idx), descriptions: config.descriptions.filter((_, i) => i !== idx) });
  };

  const saveConfig = async () => {
    setBusy(true);
    try { await saveTips(config); toast("💾 Tip jar config saved to database"); }
    catch (e) { toast("✗ " + ((e as Error).message || "Save failed")); }
    setBusy(false);
  };

  if (loading) return <div className="text-center text-mut py-8"><span className="spinner inline-block" /> Loading…</div>;

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-extrabold">❤️ Tip Jar Settings</h3>
            <p className="mt-0.5 text-[12px] text-mut">Configure the support section. Data stored in Supabase.</p>
          </div>
          <button className={btnPrimary + btnSm} onClick={() => void saveConfig()} disabled={busy}>💾 Save config</button>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[13px] font-extrabold">💰 Tip tiers</h4>
          <button className={btnOk + btnSm} onClick={addTier}>+ Add tier</button>
        </div>
        <div className="space-y-3">
          {config.amounts.map((amt, i) => (
            <div key={i} className="rounded-xl border border-line/10 bg-deep/40 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-acc1/10 text-[16px]">{config.labels[i]?.split(" ")[0] ?? "💰"}</span>
                <label className="text-[12px] font-bold text-mut">$</label>
                <input type="number" min={1} className="inp w-16 sm:w-20 py-1.5 text-center" value={amt} onChange={e => updateAmount(i, Number(e.target.value) || 5)} />
                <input className="inp min-w-0 flex-1 py-1.5" value={config.labels[i] ?? ""} onChange={e => updateLabel(i, e.target.value)} placeholder="☕ Coffee" />
                <button className={btnDanger + btnSm} onClick={() => removeTier(i)}>✕</button>
              </div>
              <input className="inp mt-2 w-full py-1.5" value={config.descriptions[i] ?? ""} onChange={e => updateDesc(i, e.target.value)} placeholder="Buy me a coffee" />
            </div>
          ))}
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h4 className="text-[13px] font-extrabold mb-3">🔗 Payment links</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Stripe payment link</span>
            <input className="inp" value={config.stripe_link} onChange={e => setConfig({ ...config, stripe_link: e.target.value })} placeholder="https://buy.stripe.com/..." />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Buy Me a Coffee link</span>
            <input className="inp" value={config.buymeacoffee_link} onChange={e => setConfig({ ...config, buymeacoffee_link: e.target.value })} placeholder="https://buymeacoffee.com/..." />
          </label>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-2 text-[12px] font-bold text-mut">
            <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />
            Show tip jar on landing page
          </label>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <h4 className="text-[13px] font-extrabold mb-3">👀 Preview</h4>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {config.amounts.map((amt, i) => (
            <div key={i} className="rounded-xl border border-line/20 bg-wht/10 px-5 py-3 text-center">
              <div className="text-[20px]">{config.labels[i]?.split(" ")[0] ?? "💰"}</div>
              <div className="mt-1 text-[13px] font-extrabold">${amt}</div>
              <div className="text-[11px] text-mut">{config.descriptions[i]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BannersTab — visual banner editor with image upload                  */
/* ------------------------------------------------------------------ */

