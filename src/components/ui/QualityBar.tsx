/* QualityBar.tsx — color-coded quality score bar (green/yellow/red) */

export function QualityBar({ score, className = "" }: { score: number; className?: string }) {
  const color = score >= 80 ? "bg-ok" : score >= 60 ? "bg-warn" : "bg-bad";
  return (
    <div className={`h-[7px] w-[92px] overflow-hidden rounded-full bg-wht/15 ${className}`} title={`${score}/100`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, score)}%` }} />
    </div>
  );
}
