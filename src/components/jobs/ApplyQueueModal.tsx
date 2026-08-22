/* Apply queue modal — work through imported jobs one at a time */

import type { JobPosting } from "../../types";
import type { ApplyTrack } from "../../services/applyTrack";
import { sourceLabel } from "../../services/importJob";
import { btnGhost, btnSm, Chip, Modal } from "../ui";

interface Props {
  queue: JobPosting[];
  tracks: Record<string, ApplyTrack>;
  jobs: JobPosting[];
  onApply: (j: JobPosting) => void;
  onKit: (j: JobPosting) => void;
  onClose: () => void;
}

export function ApplyQueueModal({ queue, tracks, jobs, onApply, onKit, onClose }: Props) {
  return (
    <Modal
      onClose={onClose}
      title="\U0001f4cb Apply queue"
      desc="Work through the batch one at a time \u2014 each Apply opens the platform's own page in a new tab, where you complete the submission. InterviewIQ never applies for you; it just tracks progress. Use \U0001f4c4 Kit to review the tailored resume & cover letter first."
    >
      <div className="space-y-2">
        {queue.map((j, i) => {
          const tr = tracks[j.id];
          const done = tr && (tr.status === "applied" || tr.status === "interview" || tr.status === "offer" || tr.status === "rejected");
          return (
            <div key={j.id} className="flex items-start justify-between gap-3 rounded-xl border border-line/15 bg-deep/30 p-3.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="co">{sourceLabel(j.source)}</Chip>
                  <span className="text-[11px] font-bold text-mut">{i + 1}/{queue.length}</span>
                </div>
                <div className="mt-1 truncate text-[13px] font-extrabold text-ink">{j.title}</div>
                {j.company && <div className="text-[11.5px] font-bold text-fnt">{j.company}</div>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  className="rounded-full border border-line/20 bg-deep/40 px-2.5 py-1 text-[11.5px] font-bold text-mut transition-all hover:text-ink"
                  onClick={() => onKit(j)}
                  title="Open the tailored resume & cover letter for this role"
                >
                  \U0001f4c4 Kit
                </button>
                {done ? (
                  <Chip tone="ok" title={tr.via ? `Applied via ${tr.via}` : "Marked applied"}>
                    \u2713 {tr.via ? `Applied via ${tr.via}` : "Applied"}
                  </Chip>
                ) : (
                  <button
                    className="rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-[11.5px] font-bold text-ok transition-all hover:bg-ok/20"
                    onClick={() => onApply(j)}
                  >
                    \U0001f517 Apply on {sourceLabel(j.source)} \u2197
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-mut">Each apply is also tracked on its feed card \u2014 follow-ups land in the apply tracker.</p>
      <button className="mt-3 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
        Done \u2014 close
      </button>
    </Modal>
  );
}
