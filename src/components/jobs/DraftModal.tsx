import { toast } from "../../toast";
import { Modal } from "../ui";
import { followUpDraft, STATUS_META } from "../../services/applyTrack";
import type { JobPosting } from "../../types";
import type { ApplyTrack } from "../../services/applyTrack";

export function DraftModal({ track, job, onClose }: { track: ApplyTrack; job: JobPosting | null; onClose: () => void }) {
  const title = job?.title ?? track.jobId;
  const company = job?.company ?? "";
  const daysSince = track.appliedAt ? Math.max(1, Math.round((Date.now() - track.appliedAt) / 86_400_000)) : 7;
  const draft = followUpDraft(track.status, title, company, daysSince);
  const copy = () => {
    navigator.clipboard?.writeText(draft).then(
      () => toast("📋 Draft copied — paste it into your email"),
      () => toast("✗ Clipboard blocked — copy manually")
    );
  };
  return (
    <Modal onClose={onClose} title="✍️ Follow-up draft" desc={`A ${STATUS_META[track.status].label.toLowerCase()}-stage nudge for ${title}${company ? ` at ${company}` : ""}.`}>
      <pre className="max-h-[44vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/15 bg-deep/40 p-4 font-sans text-[13px] leading-relaxed text-fnt">
        {draft}
      </pre>
      <p className="mt-3 text-[11.5px] text-mut">Customize the placeholders (names, dates) before sending — then mark the stage on the card so the tracker stays honest.</p>
      <div className="mt-4 flex gap-2">
        <button className="flex-1 rounded-xl bg-acc1/15 py-2.5 text-[13px] font-extrabold text-acctxt transition-all hover:bg-acc1/25" onClick={copy}>
                          📋 Copy draft
        </button>
        <button className="flex-1 rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
                          Close
        </button>
      </div>
    </Modal>
  );
}
