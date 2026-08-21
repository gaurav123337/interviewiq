/* ResourcesSection — extracted from Admin.tsx */

import { useEffect, useState } from "react";
import { pendingCommunityResources, reviewResource, type ResourceRow } from "../../services/resources";
import { toast } from "../../toast";
import { btnOk, btnGhost, btnDanger, btnSm, cardCls, Chip } from "../ui";

/* ------------------------------------------------------------------ */
/* Resources — the L4 human gate for community submissions             */
/* ------------------------------------------------------------------ */

export function ResourcesSection() {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = async () => {
    setBusy(true);
    try {
      setRows(await pendingCommunityResources());
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Failed to load submissions"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const decide = async (r: ResourceRow, decision: "approved" | "rejected" | "quarantined") => {
    setBusy(true);
    try {
      const res = await reviewResource(r.id, decision, note[r.id] ?? "");
      if (!res.ok) { toast("✗ " + (res.error ?? "Couldn't update")); return; }
      toast(decision === "approved" ? "✅ Approved — now in the community library" : decision === "rejected" ? "🚫 Rejected" : "⛔ Quarantined");
      await load();
    } catch (e) {
      toast("✗ " + ((e as Error).message || "Couldn't update"));
    } finally {
      setBusy(false);
    }
  };

  const guardChips = (r: ResourceRow) => {
    const g = r.guard;
    if (!g) return null;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Chip tone={g.status === "ok" ? "ok" : g.status === "pending" ? "warn" : "bad"}>guard: {g.status}</Chip>
        {g.finalUrl && <Chip>final: {g.finalUrl.slice(0, 60)}</Chip>}
        {g.checkedAt && <Chip>checked {new Date(g.checkedAt).toLocaleString()}</Chip>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-extrabold">🔗 Community submissions — human gate</h2>
            <p className="mt-0.5 max-w-[680px] text-[12.5px] text-mut">
              Every link already passed the safety guard (SSRF-safe fetch, Safe Browsing + URLhaus). Your decision is the
              recorded L4 gate: <span className="font-bold">nothing becomes app-wide without it</span>. Requires MFA when admin enforcement is on.
            </p>
          </div>
          <button className={btnGhost + btnSm} onClick={() => void load()} disabled={busy}>Refresh</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-5`}>
          <p className="text-[13px] text-mut">No pending or quarantined submissions right now. (Requires supabase/resources.sql — run scripts/setup-security.js.)</p>
        </div>
      ) : (
        rows.map(r => (
          <div key={r.id} className={`${cardCls} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-bold text-acctxt hover:underline">{r.title}</a>
                  <Chip tone={r.status === "quarantined" ? "bad" : "warn"}>{r.status}</Chip>
                  <Chip>{r.category}</Chip>
                  {r.flags > 0 && <Chip tone="bad">🚩 {r.flags} report{r.flags === 1 ? "" : "s"}</Chip>}
                </div>
                {r.description && <p className="mt-1 text-[12.5px] text-mut">{r.description}</p>}
                <p className="mt-1 truncate text-[11.5px] text-fnt">{r.url}</p>
                <p className="mt-0.5 text-[11.5px] text-fnt">suggested by {r.suggested_by ?? "unknown"} · {new Date(r.created_at).toLocaleString()}</p>
                {guardChips(r)}
              </div>
              <div className="flex flex-none flex-col items-end gap-2">
                <button className={btnGhost + btnSm} onClick={() => setOpen(open === r.id ? null : r.id)}>Guard evidence</button>
                <div className="flex gap-2">
                  <button className={btnOk + btnSm} disabled={busy} onClick={() => void decide(r, "approved")}>✓ Approve</button>
                  <button className={btnDanger + btnSm} disabled={busy} onClick={() => void decide(r, "rejected")}>✕ Reject</button>
                  {r.status === "approved" && (
                    <button className={btnDanger + btnSm} disabled={busy} onClick={() => void decide(r, "quarantined")}>⛔ Quarantine</button>
                  )}
                </div>
              </div>
            </div>
            {open === r.id && (
              <div className="mt-3 rounded-xl border border-line/10 bg-deep/50 p-3">
                <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap font-mono text-[11px] text-fnt">
                  {JSON.stringify(r.guard ?? {}, null, 2)}
                </pre>
                <input
                  value={note[r.id] ?? ""}
                  onChange={e => setNote(n => ({ ...n, [r.id]: e.target.value }))}
                  maxLength={300}
                  placeholder="Note for the audit log (optional)"
                  className="mt-2 w-full rounded-lg border border-line/15 bg-deep/80 px-3 py-1.5 text-[12.5px] text-ink placeholder:text-fnt focus:border-acc1/80 focus:outline-none"
                />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
