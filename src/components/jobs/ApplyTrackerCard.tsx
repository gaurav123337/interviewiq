import { cardCls, btnGhost, btnSm, Chip } from "../ui";
import { STATUS_META, STATUS_ORDER, trackSummary, type ApplyTrack } from "../../services/applyTrack";

export interface ApplyTrackerProps {
  proGated: boolean;
  due: ApplyTrack[];
  setReportOpen: (v: boolean) => void;
  setUpgrade: (reason: string) => void;
  batchExport: () => void;
}

export function ApplyTrackerCard({
  proGated,
  due,
  setReportOpen,
  setUpgrade,
  batchExport,
}: ApplyTrackerProps) {
  return (
    <div className={`${cardCls} mt-5 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 p-5">
        <div>
          <h3 className="text-[14.5px] font-extrabold">🗂️ Apply tracker</h3>
          <p className="mt-0.5 text-[11.5px] text-fnt">Statuses + follow-up dates per job. {proGated ? "Pro feature." : "Set a status on any card to start."}</p>
        </div>
        <div className="flex gap-2">
          <button className={btnGhost + btnSm} onClick={() => setReportOpen(true)} disabled={proGated}>
            📊 Weekly report
          </button>
          <button className={btnGhost + btnSm} onClick={batchExport} disabled={proGated}>
            📦 Export all kits (.zip)
          </button>
        </div>
      </div>
      {proGated ? (
        <div className="p-5">
          <button className="w-full rounded-xl border border-acc1/30 bg-acc1/5 px-4 py-3 text-[13px] font-bold text-acctxt transition-all hover:bg-acc1/15"
            onClick={() => setUpgrade("The apply tracker and batch export are Pro features.")}>
            🔒 Unlock the tracker to manage every application
          </button>
        </div>
      ) : (
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map(s => {
              const c = trackSummary()[s];
              return (
                <Chip key={s} tone={STATUS_META[s].tone}>
                  {STATUS_META[s].emoji} {STATUS_META[s].label}: {c}
                </Chip>
              );
            })}
          </div>
          {due.length > 0 && (
            <div className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
              <p className="text-[13px] font-extrabold text-warn">📬 {due.length} follow-up{due.length === 1 ? "" : "s"} due</p>
              <p className="mt-0.5 text-[12px] text-fnt">{due.map(d => d.jobId).join(", ")} — open the card, update the status, or snooze the date.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
