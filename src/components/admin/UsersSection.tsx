/* UsersSection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import { amOwner, grantAdmin, revokeAdmin, type AdminUserRow } from "../../services/admin";
import { adminListEntitlements, adminSetEntitlement, type AdminEntitlementRow } from "../../services/entitlement";
import { listUserNotifyBindings, clearUserNotifyBinding, getUserActivity, type UserActivity } from "../../services/jobSites";
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
  const [activityUser, setActivityUser] = useState<{ id: string; email: string } | null>(null);
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<AdminEntitlementRow[]>([]);
  const owner = amOwner();
  const ownerEmail = (CONFIG.ownerEmail ?? "").toLowerCase();

  /* entitlement plans feed the lifetime-preserve logic in changePlan */
  useEffect(() => { void adminListEntitlements().then(setEntitlements).catch(() => setEntitlements([])); }, []);

  /* per-row plan editor: the admin changes any user's tier inline —
     server RPC re-gates admin + writes the audit trail */
  const changePlan = async (u: AdminUserRow, tier: "free" | "pro" | "platinum") => {
    if (u.tier === tier) return;
    setPlanBusy(u.id);
    try {
      /* lifetime keeps its plan; dated plans map to monthly with a 30d expiry;
         free clears plan+expiry (admin_set_entitlement handles the row) */
      const current = entitlements.find(e => e.userId === u.id);
      const keepLifetime = tier !== "free" && current?.plan === "lifetime";
      await adminSetEntitlement(u.id, tier, keepLifetime ? "lifetime" : tier === "free" ? null : "monthly", tier === "free" ? null : keepLifetime ? null : new Date(Date.now() + 30 * 86_400_000).toISOString());
      toast(`✅ ${u.email} → ${tier}`);
      await onChanged();
    } catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setPlanBusy(null); }
  };

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
                    {planBusy === u.id ? (
                      <span className="text-[11px] text-mut">…</span>
                    ) : (
                      <select
                        value={u.tier}
                        onChange={e => void changePlan(u, e.target.value as "free" | "pro" | "platinum")}
                        title="Change this user's plan — server-gated, audited"
                        className="rounded-lg border border-line/15 bg-deep/80 px-2 py-1 text-[11.5px] font-bold text-fnt focus:border-acc1/80 focus:outline-none"
                      >
                        <option value="free">Free</option>
                        <option value="pro">💎 Pro</option>
                        <option value="platinum">👑 Platinum</option>
                      </select>
                    )}
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
                    <div className="flex gap-1.5">
                      <button className={btnGhost + btnSm} onClick={() => setActivityUser({ id: u.id, email: u.email })} title="Usage timeline, engine history and Telegram binding for this user">
                        📊 Activity
                      </button>
                      <button className={btnGhost + btnSm} onClick={() => setBillingUser({ id: u.id, email: u.email })} title="Entitlements, payments, subscriptions and audit trail for this user">
                        💰 Billing
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {billingUser && <UserBillingDrawer userId={billingUser.id} email={billingUser.email} onClose={() => setBillingUser(null)} />}
      {activityUser && <UserActivityDrawer userId={activityUser.id} email={activityUser.email} onClose={() => setActivityUser(null)} />}
    </div>
  );
}

/* Per-user activity drawer — usage timeline, the shared engine's recent
   decisions (apply_results carry no user_id: the local engine runs as the
   owner) and this user's Telegram binding. */
