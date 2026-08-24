/* AICostSection — Admin dashboard for AI cost monitoring.
   Shows cost breakdown by module, model, cache hit rate, and daily spend.
   Uses the ai_cost_log and ai_response_cache tables. */

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../services/cloud";
import { cardCls } from "../ui";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface CostSummary {
  totalCost: number;
  totalCalls: number;
  cachedCalls: number;
  cacheHitRate: number;
  avgLatencyMs: number;
}

interface ModuleCost {
  module: string;
  calls: number;
  cost: number;
  cached: number;
}

interface ModelCost {
  model: string;
  calls: number;
  cost: number;
  avgTokens: number;
}

interface DailyCost {
  date: string;
  cost: number;
  calls: number;
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  avgHitCount: number;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export function AICostSection({ busy: _busy, setBusy: _setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [byModule, setByModule] = useState<ModuleCost[]>([]);
  const [byModel, setByModel] = useState<ModelCost[]>([]);
  const [daily, setDaily] = useState<DailyCost[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const client = await getSupabaseClient();
        if (!client) { setError("Not connected"); setLoading(false); return; }

        const since = new Date(Date.now() - days * 86400_000).toISOString();

        // Parallel queries
        const [costResult, cacheResult] = await Promise.all([
          client.from("ai_cost_log").select("module, model, input_tokens, output_tokens, estimated_cost, cached, latency_ms, created_at").gte("created_at", since),
          client.from("ai_response_cache").select("hit_count, module"),
        ]);

        if (cancelled) return;

        const rows = (costResult.data ?? []) as Array<{
          module: string; model: string; input_tokens: number; output_tokens: number;
          estimated_cost: number; cached: boolean; latency_ms: number; created_at: string;
        }>;

        // Summary
        const totalCost = rows.reduce((s, r) => s + (r.estimated_cost || 0), 0);
        const totalCalls = rows.length;
        const cachedCalls = rows.filter((r) => r.cached).length;
        const cacheHitRate = totalCalls > 0 ? (cachedCalls / totalCalls) * 100 : 0;
        const avgLatencyMs = totalCalls > 0 ? rows.reduce((s, r) => s + (r.latency_ms || 0), 0) / totalCalls : 0;

        setSummary({ totalCost, totalCalls, cachedCalls, cacheHitRate, avgLatencyMs });

        // By module
        const modMap = new Map<string, ModuleCost>();
        for (const r of rows) {
          const existing = modMap.get(r.module) ?? { module: r.module, calls: 0, cost: 0, cached: 0 };
          existing.calls++;
          existing.cost += r.estimated_cost || 0;
          if (r.cached) existing.cached++;
          modMap.set(r.module, existing);
        }
        setByModule([...modMap.values()].sort((a, b) => b.cost - a.cost));

        // By model
        const modelMap = new Map<string, ModelCost>();
        for (const r of rows) {
          const existing = modelMap.get(r.model) ?? { model: r.model, calls: 0, cost: 0, avgTokens: 0 };
          existing.calls++;
          existing.cost += r.estimated_cost || 0;
          existing.avgTokens += (r.input_tokens || 0) + (r.output_tokens || 0);
          modelMap.set(r.model, existing);
        }
        const modelArr = [...modelMap.values()].map((m) => ({ ...m, avgTokens: m.calls > 0 ? Math.round(m.avgTokens / m.calls) : 0 }));
        setByModel(modelArr.sort((a, b) => b.cost - a.cost));

        // Daily
        const dayMap = new Map<string, DailyCost>();
        for (const r of rows) {
          const date = r.created_at.slice(0, 10);
          const existing = dayMap.get(date) ?? { date, cost: 0, calls: 0 };
          existing.cost += r.estimated_cost || 0;
          existing.calls++;
          dayMap.set(date, existing);
        }
        setDaily([...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)));

        // Cache stats
        const cacheRows = (cacheResult.data ?? []) as Array<{ hit_count: number; module: string }>;
        const totalEntries = cacheRows.length;
        const totalHits = cacheRows.reduce((s, r) => s + (r.hit_count || 0), 0);
        const avgHitCount = totalEntries > 0 ? totalHits / totalEntries : 0;
        setCacheStats({ totalEntries, totalHits, avgHitCount });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mb-3 text-[28px] animate-pulse">⏳</div>
          <p className="text-[13px] text-mut">Loading AI cost data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardCls} mx-auto max-w-[500px] p-8 text-center`}>
        <p className="text-[22px]">⚠️</p>
        <p className="mt-2 text-[14px] text-err">{error}</p>
        <p className="mt-1 text-[12px] text-mut">Run the ai-cost-controls.sql migration first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">🤖 AI Cost Monitor</h2>
        <div className="flex gap-1">
          {[3, 7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1 text-[12px] font-bold transition ${
                days === d ? "bg-acc text-white" : "bg-wht5 text-mut hover:bg-wht8"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatBox label="Total Spend" value={`$${summary.totalCost.toFixed(4)}`} icon="💰" />
          <StatBox label="Total Calls" value={summary.totalCalls.toLocaleString()} icon="📞" />
          <StatBox label="Cache Hits" value={`${summary.cacheHitRate.toFixed(1)}%`} icon="🎯" sub={`${summary.cachedCalls} cached`} />
          <StatBox label="Avg Latency" value={`${Math.round(summary.avgLatencyMs)}ms`} icon="⚡" />
          <StatBox label="Cache Entries" value={cacheStats?.totalEntries?.toLocaleString() ?? "0"} icon="🗄️" sub={`${cacheStats?.totalHits?.toLocaleString() ?? 0} total hits`} />
        </div>
      )}

      {/* Two-column: By Module + By Model */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Module */}
        <div className={`${cardCls} p-4`}>
          <h3 className="mb-3 text-[14px] font-extrabold">📊 Cost by Module</h3>
          {byModule.length === 0 ? (
            <p className="text-[12px] text-mut">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {byModule.map((m) => (
                <div key={m.module} className="flex items-center justify-between rounded-lg bg-wht5 px-3 py-2">
                  <div>
                    <span className="text-[13px] font-bold">{m.module}</span>
                    <span className="ml-2 text-[11px] text-mut">{m.calls} calls</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-bold text-acc">${m.cost.toFixed(4)}</span>
                    {m.cached > 0 && (
                      <span className="ml-2 text-[10px] text-green">🎯 {m.cached} cached</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Model */}
        <div className={`${cardCls} p-4`}>
          <h3 className="mb-3 text-[14px] font-extrabold">🧠 Cost by Model</h3>
          {byModel.length === 0 ? (
            <p className="text-[12px] text-mut">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {byModel.map((m) => (
                <div key={m.model} className="flex items-center justify-between rounded-lg bg-wht5 px-3 py-2">
                  <div>
                    <span className="text-[13px] font-bold">{m.model}</span>
                    <span className="ml-2 text-[11px] text-mut">{m.calls} calls · ~{m.avgTokens} tok/call</span>
                  </div>
                  <span className="text-[13px] font-bold text-acc">${m.cost.toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily spend chart (text-based bar chart) */}
      <div className={`${cardCls} p-4`}>
        <h3 className="mb-3 text-[14px] font-extrabold">📈 Daily Spend</h3>
        {daily.length === 0 ? (
          <p className="text-[12px] text-mut">No data yet.</p>
        ) : (
          <div className="space-y-1">
            {(() => {
              const maxCost = Math.max(...daily.map((d) => d.cost), 0.0001);
              return daily.map((d) => {
                const pct = maxCost > 0 ? (d.cost / maxCost) * 100 : 0;
                return (
                  <div key={d.date} className="flex items-center gap-2">
                    <span className="w-[80px] shrink-0 text-[11px] text-mut">{d.date.slice(5)}</span>
                    <div className="h-[14px] flex-1 overflow-hidden rounded bg-wht5">
                      <div className="h-full rounded bg-acc transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="w-[70px] shrink-0 text-right text-[11px] font-bold">${d.cost.toFixed(4)}</span>
                    <span className="w-[40px] shrink-0 text-right text-[10px] text-mut">{d.calls}</span>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Per-user usage report */}
      <UserUsageReport days={days} />

      {/* Projection */}
      {summary && summary.totalCalls > 0 && (
        <div className={`${cardCls} p-4`}>
          <h3 className="mb-2 text-[14px] font-extrabold">🔮 Cost Projection</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ProjectionCard label={`${days}d actual`} cost={summary.totalCost} />
            <ProjectionCard label="30d projected" cost={(summary.totalCost / days) * 30} />
            <ProjectionCard label="1k users/mo" cost={(summary.totalCost / days) * 30 * 10} sub="10x multiplier" />
            <ProjectionCard label="10k users/mo" cost={(summary.totalCost / days) * 30 * 100} sub="100x multiplier" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Per-user Usage Report ───────────────────────────────────────────── */

interface UserUsage {
  userId: string;
  email: string;
  calls: number;
  tokens: number;
  cost: number;
  cachedCalls: number;
  errors: number;
  quota?: { daily_limit: number; monthly_limit: number; enabled: boolean; note: string | null };
}

function UserUsageReport({ days }: { days: number }) {
  const [users, setUsers] = useState<UserUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [quotaForm, setQuotaForm] = useState({ daily_limit: 50, monthly_limit: 1000, enabled: true, note: "" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const client = await getSupabaseClient();
        if (!client) return;
        const since = new Date(Date.now() - days * 86400_000).toISOString();
        const [costRes, quotaRes, userRes] = await Promise.all([
          client.from("ai_cost_log").select("user_id, input_tokens, output_tokens, estimated_cost, cached, error").gte("created_at", since).not("user_id", "is", null),
          client.from("ai_user_quotas").select("*"),
          client.from("users_view").select("id, email")
        ]);
        if (cancelled) return;

        const costRows = (costRes.data ?? []) as Array<{ user_id: string; input_tokens: number; output_tokens: number; estimated_cost: number; cached: boolean; error: boolean }>;
        const quotaRows = (quotaRes.data ?? []) as Array<{ user_id: string; daily_limit: number; monthly_limit: number; enabled: boolean; note: string | null }>;
        const userRows = (userRes.data ?? []) as Array<{ id: string; email: string }>;

        const emailMap = new Map(userRows.map(u => [u.id, u.email]));
        const quotaMap = new Map(quotaRows.map(q => [q.user_id, q]));

        const userMap = new Map<string, UserUsage>();
        for (const r of costRows) {
          const existing = userMap.get(r.user_id) ?? {
            userId: r.user_id, email: emailMap.get(r.user_id) ?? r.user_id.slice(0, 8),
            calls: 0, tokens: 0, cost: 0, cachedCalls: 0, errors: 0,
            quota: quotaMap.get(r.user_id),
          };
          existing.calls++;
          existing.tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
          existing.cost += r.estimated_cost || 0;
          if (r.cached) existing.cachedCalls++;
          if (r.error) existing.errors++;
          existing.quota = quotaMap.get(r.user_id);
          userMap.set(r.user_id, existing);
        }
        // Also include users with quotas but no usage
        for (const q of quotaRows) {
          if (!userMap.has(q.user_id)) {
            userMap.set(q.user_id, {
              userId: q.user_id, email: emailMap.get(q.user_id) ?? q.user_id.slice(0, 8),
              calls: 0, tokens: 0, cost: 0, cachedCalls: 0, errors: 0, quota: q,
            });
          }
        }
        setUsers([...userMap.values()].sort((a, b) => b.cost - a.cost));
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [days]);

  const saveQuota = async (userId: string) => {
    try {
      const client = await getSupabaseClient();
      if (!client) return;
      await client.from("ai_user_quotas").upsert({
        user_id: userId,
        daily_limit: quotaForm.daily_limit,
        monthly_limit: quotaForm.monthly_limit,
        enabled: quotaForm.enabled,
        note: quotaForm.note || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      setEditingUser(null);
      // Reload
      window.location.reload();
    } catch { /* silent */ }
  };

  if (loading) return null;
  if (users.length === 0) return null;

  return (
    <div className={`${cardCls} p-4`}>
      <h3 className="mb-3 text-[14px] font-extrabold">👥 Per-User Usage ({days}d)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line/15 text-left text-mut">
              <th className="pb-2 pr-3">User</th>
              <th className="pb-2 pr-3 text-right">Calls</th>
              <th className="pb-2 pr-3 text-right">Tokens</th>
              <th className="pb-2 pr-3 text-right">Cost</th>
              <th className="pb-2 pr-3 text-right">Cached</th>
              <th className="pb-2 pr-3 text-right">Errors</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.userId} className={`border-b border-line/10 ${u.quota && !u.quota.enabled ? "opacity-50" : ""}`}>
                <td className="py-2 pr-3">
                  <div className="font-bold">{u.email}</div>
                  {u.quota?.note && <div className="text-[10px] text-warn">{u.quota.note}</div>}
                </td>
                <td className="py-2 pr-3 text-right font-mono">
                  {u.calls}
                  {u.quota && u.quota.daily_limit > 0 && (
                    <span className="text-[10px] text-mut"> /{u.quota.daily_limit}/d</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-mono">{u.tokens.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right font-mono font-bold text-acc">${u.cost.toFixed(4)}</td>
                <td className="py-2 pr-3 text-right font-mono text-green">{u.cachedCalls}</td>
                <td className="py-2 pr-3 text-right font-mono text-warn">{u.errors}</td>
                <td className="py-2 text-right">
                  <button
                    className="rounded bg-wht5 px-2 py-1 text-[10px] font-bold text-mut hover:bg-wht8"
                    onClick={() => {
                      setEditingUser(u.userId);
                      setQuotaForm({
                        daily_limit: u.quota?.daily_limit ?? 50,
                        monthly_limit: u.quota?.monthly_limit ?? 1000,
                        enabled: u.quota?.enabled ?? true,
                        note: u.quota?.note ?? "",
                      });
                    }}
                  >
                    {u.quota ? "Edit" : "Set quota"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quota editor modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`${cardCls} w-full max-w-[400px] p-6`}>
            <h4 className="mb-4 text-[14px] font-extrabold">Set AI Quota</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={quotaForm.enabled} onChange={e => setQuotaForm(f => ({ ...f, enabled: e.target.checked }))} className="accent-acc" />
                <span className="text-[13px] font-bold">AI Enabled</span>
              </label>
              <div>
                <label className="text-[11px] text-mut">Daily call limit (0 = unlimited)</label>
                <input type="number" value={quotaForm.daily_limit} onChange={e => setQuotaForm(f => ({ ...f, daily_limit: Number(e.target.value) }))} className="inp mt-1 w-full" />
              </div>
              <div>
                <label className="text-[11px] text-mut">Monthly call limit (0 = unlimited)</label>
                <input type="number" value={quotaForm.monthly_limit} onChange={e => setQuotaForm(f => ({ ...f, monthly_limit: Number(e.target.value) }))} className="inp mt-1 w-full" />
              </div>
              <div>
                <label className="text-[11px] text-mut">Admin note</label>
                <input type="text" value={quotaForm.note} onChange={e => setQuotaForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. abuse warning" className="inp mt-1 w-full" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn-primary flex-1" onClick={() => void saveQuota(editingUser)}>Save</button>
              <button className="btn-ghost flex-1" onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function StatBox({ label, value, icon, sub }: { label: string; value: string; icon: string; sub?: string }) {
  return (
    <div className={`${cardCls} p-3 text-center`}>
      <div className="text-[18px]">{icon}</div>
      <div className="mt-1 text-[18px] font-extrabold">{value}</div>
      <div className="text-[11px] text-mut">{label}</div>
      {sub && <div className="text-[10px] text-mut">{sub}</div>}
    </div>
  );
}

function ProjectionCard({ label, cost, sub }: { label: string; cost: number; sub?: string }) {
  return (
    <div className="rounded-lg bg-wht5 px-3 py-2 text-center">
      <div className="text-[12px] font-bold text-mut">{label}</div>
      <div className="text-[16px] font-extrabold text-acc">${cost.toFixed(2)}</div>
      {sub && <div className="text-[10px] text-mut">{sub}</div>}
    </div>
  );
}
