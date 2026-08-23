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
