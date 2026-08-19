import { useState } from "react";

/* A visible citation under a grounded tutor/coach reply — click to expand the source excerpt.
   Redesign: cleaner layout with trust badge, blockquote content, and expandable excerpt. */
export function CitationChip({ title, content, source }: { title: string; content: string; source?: "case-study" | "deep-dive" | "knowledge-base" }) {
  const [open, setOpen] = useState(false);

  const badge = source === "case-study"
    ? { label: "🟢 Verified", cls: "bg-ok/15 text-ok border-ok/30" }
    : source === "deep-dive"
    ? { label: "🟡 Curated", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
    : { label: "🔵 KB", cls: "bg-acc1/15 text-acctxt border-acc1/30" };

  return (
    <button
      onClick={() => setOpen(!open)}
      className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${open ? "border-acc1/50 bg-acc1/10 shadow-[0_2px_10px_rgba(99,102,241,.1)]" : "border-line/15 bg-deep/60 hover:border-acc1/30 hover:bg-wht/5"}`}
      title="Click to expand source excerpt"
    >
      {/* Header row: badge + title */}
      <div className="flex items-center gap-2">
        <span className={`flex-none rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>{badge.label}</span>
        <span className="truncate text-[11px] font-bold text-acc3">📚 {title}</span>
      </div>

      {/* Content preview / expanded excerpt */}
      <div className={`mt-1.5 rounded-lg border-l-2 border-acc1/30 bg-deep/40 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-mut ${open ? "" : "line-clamp-2"}`}>
        {open ? content : content.slice(0, 120) + (content.length > 120 ? "…" : "")}
      </div>

      {/* Expand/collapse indicator */}
      <div className="mt-1 flex items-center gap-1 text-[9.5px] font-semibold text-fnt">
        <span>{open ? "▲" : "▼"}</span>
        <span>{open ? "Hide source" : "Show source excerpt"}</span>
        {!open && content.length > 120 && (
          <span className="ml-auto text-[9px] text-mut">{content.length} chars</span>
        )}
      </div>
    </button>
  );
}
