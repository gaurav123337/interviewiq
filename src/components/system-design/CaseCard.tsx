
import type { SystemDesignCase } from '../../data/systemDesignBank';
import { btnGhost, btnSm, cardCls, Chip } from '../ui';
import { DifficultyDots } from './DifficultyDots';


export function CaseCard({
  caseData: c,
  isCompleted,
  isBookmarked,
  onSelect,
  onToggleBookmark,
  onPrerequisiteClick
}: {
  caseData: SystemDesignCase;
  isCompleted: boolean;
  isBookmarked: boolean;
  onSelect: () => void;
  onToggleBookmark: (id: string) => void;
  onPrerequisiteClick?: (caseId: string, prereq: string) => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`${cardCls} w-full text-left transition-all hover:border-acc1/40 hover:shadow-[0_8px_24px_rgba(99,102,241,.15)] ${isCompleted ? "border-ok/30 bg-ok/5" : ""}`}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-wht/5 text-[24px]">
          {isCompleted ? "✅" : c.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-extrabold">{c.title}</span>
            <DifficultyDots level={c.difficulty} />
            <Chip tone="cat">{c.category}</Chip>
            {isCompleted && <Chip tone="ok">Completed</Chip>}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-mut">{c.blurb}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.prerequisites.map(p => (
              <span
                key={p}
                onClick={e => { e.stopPropagation(); onPrerequisiteClick?.(c.id, p); }}
                className="cursor-pointer rounded-full border border-acc1/25 bg-acc1/10 px-2 py-0.5 text-[11px] font-semibold text-acctxt transition-all hover:border-acc1/50 hover:bg-acc1/20 hover:shadow-[0_2px_8px_rgba(99,102,241,.2)]"
                title={`Learn about ${p} in the context of ${c.title} — from beginner to advanced`}
              >
                📘 {p}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onToggleBookmark(c.id); }}
            className={`text-[16px] transition-all ${isBookmarked ? "text-amber-400" : "text-mut hover:text-amber-400"}`}
            title={isBookmarked ? "Remove bookmark" : "Bookmark this case"}
          >
            {isBookmarked ? "🔖" : "🏷️"}
          </button>
          <span className="text-[13px] font-bold text-acctxt">→</span>
        </div>
      </div>
    </button>
  );
}

