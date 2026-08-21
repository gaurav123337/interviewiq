/* ScoreBadge.tsx — color-coded score badge */

export function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 4 ? "border-ok/35 bg-ok/10 text-ok" : score >= 3 ? "border-warn/35 bg-warn/10 text-warn" : "border-bad/35 bg-bad/10 text-bad";
  return <span className={`rounded-full border px-3 py-1 text-[12.5px] font-extrabold ${cls}`}>{score}/5</span>;
}
