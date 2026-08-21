import { type AnalyticsSummary, type ABTestResult, type DailyAnalytics, fetchAnalyticsSummary, fetchABTestResults, fetchDailyAnalytics } from '../../../services/contentService';
import { useState, useEffect } from 'react';
import { toast } from '../../../toast';
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, Modal } from '../../ui';

export function AnalyticsTab() {
  const [summary, setSummary] = useState<AnalyticsSummary[]>([]);
  const [abTest, setABTest] = useState<ABTestResult[]>([]);
  const [daily, setDaily] = useState<DailyAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [s, ab, d] = await Promise.all([fetchAnalyticsSummary(), fetchABTestResults(), fetchDailyAnalytics()]);
      setSummary(s); setABTest(ab); setDaily(d);
      setLoading(false);
    })();
  }, []);

  const totalImpressions = summary.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = summary.reduce((s, r) => s + r.clicks, 0);
  const overallCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0";

  const maxImpressions = Math.max(1, ...daily.map(d => d.impressions));

  if (loading) return <div className="text-center text-mut py-8"><span className="spinner inline-block" /> Loading analytics…</div>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`${cardCls} p-4 text-center`}>
          <div className="text-[24px] font-extrabold text-acctxt">{totalImpressions.toLocaleString()}</div>
          <div className="text-[11px] font-bold text-mut">Total Impressions (30d)</div>
        </div>
        <div className={`${cardCls} p-4 text-center`}>
          <div className="text-[24px] font-extrabold text-ok">{totalClicks.toLocaleString()}</div>
          <div className="text-[11px] font-bold text-mut">Total Clicks (30d)</div>
        </div>
        <div className={`${cardCls} p-4 text-center`}>
          <div className="text-[24px] font-extrabold text-amber-400">{overallCTR}%</div>
          <div className="text-[11px] font-bold text-mut">Overall CTR</div>
        </div>
      </div>

      {/* Daily chart */}
      {daily.length > 0 && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-[13px] font-extrabold mb-3">📈 Daily Activity (last 30 days)</h3>
          <div className="flex items-end gap-1 h-32">
            {daily.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex flex-col items-stretch">
                  <div className="bg-acc1/40 rounded-t" style={{ height: `${(d.clicks / maxImpressions) * 100}%`, minHeight: d.clicks > 0 ? 2 : 0 }} />
                  <div className="bg-acc1/15 rounded-b" style={{ height: `${(d.impressions / maxImpressions) * 100}%`, minHeight: d.impressions > 0 ? 2 : 0 }} />
                </div>
                <span className="text-[8px] text-mut truncate w-full text-center" title={d.day}>{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-[10px] text-mut">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-acc1/40" /> Clicks</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-acc1/15" /> Impressions</span>
          </div>
        </div>
      )}

      {/* A/B test results */}
      {abTest.length > 0 && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-[13px] font-extrabold mb-3">🧪 A/B Test Results (Testimonials)</h3>
          <div className="space-y-2">
            {abTest.map(r => (
              <div key={r.variant} className="flex items-center gap-3 rounded-lg border border-line/15 bg-deep/40 p-3">
                <span className={`rounded-full px-3 py-1 text-[12px] font-extrabold ${r.variant === "A" ? "bg-acc1/20 text-acctxt" : r.variant === "B" ? "bg-purple-500/20 text-purple-400" : "bg-wht/10 text-mut"}`}>
                  {r.variant === "all" ? "All" : `Variant ${r.variant}`}
                </span>
                <div className="flex-1">
                  <div className="flex gap-4 text-[12px]">
                    <span>👁️ {r.impressions.toLocaleString()} views</span>
                    <span>🖱️ {r.clicks.toLocaleString()} clicks</span>
                    <span className="font-extrabold text-acctxt">{r.ctr}% CTR</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-wht/10">
                    <div className="h-full rounded-full bg-acctxt transition-all" style={{ width: `${Math.min(100, r.ctr * 5)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entity breakdown */}
      {summary.length > 0 && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-[13px] font-extrabold mb-3">📊 Content Performance</h3>
          <div className="space-y-2">
            {summary.map(r => (
              <div key={r.entity_id} className="flex items-center gap-3 rounded-lg border border-line/15 bg-deep/40 p-3">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-wht/10 text-mut">
                  {r.entity_type}
                </span>
                <div className="flex-1">
                  <div className="flex gap-4 text-[12px]">
                    <span>👁️ {r.impressions.toLocaleString()}</span>
                    <span>🖱️ {r.clicks.toLocaleString()}</span>
                    <span className="font-extrabold">{r.ctr}% CTR</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-wht/10">
                    <div className="h-full rounded-full bg-acc1" style={{ width: `${Math.min(100, r.ctr * 5)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.length === 0 && abTest.length === 0 && daily.length === 0 && (
        <div className={`${cardCls} p-8 text-center text-mut`}>
          <p className="text-[14px] font-extrabold">No analytics data yet</p>
          <p className="mt-1 text-[12px]">Analytics will appear here once users start interacting with ads, resources, and banners on the landing page.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main export — Content section for the Admin dashboard                */
/* ------------------------------------------------------------------ */
