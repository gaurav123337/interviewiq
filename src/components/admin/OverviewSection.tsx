/* OverviewSection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import { fetchSecretStatus, type SecretStatusReport } from "../../services/secrets";
import { type AdminMetrics } from "../../services/admin";
import { StatCard } from "../ui";

/* ------------------------------------------------------------------ */
/* Overview — business KPIs                                            */
/* ------------------------------------------------------------------ */

export function OverviewSection({ metrics, loading, onOpenSecrets }: { metrics: AdminMetrics | null; loading: boolean; onOpenSecrets: () => void }) {
  if (loading && !metrics) {
    return <div className="text-center text-mut"><span className="spinner inline-block" /> Loading metrics…</div>;
  }
  const m = metrics ?? {
    totalUsers: 0, newThisWeek: 0, activeToday: 0, active7d: 0, proUsers: 0,
    totalSessions: 0, sessions7d: 0, aiCalls7d: 0, events7d: 0
  };
  const cards = [
    { label: "Total users", value: m.totalUsers, icon: "👥", sub: `${m.newThisWeek} new this week` },
    { label: "Active today", value: m.activeToday, icon: "⚡", sub: `${m.active7d} active in 7 days` },
    { label: "Pro users", value: m.proUsers, icon: "💎", sub: m.totalUsers ? `${Math.round((m.proUsers / m.totalUsers) * 100)}% conversion` : "no users yet" },
    { label: "Sessions (7d)", value: m.sessions7d, icon: "🎯", sub: `${m.totalSessions} all time` },
    { label: "AI calls (7d)", value: m.aiCalls7d, icon: "✨", sub: `${m.events7d} events tracked` },
    { label: "Engagement", value: m.totalUsers ? Math.round((m.active7d / m.totalUsers) * 100) + "%" : "—", icon: "📈", sub: "active 7d / total" }
  ];
  return (
    <div className="space-y-4">
      <SecretGapsBanner onOpen={onOpenSecrets} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {cards.map(c => (
          <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} sub={c.sub} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SecretGapsBanner — missing required function secrets surfaced on the */
/* Overview so setup gaps are visible without opening the Secrets tab. */
/* ------------------------------------------------------------------ */

function SecretGapsBanner({ onOpen }: { onOpen: () => void }) {
  const [report, setReport] = useState<SecretStatusReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSecretStatus()
      .then(r => { if (alive) setReport(r); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  /* function not deployed yet — the Secrets tab explains how to deploy it */
  if (failed || !report || report.summary.missingRequired === 0) return null;

  return (
    <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-[12.5px]">
      <span className="font-bold text-warn">
        ⚠️ {report.summary.missingRequired} required function secret{report.summary.missingRequired === 1 ? "" : "s"} missing:{" "}
      </span>
      <span className="font-mono font-bold text-ink">{report.summary.missingRequiredNames.join(", ")}</span>
      <span className="text-mut"> — emails answer sent:false, crons 401, verdicts stay pending.</span>{" "}
      <button className="font-bold text-acctxt underline" onClick={onOpen}>Review in Secrets →</button>
    </div>
  );
}
