/* Performance monitoring — tracks Core Web Vitals (LCP, CLS, FID) on the landing page.
   Silently collects metrics and exposes them for analytics. No visual UI unless
   the admin toggles it on via ?perf=true. */

import { useEffect, useRef, useState } from "react";

interface WebVitals {
  lcp: number | null;       // Largest Contentful Paint (ms)
  cls: number | null;       // Cumulative Layout Shift (unitless)
  fid: number | null;       // First Input Delay (ms)
  ttfb: number | null;      // Time to First Byte (ms)
  fcp: number | null;       // First Contentful Paint (ms)
  tti: number | null;       // Time to Interactive (ms)
}

interface PerformanceEntry {
  metric: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  timestamp: number;
  url: string;
}

/** Rate a metric against Core Web Vitals thresholds */
function rate(metric: string, value: number): "good" | "needs-improvement" | "poor" {
  switch (metric) {
    case "lcp": return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    case "cls": return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    case "fid": return value <= 100 ? "good" : value <= 300 ? "needs-improvement" : "poor";
    case "ttfb": return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
    case "fcp": return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
    default: return "good";
  }
}

/** Send metric to analytics endpoint (fire-and-forget) */
function reportMetric(entry: PerformanceEntry) {
  // Store in localStorage for admin review
  try {
    const key = "iq.perf.metrics";
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    stored.push(entry);
    // Keep last 100 entries
    if (stored.length > 100) stored.splice(0, stored.length - 100);
    localStorage.setItem(key, JSON.stringify(stored));
  } catch { /* localStorage quota */ }
}

/**
 * useWebVitals — hooks into PerformanceObserver APIs to track CLS, LCP, FID.
 * Returns the current metrics and a flag indicating if the admin overlay is enabled.
 */
export function useWebVitals(): WebVitals & { adminView: boolean } {
  const [metrics, setMetrics] = useState<WebVitals>({
    lcp: null, cls: null, fid: null, ttfb: null, fcp: null, tti: null,
  });
  const clsRef = useRef(0);

  const adminView = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).has("perf");

  useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

    // Navigation timing (TTFB, FCP)
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      const ttfb = nav.responseStart - nav.requestStart;
      setMetrics(m => ({ ...m, ttfb: ttfb > 0 ? ttfb : null }));
    }

    // FCP
    try {
      const fcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcp = entries[entries.length - 1];
        if (fcp) {
          setMetrics(m => ({ ...m, fcp: fcp.startTime }));
          reportMetric({ metric: "fcp", value: fcp.startTime, rating: rate("fcp", fcp.startTime), timestamp: Date.now(), url: location.href });
        }
      });
      fcpObs.observe({ type: "paint", buffered: true });
    } catch { /* observer not supported */ }

    // LCP
    try {
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as any;
        if (last) {
          const lcp = last.startTime;
          setMetrics(m => ({ ...m, lcp }));
          reportMetric({ metric: "lcp", value: lcp, rating: rate("lcp", lcp), timestamp: Date.now(), url: location.href });
        }
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    } catch { /* observer not supported */ }

    // CLS
    try {
      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsRef.current += entry.value;
          }
        }
        setMetrics(m => ({ ...m, cls: clsRef.current }));
        reportMetric({ metric: "cls", value: clsRef.current, rating: rate("cls", clsRef.current), timestamp: Date.now(), url: location.href });
      });
      clsObs.observe({ type: "layout-shift", buffered: true });
    } catch { /* observer not supported */ }

    // FID
    try {
      const fidObs = new PerformanceObserver((list) => {
        const entry = list.getEntries()[0] as any;
        if (entry) {
          const fid = entry.processingStart - entry.startTime;
          setMetrics(m => ({ ...m, fid }));
          reportMetric({ metric: "fid", value: fid, rating: rate("fid", fid), timestamp: Date.now(), url: location.href });
        }
      });
      fidObs.observe({ type: "first-input", buffered: true });
    } catch { /* observer not supported */ }

    // TTI estimate (from PerformanceObserver or navigation)
    try {
      const longObs = new PerformanceObserver((list) => {
        // Long tasks indicate the page isn't interactive yet
        const longTasks = list.getEntries();
        if (longTasks.length === 0) {
          setMetrics(m => ({ ...m, tti: performance.now() }));
        }
      });
      longObs.observe({ type: "longtask", buffered: true });
    } catch { /* observer not supported */ }
  }, []);

  return { ...metrics, adminView };
}

/** Overlay that shows live web vitals when ?perf=true is in the URL */
export function PerfOverlay({ metrics }: { metrics: WebVitals }) {
  const items: { label: string; value: number | null; unit: string; good: number; warn: number }[] = [
    { label: "LCP", value: metrics.lcp, unit: "ms", good: 2500, warn: 4000 },
    { label: "CLS", value: metrics.cls, unit: "", good: 0.1, warn: 0.25 },
    { label: "FID", value: metrics.fid, unit: "ms", good: 100, warn: 300 },
    { label: "FCP", value: metrics.fcp, unit: "ms", good: 1800, warn: 3000 },
    { label: "TTFB", value: metrics.ttfb, unit: "ms", good: 800, warn: 1800 },
  ];

  const rating = (val: number | null, good: number, warn: number) =>
    val === null ? "text-mut" : val <= good ? "text-ok" : val <= warn ? "text-warn" : "text-bad";

  return (
    <div className="fixed bottom-4 left-4 z-[9999] rounded-xl border border-line/20 bg-ink/90 px-4 py-3 text-[11px] font-mono text-wht shadow-xl backdrop-blur">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-mut">Core Web Vitals</div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-10 font-bold text-mut">{item.label}</span>
            <span className={`font-bold ${rating(item.value, item.good, item.warn)}`}>
              {item.value !== null ? `${Math.round(item.value * (item.unit === "" ? 1000 : 1))}${item.unit === "" ? "" : item.unit}` : "…"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
