/* ProgressBar.tsx — horizontal progress bar with dynamic width */

export function ProgressBar({ widthPct, label, className = "", height = "h-2.5" }: {
  widthPct: number; label?: string; className?: string; height?: string;
}) {
  return (
    <div className={`${height} overflow-hidden rounded-full bg-wht/10 ${className}`} title={label}>
      <div
        className="h-full rounded-full grad-bg transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(3, widthPct))}%` }}
      />
    </div>
  );
}
