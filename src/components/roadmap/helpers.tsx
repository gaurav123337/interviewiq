import type { ReactNode } from 'react';
import type { Roadmap } from '../../services/roadmap';
import { toast } from '../../toast';
import { exportRoadmapMarkdown, downloadRoadmapMarkdown } from '../../services/roadmap';

export function WizardHeader() {
  return (
    <div className="pt-2 text-center">
      <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🧭 Career Roadmap</span>
      <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Your target role, <span className="grad-text">broken down</span>.</h1>
      <p className="mx-auto mt-2 max-w-[560px] text-[14.5px] text-mut">
        Tell us where you're going and by when — we build a week-by-week roadmap: priority-ranked topics, resources, and an AI tutor for every one of them.
      </p>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-bold text-mut">{label}</span>
      {children}
    </label>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-[20px] font-extrabold leading-tight">{value}</div>
      <div className="text-[11.5px] font-semibold text-mut">{label}</div>
    </div>
  );
}

export function weekChip(s: string): string {
  switch (s) {
    case "current": return "🔥 This week";
    case "passed": return "📅 Passed";
    case "done": return "✅ Done";
    default: return "⏭ Upcoming";
  }
}


/* ------------------------------------------------------------------ */
/* exportRoadmap                                                       */
/* ------------------------------------------------------------------ */

export function exportRoadmap(roadmap: Roadmap) {
  try {
    const md = exportRoadmapMarkdown(roadmap);
    const p = navigator.clipboard?.writeText(md);
    if (p) p.catch(() => {});
    downloadRoadmapMarkdown(roadmap);
    toast("⬇ Markdown copied & downloaded — paste it anywhere");
  } catch {
    toast("✗ Export failed — try the Print button instead");
  }
}
