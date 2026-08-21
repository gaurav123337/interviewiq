/* Difficulty.tsx — difficulty dots (1-5) */

export function Difficulty({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`h-1 w-3 rounded-[2px] ${i <= level ? "grad-bg" : "bg-wht/20"}`} />
      ))}
    </span>
  );
}
