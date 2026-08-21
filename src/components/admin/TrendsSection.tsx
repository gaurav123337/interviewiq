/* TrendsSection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import { adminDecisionProposal, adminPendingProposals, type UpdateProposalRow } from "../../services/trendSignals";
import { toast } from "../../toast";
import { btnOk, btnGhost, btnSm, cardCls, Chip } from "../ui";

/* ------------------------------------------------------------------ */
/* Trends — the admin gate for structural catalog proposals            */
/* ------------------------------------------------------------------ */

export function TrendsSection() {
  const [rows, setRows] = useState<UpdateProposalRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      setRows(await adminPendingProposals());
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const decide = async (p: UpdateProposalRow, decision: "accepted" | "ignored") => {
    setBusy(true);
    try {
      const r = await adminDecisionProposal(p.id, decision);
      if (!r.ok) { toast("✗ " + (r.error ?? "Couldn't update")); return; }
      toast(decision === "accepted" ? "✅ Accepted — catalog change recorded" : "🙈 Ignored");
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <h2 className="text-[16px] font-extrabold">📈 Market-trend proposals</h2>
        <p className="mt-0.5 max-w-[680px] text-[12.5px] text-mut">
          Each week the trends-refresh sweep measures skill demand in our job corpus (+ npm/GitHub signals).
          Badges in the Skill Counselor update automatically; structural changes (promote/demote/review) are
          proposed here and need your recorded decision. Requires supabase/trends.sql (scripts/setup-security.js).
        </p>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-5`}>
          <p className="text-[13px] text-mut">No pending proposals right now — the last sweep found no stage crossings, or the trends tables aren't applied yet.</p>
        </div>
      ) : (
        rows.map(p => (
          <div key={p.id} className={`${cardCls} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] font-extrabold">{p.skill_id}</span>
                  <Chip tone={p.kind === "demote" ? "bad" : p.kind === "promote" ? "ok" : "warn"}>{p.kind}</Chip>
                  <Chip>pending</Chip>
                  <span className="text-[11.5px] text-fnt">{new Date(p.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink">{p.reason}</p>
                <pre className="mt-2 max-h-[160px] overflow-auto whitespace-pre-wrap rounded-lg bg-deep/50 p-2 font-mono text-[10.5px] text-fnt">
                  {JSON.stringify(p.signals, null, 2)}
                </pre>
              </div>
              <div className="flex flex-none gap-2">
                <button className={btnOk + btnSm} disabled={busy} onClick={() => void decide(p, "accepted")}>✓ Accept</button>
                <button className={btnGhost + btnSm} disabled={busy} onClick={() => void decide(p, "ignored")}>Ignore</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
