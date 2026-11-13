import { useCallback, useEffect, useState } from "react";
import { createPairingCode, listAgentBindings, revokeAgentBinding, type ApplyAgentBinding, type PairingCode } from "../../services/applyAgent";
import { btnDanger, btnGhost, btnPrimary, btnSm, Chip } from "../ui";

export default function ApplyAgentPanel({ canPair }: { canPair: boolean }) {
  const [bindings, setBindings] = useState<ApplyAgentBinding[] | null>(null);
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setBindings(await listAgentBindings()); }
    catch (e) { setError(e instanceof Error ? e.message : "Agent service unavailable"); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!pairing) return;
    const timer = setTimeout(() => setPairing(null), Math.max(0, +new Date(pairing.expires_at) - Date.now()));
    return () => clearTimeout(timer);
  }, [pairing]);

  const create = async () => {
    setBusy(true); setError(null);
    try { setPairing(await createPairingCode()); }
    catch (e) { setError(e instanceof Error ? e.message : "Pairing unavailable"); }
    finally { setBusy(false); }
  };
  const revoke = async (id: string) => {
    setBusy(true); setError(null);
    try { await revokeAgentBinding(id); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Revocation failed"); }
    finally { setBusy(false); }
  };

  return (
    <section className="mt-4 rounded-xl border border-line/10 bg-deep/40 p-4" aria-label="Personal agent">
      <h4 className="text-[14px] font-bold">🔗 Your personal agent</h4>
      <p className="mt-1 text-[12px] text-fnt">Pair your local runner with this account. It gets a revocable token—not the project service key. Browser sessions and reports stay in its private local directory.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={btnPrimary + btnSm} disabled={busy || !canPair} onClick={() => void create()}>Create pairing code</button>
        <button className={btnGhost + btnSm} disabled={busy} onClick={() => void refresh()}>Refresh agents</button>
      </div>
      {!canPair && <p className="mt-2 text-[12px] text-mut">An active auto-apply grant is required to pair or run. You can still revoke existing agents.</p>}
      {pairing && (
        <div className="mt-3 space-y-2 rounded-lg border border-ok/30 bg-ok/10 p-3 text-[12px]">
          <p>Run <code>npm run apply:pair</code> locally and paste this single-use code at its prompt:</p>
          <code className="block break-all font-mono font-bold">{pairing.code}</code>
          <p>Expires {new Date(pairing.expires_at).toLocaleTimeString()}. Do not share it or paste it into chat.</p>
          <button className={btnGhost + btnSm} onClick={() => void navigator.clipboard.writeText(pairing.code).catch(() => setError("Clipboard unavailable; select the code to copy."))}>Copy pairing code</button>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-[12px] text-red-400">{error}</p>}
      <div className="mt-3 space-y-2">
        {bindings?.length === 0 && <p className="text-[12px] text-mut">No paired agents yet.</p>}
        {bindings?.map(binding => (
          <div key={binding.binding_id} className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-semibold">{binding.label}</span>
            <Chip tone={binding.revoked_at ? "default" : "ok"}>{binding.revoked_at ? "revoked" : "paired"}</Chip>
            <span className="text-mut">{binding.last_used_at ? `Last used ${new Date(binding.last_used_at).toLocaleString()}` : "Not used yet"}</span>
            {!binding.revoked_at && <button className={btnDanger + btnSm} disabled={busy} onClick={() => void revoke(binding.binding_id)}>Revoke agent</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
