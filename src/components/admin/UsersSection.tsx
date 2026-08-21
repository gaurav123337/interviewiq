/* UsersSection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import { amOwner, grantAdmin, revokeAdmin, type AdminUserRow } from "../../services/admin";
import { adminListEntitlements, type AdminEntitlementRow } from "../../services/entitlement";
import { adminListPayments, adminListSubscriptions, adminBillingActions, fmtMinor, type AdminPaymentRow, type AdminSubscriptionRow, type BillingActionRow } from "../../services/billing";
import { CONFIG } from "../../config";
import { toast } from "../../toast";
import { btnPrimary, btnSm, btnGhost, btnDanger, cardCls, Chip, Modal } from "../ui";

/* ------------------------------------------------------------------ */
/* Users — directory + status + plans + admin grant                    */
/* ------------------------------------------------------------------ */

export function UsersSection({ users, admins, busy, setBusy, onChanged }: {
  users: AdminUserRow[]; admins: string[]; busy: boolean;
  setBusy: (b: boolean) => void; onChanged: () => Promise<void>;
}) {
  const [grantEmail, setGrantEmail] = useState("");
  const [billingUser, setBillingUser] = useState<{ id: string; email: string } | null>(null);
  const owner = amOwner();
  const ownerEmail = (CONFIG.ownerEmail ?? "").toLowerCase();

  const doGrant = async () => {
    if (!grantEmail.trim()) { toast("Enter an email"); return; }
    setBusy(true);
    try { await grantAdmin(grantEmail); toast("✅ Admin granted"); setGrantEmail(""); await onChanged(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const doRevoke = async (email: string) => {
    setBusy(true);
    try { await revokeAdmin(email); toast("Admin revoked"); await onChanged(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const status = (u: AdminUserRow): { label: string; tone: "ok" | "warn" | "default" } => {
    if (!u.last_seen) return { label: "Never", tone: "default" };
    const age = Date.now() - new Date(u.last_seen).getTime();
    if (age < 86_400_000) return { label: "Active today", tone: "ok" };
    if (age < 7 * 86_400_000) return { label: "Active 7d", tone: "warn" };
    return { label: "Inactive", tone: "default" };
  };

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line/10 p-5">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">👥 Users ({users.length})</h2>
          <p className="text-[12.5px] text-mut">Everyone who signed in and synced. Status reflects their last heartbeat.</p>
        </div>
        {owner ? (
          <div className="flex gap-2">
            <input
              value={grantEmail} onChange={e => setGrantEmail(e.target.value)}
              placeholder="admin@example.com"
              className="rounded-xl border border-line/15 bg-deep/80 px-3.5 py-2 text-[13px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
            />
            <button className={btnPrimary + btnSm} onClick={doGrant} disabled={busy}>Grant admin</button>
          </div>
        ) : (
          <Chip tone="warn">🔒 Only the product owner can manage admins</Chip>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line/10 text-[11.5px] uppercase tracking-wider text-mut">
              <th className="px-5 py-3 font-bold">User</th>
              <th className="px-3 py-3 font-bold">Status</th>
              <th className="px-3 py-3 font-bold">Plan</th>
              <th className="px-3 py-3 font-bold">Streak</th>
              <th className="px-3 py-3 font-bold">Sessions</th>
              <th className="px-3 py-3 font-bold">AI calls</th>
              <th className="px-3 py-3 font-bold">Joined</th>
              <th className="px-3 py-3 font-bold">Admin</th>
              <th className="px-5 py-3 font-bold">Billing</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-10 text-center text-mut">No signed-in users yet — when someone creates an account and syncs, they appear here.</td></tr>
            )}
            {users.map(u => {
              const st = status(u);
              const isAdmin = admins.includes(u.email.toLowerCase());
              const isOwner = u.email.toLowerCase() === ownerEmail;
              return (
                <tr key={u.id} className="border-b border-line/5 last:border-0 hover:bg-wht/5">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 font-bold">
                      {isOwner && <span title="Product owner — the only account that can manage admins">👑</span>}
                      {u.email || "—"}
                    </div>
                    <div className="text-[11.5px] text-fnt">last seen {u.last_seen ? new Date(u.last_seen).toLocaleString() : "—"}</div>
                  </td>
                  <td className="px-3 py-3"><Chip tone={st.tone}>{st.label}</Chip></td>
                  <td className="px-3 py-3">
                    <Chip tone={u.tier === "pro" ? "co" : "default"}>{u.tier === "pro" ? "💎 Pro" : "Free"}</Chip>
                  </td>
                  <td className="px-3 py-3 font-bold tabular-nums">{u.streak}</td>
                  <td className="px-3 py-3 tabular-nums">{u.sessions_count}</td>
                  <td className="px-3 py-3 tabular-nums">{u.ai_calls}</td>
                  <td className="px-3 py-3 tabular-nums">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    {isOwner ? (
                      <Chip tone="co">👑 Owner</Chip>
                    ) : isAdmin ? (
                      owner ? (
                        <button className={btnDanger + btnSm} onClick={() => doRevoke(u.email)} disabled={busy}>Revoke</button>
                      ) : (
                        <Chip tone="ok">Admin</Chip>
                      )
                    ) : (
                      <span className="text-fnt">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button className={btnGhost + btnSm} onClick={() => setBillingUser({ id: u.id, email: u.email })} title="Entitlements, payments, subscriptions and audit trail for this user">
                      💰 Billing
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {billingUser && <UserBillingDrawer userId={billingUser.id} email={billingUser.email} onClose={() => setBillingUser(null)} />}
    </div>
  );
}

/* Per-user billing drawer — one account's full billing history */
function UserBillingDrawer({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const [state, setState] = useState<{ entitlements: AdminEntitlementRow[]; payments: AdminPaymentRow[]; subs: AdminSubscriptionRow[]; audit: BillingActionRow[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([adminListEntitlements(), adminListPayments(), adminListSubscriptions(), adminBillingActions(100)])
      .then(([e, p, s, a]) => {
        if (!alive) return;
        setState({
          entitlements: e.filter(r => r.userId === userId),
          payments: p.filter(r => r.userId === userId),
          subs: s.filter(r => r.userId === userId),
          audit: a.filter(r => r.userId === userId)
        });
      })
      .catch(() => { if (alive) setState({ entitlements: [], payments: [], subs: [], audit: [] }); });
    return () => { alive = false; };
  }, [userId]);

  const ent = state?.entitlements[0];
  return (
    <Modal onClose={onClose} title={`💰 Billing — ${email}`} desc="Entitlement, payments, subscriptions and the audit trail for this account.">
      {!state ? (
        <p className="py-6 text-center text-mut">Loading billing history…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Entitlement</div>
            {ent ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 p-3 text-[12.5px]">
                <Chip tone={ent.active ? "ok" : "default"}>{ent.active ? "💎 Pro active" : "free"}</Chip>
                {ent.plan && <Chip>{ent.plan}</Chip>}
                <span className="text-fnt">expires {ent.expiresAt ? new Date(ent.expiresAt).toLocaleDateString() : "never"}</span>
                {ent.source && <Chip tone="lvl">via {ent.source}</Chip>}
                {ent.discountPct > 0 && <Chip tone="lvl">−{ent.discountPct}%</Chip>}
              </div>
            ) : <p className="text-[12.5px] text-fnt">No entitlement row — this account has never been granted Pro.</p>}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Payments ({state.payments.length})</div>
            {state.payments.length === 0 ? (
              <p className="text-[12.5px] text-fnt">No confirmed payments.</p>
            ) : (
              <div className="space-y-1.5">
                {state.payments.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                    <Chip tone={p.status === "paid" ? "ok" : "warn"}>{p.status}</Chip>
                    <span className="font-bold capitalize">{p.plan}</span>
                    <span className="font-bold tabular-nums">{fmtMinor(p.amountMinor, p.currency)}</span>
                    {p.discountPct > 0 && <Chip tone="lvl">−{p.discountPct}%</Chip>}
                    {p.kind === "subscription" && <Chip tone="lvl">🔁 sub</Chip>}
                    <span className="ml-auto text-[11px] text-fnt">{new Date(p.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Subscriptions ({state.subs.length})</div>
            {state.subs.length === 0 ? (
              <p className="text-[12.5px] text-fnt">No provider subscriptions.</p>
            ) : (
              <div className="space-y-1.5">
                {state.subs.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                    <Chip tone={s.status === "active" ? "ok" : s.status === "cancelled" ? "warn" : "bad"}>{s.status}</Chip>
                    <span className="font-bold capitalize">{s.plan}</span>
                    <span className="text-fnt">{s.provider}</span>
                    <span className="ml-auto text-[11px] text-fnt">next billing {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Audit trail ({state.audit.length})</div>
            {state.audit.length === 0 ? (
              <p className="text-[12.5px] text-fnt">No billing actions for this account.</p>
            ) : (
              <div className="max-h-[200px] space-y-1.5 overflow-y-auto">
                {state.audit.map((a, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
                    <Chip tone={a.action === "purchase" ? "ok" : a.action === "revoke" ? "bad" : "default"}>{a.action}</Chip>
                    {a.detail && <span className="font-mono text-[11px] text-fnt">{JSON.stringify(a.detail).slice(0, 100)}</span>}
                    <span className="ml-auto text-[11px] text-fnt">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
