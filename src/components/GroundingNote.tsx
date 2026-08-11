/* A one-line expandable explanation of how answers are grounded — shown in
   the roadmap tutor and the AI coach so a 📚 grounded / 🧠 general-knowledge
   status chip is explainable, not mysterious. */

export function GroundingNote({ minSim, pool, docs }: { minSim: number; pool: number; docs?: number | null }) {
  return (
    <details className="group">
      <summary className="cursor-pointer select-none text-[11px] font-bold text-fnt transition-colors hover:text-ink">
        ⓘ How answers are grounded
      </summary>
      <p className="mt-1 text-[11.5px] leading-relaxed text-mut">
        Answers cite the product knowledge base only when the top source similarity is ≥ {minSim.toFixed(2)}.
        Retrieval considers {pool} candidate chunks{docs != null ? ` across ${docs} indexed document${docs === 1 ? "" : "s"}` : ""}.
        Replies mark their status: <span className="font-bold text-ok">📚 grounded</span> (cited the KB) or{" "}
        <span className="font-bold">🧠 general knowledge</span> (no strong KB match — the answer says so).
      </p>
    </details>
  );
}
