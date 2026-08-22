

export function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Difficulty ${level}/5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? "grad-bg" : "bg-wht/20"}`} />
      ))}
    </span>
  );
}

