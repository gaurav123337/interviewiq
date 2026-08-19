

/* A visible citation under a grounded tutor/coach reply.
   Uses native <details>/<summary> for guaranteed expand/collapse.
   Shows trust badge, blockquote-style content, and expandable excerpt. */
export function CitationChip({ title, content, source }: { title: string; content: string; source?: "case-study" | "deep-dive" | "knowledge-base" }) {
  const badge = source === "case-study"
    ? { label: "🟢 Verified", cls: "bg-ok/15 text-ok border-ok/30" }
    : source === "deep-dive"
    ? { label: "🟡 Curated", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
    : { label: "🔵 KB", cls: "bg-acc1/15 text-acctxt border-acc1/30" };

  return (
    <details className="group rounded-xl border border-line/15 bg-deep/60 transition-all open:border-acc1/50 open:bg-acc1/10 open:shadow-[0_2px_10px_rgba(99,102,241,.1)]">
      <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 select-none [&::-webkit-details-marker]:hidden">
        {/* Expand icon */}
        <span className="mt-0.5 flex-none text-[10px] text-fnt transition-transform group-open:rotate-90">▶</span>
        <div className="min-w-0 flex-1">
          {/* Header: badge + title */}
          <div className="flex items-center gap-2">
            <span className={`flex-none rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>{badge.label}</span>
            <span className="truncate text-[11px] font-bold text-acc3">📚 {title}</span>
          </div>
          {/* Preview */}
          <div className="mt-1 line-clamp-1 text-[11px] leading-snug text-mut">{content}</div>
        </div>
      </summary>
      {/* Expanded content */}
      <div className="border-t border-line/10 px-3 py-2.5">
        <div className="rounded-lg border-l-2 border-acc1/30 bg-deep/40 px-2.5 py-2 text-[12px] leading-relaxed text-ink whitespace-pre-wrap">{content}</div>
        <div className="mt-1.5 text-[9px] font-semibold text-mut">📖 Full source excerpt — {content.length} characters</div>
      </div>
    </details>
  );
}
