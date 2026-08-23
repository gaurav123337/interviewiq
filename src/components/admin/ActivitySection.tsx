/* ActivitySection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import type { LevelId } from "../../types";
import { FIELDS, LEVELS } from "../../data";
import { listQuestionAudit, createQuestion, updateQuestion, type AuditEntry } from "../../services/admin";
import { toast } from "../../toast";
import { btnGhost, btnSm, cardCls, Chip } from "../ui";

/* ------------------------------------------------------------------ */
/* Activity — question-bank change history + rollback                  */
/* ------------------------------------------------------------------ */

export function ActivitySection({ busy, setBusy }: { busy: boolean; setBusy: (b: boolean) => void }) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    void listQuestionAudit().then(setAudit).catch(() => setAudit([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const restoreUpdate = async (e: AuditEntry) => {
    const before = e.diff.before;
    if (!before || e.question_id == null) { toast("Nothing to restore"); return; }
    setBusy(true);
    try {
      await updateQuestion(e.question_id, {
        fieldId: before.field_id, level: before.level as LevelId,
        question: before.question, answer: before.answer, keyPoints: before.key_points ?? []
      });
      toast("↩ Restored the previous version");
      load();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  const restoreDelete = async (e: AuditEntry) => {
    const row = e.diff.row;
    if (!row || !row.question) { toast("Nothing to restore"); return; }
    setBusy(true);
    try {
      await createQuestion({
        fieldId: row.field_id ?? "general", level: (row.level ?? "mid") as LevelId,
        question: row.question, answer: row.answer ?? "", keyPoints: row.key_points ?? [], published: false
      });
      toast("↩ Restored as a draft — publish it to bring it back live");
      load();
    } catch (err) { toast("✗ " + ((err as Error).message || "Failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="text-[16px] font-extrabold">🧾 Question-bank activity ({audit.length})</h2>
          <p className="text-[12.5px] text-mut">
            Every create, edit, publish and delete — including weekly scraper imports. Restore an edit
            or bring back a deleted question from here.
          </p>
        </div>
        <button className={btnGhost + btnSm} onClick={load} disabled={busy}>↻ Refresh</button>
      </div>
      {loading && <p className="mt-4 text-[12.5px] text-ink"><span className="spinner" /> Loading…</p>}
      {!loading && audit.length === 0 && <p className="mt-4 text-[13px] text-mut">No changes logged yet — bank edits appear here as they happen.</p>}
      {!loading && audit.length > 0 && (
        <div className="mt-4 space-y-2">
          {audit.map(e => (
            <div key={e.id} className="rounded-xl border border-line/10 bg-wht/5 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={e.action === "create" ? "ok" : e.action === "update" ? "warn" : "bad"}>
                  {e.action === "create" ? "＋ create" : e.action === "update" ? "✏️ update" : "🗑 delete"}
                </Chip>
                {e.field_id && <Chip tone="cat">{FIELDS.find(f => f.id === e.field_id)?.name ?? e.field_id}</Chip>}
                {e.level && <Chip tone="lvl">{LEVELS.find(l => l.id === e.level)?.name ?? e.level}</Chip>}
                <span className="min-w-[160px] flex-1 truncate text-[13px] font-bold">{e.question}</span>
                <span className="text-[11.5px] text-ink">{e.actor === "system" ? "🤖 scraper" : e.actor}</span>
                <span className="text-[11.5px] text-ink">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              {(e.action === "update" || e.action === "delete") && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer text-[11.5px] font-bold text-acc3">
                      {e.action === "delete" ? "View deleted content" : "View before → after"}
                    </summary>
                    <div className="mt-1.5 space-y-1.5 rounded-lg bg-panel2/50 p-2.5 text-[12px]">
                      {e.action === "delete" && e.diff.row && (
                        <p className="whitespace-pre-wrap text-mut">
                          <span className="font-bold text-ink">{e.diff.row.question}</span>
                          {e.diff.row.answer ? `\n${e.diff.row.answer}` : ""}
                          {e.diff.row.key_points?.length ? `\nKey points: ${e.diff.row.key_points.join(", ")}` : ""}
                        </p>
                      )}
                      {e.action === "update" && e.diff.before && e.diff.after && (
                        <>
                          <p className="text-mut"><span className="font-bold text-warn">BEFORE:</span> {e.diff.before.question} — {e.diff.before.answer?.slice(0, 80) ?? ""}</p>
                          <p className="text-mut"><span className="font-bold text-ok">AFTER:</span> {e.diff.after.question} — {e.diff.after.answer?.slice(0, 80) ?? ""}</p>
                        </>
                      )}
                    </div>
                  </details>
                  <button className={btnGhost + btnSm} onClick={() => (e.action === "delete" ? restoreDelete(e) : restoreUpdate(e))} disabled={busy}>
                    ↩ Restore
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