function UserActivityDrawer({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const [state, setState] = useState<UserActivity | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getUserActivity(userId)
      .then(a => { if (alive) setState(a); })
      .catch(e => { if (alive) { setErr((e as Error).message); setState({ usage: [], applyRows: [], reviewRows: [], notify: null }); } });
    return () => { alive = false; };
  }, [userId]);

  const counts = state ? {
    events: state.usage.length,
    engine: state.applyRows.length,
    queue: state.reviewRows.length,
  } : null;

  return (
    <Modal onClose={onClose} title={`📊 Activity — ${email}`} desc="Usage timeline, the apply engine's recent decisions and this account's Telegram binding.">
      {err && <div className="rounded bg-red-500/10 px-3 py-2 text-[12px] text-red-400">{err}</div>}
      {!state ? (
        <p className="py-6 text-center text-mut">Loading activity…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-[12px]">
            <Chip tone="lvl">{counts?.events ?? 0} usage events</Chip>
            <Chip tone="lvl">engine: {counts?.engine ?? 0} recent rows</Chip>
            <Chip tone="lvl">queue: {counts?.queue ?? 0} rows</Chip>
            <Chip tone={state.notify ? "ok" : "default"}>{state.notify ? `🔔 bound · chat ${state.notify.chat_id}` : "🔔 not bound"}</Chip>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Usage timeline (newest first)</div>
            {state.usage.length === 0 ? <p className="text-[12.5px] text-fnt">No usage events yet.</p> : (
              <div className="max-h-[180px] space-y-1 overflow-y-auto">
                {state.usage.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-2.5 py-1.5 text-[12px]">
                    <Chip>{e.kind}</Chip>
                    {e.meta && Object.keys(e.meta).length > 0 && <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-fnt">{JSON.stringify(e.meta).slice(0, 90)}</span>}
                    <span className="ml-auto shrink-0 text-[10.5px] text-fnt">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Apply engine — recent decisions (shared, runs on the owner's machine)</div>
            {state.applyRows.length === 0 ? <p className="text-[12.5px] text-fnt">No engine runs recorded yet.</p> : (
              <div className="max-h-[200px] space-y-1 overflow-y-auto">
                {state.applyRows.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-2.5 py-1.5 text-[12px]">
                    <Chip tone={r.result === "submitted" ? "ok" : r.result === "error" ? "bad" : r.result === "needs_review" ? "warn" : "default"}>{r.result}</Chip>
                    <span className="min-w-0 flex-1 truncate">{r.title || r.job_url}{r.company ? ` — ${r.company}` : ""}</span>
                    {r.fit != null && <Chip tone="lvl">fit {r.fit}</Chip>}
                    <span className="ml-auto shrink-0 text-[10.5px] text-fnt">{r.site_host} · {new Date(r.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mut">Review queue (all rows)</div>
            {state.reviewRows.length === 0 ? <p className="text-[12.5px] text-fnt">Queue is empty.</p> : (
              <div className="max-h-[160px] space-y-1 overflow-y-auto">
                {state.reviewRows.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/10 bg-deep/40 px-2.5 py-1.5 text-[12px]">
                    <Chip tone={r.status === "pending" ? "warn" : r.status === "done" ? "ok" : "default"}>{r.status}</Chip>
                    <span className="min-w-0 flex-1 truncate">{r.title || r.job_url}</span>
                    <span className="ml-auto shrink-0 text-[10.5px] text-fnt">{new Date(r.created_at).toLocaleString()}</span>
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

/* 🔔 Per-user Telegram bindings (admin view): who bound which bot/chat,
   with a clear action — the engine only pings ENTITLED users' rows, but
   the admin can still revoke a binding outright (lost phone, dispute). */
export function NotifyBindingsCard() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listUserNotifyBindings>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => {
    setErr(null);
    listUserNotifyBindings().then(setRows).catch(e => { setErr((e as Error).message); setRows([]); });
  };
  useEffect(refresh, []);

  const clear = async (userId: string, email: string | null) => {
    setBusy(userId);
    try { await clearUserNotifyBinding(userId); toast("Binding cleared"); refresh(); }
    catch (e) { toast("✗ " + ((e as Error).message || "Failed")); }
    finally { setBusy(null); }
  };

  return (
    <div className={`${cardCls} mt-5 overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line/10 p-5">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">🔔 Telegram bindings ({rows?.length ?? 0})</h2>
          <p className="text-[12.5px] text-mut">Per-user pings are Platinum/auto-apply-gated; the engine pings the newest entitled binding. Clearing removes the row.</p>
        </div>
        <button className={btnGhost + btnSm} onClick={refresh}>↻ refresh</button>
      </div>
      {err && <div className="mx-5 mt-3 rounded bg-red-500/10 px-3 py-2 text-[12px] text-red-400">{err}</div>}
      <div className="space-y-1.5 p-5">
        {rows === null && <p className="text-[12.5px] text-mut">Loading bindings…</p>}
        {rows?.length === 0 && <p className="text-[12.5px] text-mut">No user has bound Telegram yet.</p>}
        {rows?.map(r => (
          <div key={r.user_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line/10 bg-deep/40 px-3 py-2 text-[12.5px]">
            <span className="font-bold">{r.email || "(no profile)"}</span>
            <Chip>chat {r.chat_id ?? "—"}</Chip>
            <Chip tone="lvl">token {r.token_prefix ?? "—"}…</Chip>
            <span className="ml-auto text-[11px] text-fnt">{r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}</span>
            {busy === r.user_id ? <span className="text-[11px] text-mut">…</span> : (
              <button className={btnDanger + btnSm} onClick={() => void clear(r.user_id, r.email)} title="Delete this binding — the user can re-bind from their review queue">Clear</button>
            )}
          </div>
        ))}
      </div>
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
