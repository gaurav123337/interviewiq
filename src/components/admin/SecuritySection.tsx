/* SecuritySection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import { amOwner, adminSecurityStatus, adminAuditLog, adminSetMfaEnforced, type AdminSecurityStatus, type AdminAuditRow } from "../../services/admin";
import { toast } from "../../toast";
import { btnGhost, btnSm, cardCls, Chip, Switch } from "../ui";

/* ------------------------------------------------------------------ */
/* Security — MFA enforcement (owner-only) + admin audit log           */
/* ------------------------------------------------------------------ */

export function SecuritySection() {
  const [status, setStatus] = useState<AdminSecurityStatus | null>(null);
  const [audit, setAudit] = useState<AdminAuditRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [showMeta, setShowMeta] = useState<number | null>(null);
  const owner = amOwner();

  const load = async () => {
    setBusy(true);
    try {
      const [s, a] = await Promise.all([adminSecurityStatus(), adminAuditLog(50)]);
      setStatus(s);
      setAudit(a);
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load security status"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggle = async (v: boolean) => {
    if (!owner) { toast("Only the owner can change MFA enforcement"); return; }
    setToggleBusy(true);
    try {
      await adminSetMfaEnforced(v);
      toast(v ? "🔐 MFA now required for admin actions" : "🔓 MFA enforcement turned off");
      await load();
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Couldn't update"));
    } finally {
      setToggleBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* MFA enforcement */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-extrabold">🔐 Admin MFA enforcement</h2>
            <p className="mt-1 max-w-[640px] text-[12.5px] text-mut">
              When on, sensitive admin actions (granting/revoking admins, config changes) require a session
              authenticated with the account's authenticator app. <span className="font-bold">Owner-only control.</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={status?.enforced ?? false} onChange={toggle} />
            {toggleBusy && <span className="spinner" />}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone={status?.enforced ? "warn" : "ok"}>
            {status?.enforced ? "MFA REQUIRED" : "NOT enforced — password-only sessions OK"}
          </Chip>
          <Chip tone={status?.mfaVerified ? "ok" : "default"}>
            {status?.mfaVerified
              ? "✅ This session is MFA-verified"
              : "⚠️ This session has no TOTP — flip enforcement before signing out"}
          </Chip>
          {(status?.factors?.length ?? 0) > 0 && (
            <Chip>{status!.factors.length} authenticator factor{(status!.factors.length === 1 ? "" : "s")} enrolled</Chip>
          )}
        </div>
        {!status && busy && <p className="mt-3 text-[12px] text-mut"><span className="spinner inline-block" /> Loading…</p>}
        {!status && !busy && (
          <p className="mt-3 text-[12px] text-mut">
            Status unavailable — apply <code className="font-mono">supabase/security.sql</code> (via scripts/setup-security.js) to enable this card.
          </p>
        )}
      </div>

      {/* audit log */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-extrabold">🧾 Admin audit log</h2>
            <p className="mt-0.5 text-[12.5px] text-mut">
              Append-only trail of config, announcement and admin changes, kept by DB triggers.
            </p>
          </div>
          <button className={btnGhost + btnSm} onClick={() => void load()} disabled={busy}>Refresh</button>
        </div>
        {audit.length === 0 ? (
          <p className="px-5 pb-5 text-[12.5px] text-mut">
            No entries yet — they appear after you publish config, post announcements or change admins
            (requires supabase/security.sql).
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-panel text-[11px] uppercase tracking-wider text-fnt">
                <tr>
                  <th className="px-5 py-2">When</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-5 py-2">Meta</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((r, i) => (
                  <tr key={i} className="border-t border-line/10">
                    <td className="whitespace-nowrap px-5 py-2 text-fnt">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{r.actor}</td>
                    <td className="px-3 py-2">
                      <Chip tone={r.action === "delete" ? "warn" : r.action === "create" ? "ok" : "default"}>{r.action}</Chip>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11.5px]">{r.target}</td>
                    <td className="px-5 py-2">
                      <button className="font-bold text-acctxt underline" onClick={() => setShowMeta(showMeta === i ? null : i)}>
                        {showMeta === i ? "hide" : "view"}
                      </button>
                      {showMeta === i && (
                        <pre className="mt-1 max-w-[520px] overflow-auto rounded-lg bg-deep/60 p-2 font-mono text-[10.5px] text-fnt">
                          {JSON.stringify(r.meta, null, 2).slice(0, 2000)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
