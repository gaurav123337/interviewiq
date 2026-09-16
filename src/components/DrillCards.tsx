import { useRef, useState, type ReactNode } from "react";
import type { DrillCard } from "../services/drill";

/* A tap-to-reveal flashcard panel over a DrillCard deck. Shared by the Jobs
   "Practice deck" (RoundModal) and "Quick-drill" (GapPlanModal) — the markup was
   duplicated byte-for-byte, so it lives here once. Purely presentational: the
   caller builds the deck (practiceForRound / deckForSkills) and owns when the
   panel shows; this component owns only the per-card reveal toggle. */
export function DrillCards({ title, description, cards, onClose, className = "" }: {
  title: ReactNode;
  description: ReactNode;
  cards: DrillCard[];
  onClose: () => void;
  /** Appended to the panel wrapper — callers pass their own top margin (mt-3 / mt-4). */
  className?: string;
}) {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  /* A freshly-built or re-opened deck must start fully collapsed. Both callers
     hand us a new array reference on each (re)build, so reset the reveal state
     the moment that reference changes — React's documented adjust-state-during-
     render pattern (no effect, no flash). */
  const deckRef = useRef(cards);
  if (deckRef.current !== cards) { deckRef.current = cards; setFlipped({}); }

  return (
    <div className={`rounded-xl border border-ok/25 bg-ok/5 p-4 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-extrabold text-ok">{title}</p>
        <button className="text-[11.5px] font-bold text-mut hover:text-ink" onClick={onClose}>✕ Close</button>
      </div>
      <p className="mt-0.5 text-[11.5px] text-fnt">{description}</p>
      <div className="mt-3 space-y-2">
        {cards.map(c => {
          const show = flipped[c.q];
          return (
            <div key={c.q} className="rounded-xl border border-line/15 bg-deep/30 p-3">
              <button className="w-full text-left" onClick={() => setFlipped(f => ({ ...f, [c.q]: !f[c.q] }))}>
                <span className="text-[12.5px] font-bold text-ink">{c.q}</span>
                {show && (
                  <span className="mt-1.5 block whitespace-pre-wrap text-[12px] leading-relaxed text-fnt">
                    <span className="font-bold text-ok">Answer:</span> {c.a}
                    {c.kp?.length ? <span className="mt-1 block text-[11px] text-mut">Key points: {c.kp.join(" · ")}</span> : null}
                  </span>
                )}
              </button>
              <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-mut">{show ? "Tap question to hide" : "Tap to reveal the answer"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
