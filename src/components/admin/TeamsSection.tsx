/* TeamsSection — extracted from Admin.tsx */

import { useState } from "react";
import { selectTeam, type TeamsState } from "../../services/teams";
import { cardCls, ProgressBar } from "../ui";

/* ------------------------------------------------------------------ */
/* Admin teams — team analytics section                                */
/* ------------------------------------------------------------------ */

export function TeamsSection({ teamState }: { teamState: TeamsState }) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  if (!teamState.teams.length) {
    return (
      <div className={`${cardCls} flex flex-col items-center px-6 py-10 text-center`}>
        <div className="text-[36px]">🏢</div>
        <h2 className="mt-2 text-base font-extrabold">No teams yet</h2>
        <p className="mx-auto mt-1 max-w-[400px] text-[13px] text-mut">
          Teams are created from the 🏢 Team view (More menu) by signed-in users — once any exists, their analytics show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {teamState.teams.map(t => (
        <div key={t.teamId} className={`${cardCls} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-3 p-5">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[15.5px] font-extrabold">
                {t.name}
                {t.role === "owner" ? <span className="rounded-full border border-co/40 bg-co/15 px-2 py-0.5 text-[10px] font-bold text-co">OWNER</span> : <span className="text-[12px] text-mut">· {t.role}</span>}
              </div>
              <div className="mt-1 text-[12.5px] text-mut">{t.members}/{t.seats} seats used</div>
            </div>
            <button
              onClick={() => { selectTeam(t.teamId); setExpandedTeam(expandedTeam === t.teamId ? null : t.teamId); }}
              className="rounded-lg border border-line/20 px-3 py-1.5 text-[12.5px] font-bold text-mut hover:bg-wht/10"
            >
              {expandedTeam === t.teamId ? "△ Collapse" : "▽ View members"}
            </button>
          </div>
          {/* seat utilization bar */}
          <div className="border-t border-line/10 bg-wht/[.03] px-5 py-3">
            <div className="flex items-center justify-between text-[12px] text-mut">
              <span>Seat utilization</span>
              <span>{Math.round((t.members / Math.max(1, t.seats)) * 100)}%</span>
            </div>
            <ProgressBar widthPct={Math.min(100, (t.members / Math.max(1, t.seats)) * 100)} height="h-2.5" className="mt-1" />
          </div>
          {expandedTeam === t.teamId && (
            <div className="border-t border-line/10 px-5 py-3">
              <h4 className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-mut">Members</h4>
              {teamState.roster.length === 0 && <p className="text-[12px] text-mut">Loading…</p>}
              {teamState.roster.map(m => (
                <div key={m.userId ?? m.invitedEmail ?? m.email} className="flex items-center gap-2 py-1.5 text-[13px]">
                  <span className="h-2 w-2 rounded-full bg-ok" />
                  <span className="flex-1 font-bold">{m.email ?? m.invitedEmail ?? "—"}</span>
                  <span className="text-mut">{m.status}</span>
                  {m.status === "active" && <span className="text-[11px] text-ok">active</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
