import { useState } from "react";

/* A visible citation under a grounded tutor/coach reply — click to expand the source excerpt. */
export function CitationChip({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      className={`w-full rounded-lg border px-2.5 py-1.5 text-left transition-colors ${open ? "border-acc1/50 bg-acc1/10" : "border-line/15 bg-deep/60 hover:bg-wht/10"}`}
      title="Knowledge-base source"
    >
      <span className="block text-[11px] font-bold text-acc3">📚 {title}</span>
      <span className={`block text-[11.5px] leading-snug text-mut ${open ? "" : "line-clamp-1"}`}>
        {content}
      </span>
      <span className="mt-0.5 block text-[10px] font-semibold text-fnt">{open ? "▲ hide" : "▼ show source excerpt"}</span>
    </button>
  );
}
