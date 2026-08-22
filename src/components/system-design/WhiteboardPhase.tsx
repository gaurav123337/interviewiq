import type { WhiteboardFlow } from '../../data/systemDesignBank';

export function WhiteboardPhase({ phase, index }: { phase: WhiteboardFlow; index: number }) {
  return (
    <div className="rounded-xl border border-line/10 bg-wht/5 p-4">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg grad-bg text-[12px] font-extrabold text-white">{index + 1}</div>
        <span className="text-[14px] font-extrabold">{phase.phase}</span>
        <span className="text-[12px] text-mut">({phase.duration})</span>
      </div>
      <ul className="mt-2 space-y-1">
        {phase.talkingPoints.map((tp, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed"><span className="flex-none text-acctxt">→</span><span className="text-ink">{tp}</span></li>
        ))}
      </ul>
      {phase.numbers && phase.numbers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {phase.numbers.map((n, i) => (
            <span key={i} className="rounded-full border border-acc1/25 bg-acc1/10 px-2 py-0.5 text-[11px] font-bold text-acctxt font-mono">{n}</span>
          ))}
        </div>
      )}
    </div>
  );
}

