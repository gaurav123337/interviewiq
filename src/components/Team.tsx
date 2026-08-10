import { useEffect, useState } from "react";
import { useApp } from "../store";
import { CONFIG } from "../config";
import { getCloudState, subscribeCloud, type CloudState } from "../services/cloud";
import {
  acceptInvite, confirmBumpSeats, createTeam, deleteTeam, getTeamsState, inviteMember, leaveTeam,
  openTeamUpgradeLink, refresh, removeMember, selectTeam, subscribeTeams, type TeamsState
} from "../services/teams";
import { toast } from "../toast";
import { btnDanger, btnGhost, btnOk, btnPrimary, btnSm, cardCls, Chip, EmptyState, Modal } from "./ui";

export function Team() {
  const { nav } = useApp();
  const [cloud, setCloud] = useState<CloudState>(() => getCloudState());
  const [ts, setTs] = useState<TeamsState>(() => getTeamsState());
  const [teamName, setTeamName] = useState("");
  const [seats, setSeats] = useState(5);
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bumpSeats, setBumpSeats] = useState(5);
  const [bumpPending, setBumpPending] = useState(() => sessionStorage.getItem("iq.teamUpgrade"));

  useEffect(() => subscribeCloud(setCloud), []);
  useEffect(() => subscribeTeams(setTs), []);
  useEffect(() => { if (cloud.user) void refresh(); }, [cloud.user]);

  const signedIn = !!cloud.user;

  const doCreate = async () => {
    if (!teamName.trim()) { toast("Give the team a name"); return; }
    setBusy(true);
    try {
      const r = await createTeam(teamName.trim(), seats);
      toast(r.ok ? "🏢 Team created — invite your members" : "✗ " + (r.error ?? "Failed"));
      if (r.ok) { setTeamName(""); }
    } finally { setBusy(false); }
  };

  const doInvite = async () => {
    if (!inviteEmail.trim()) { toast("Enter a team member's email"); return; }
    setBusy(true);
    try {
      const r = await inviteMember(inviteEmail.trim());
      toast(r.ok ? "📨 Invite sent — they'll claim the seat on sign-in" : "✗ " + (r.error ?? "Failed"));
      if (r.ok) setInviteEmail("");
    } finally { setBusy(false); }
  };

  const active = ts.teams.find(t => t.teamId === ts.activeTeamId) ?? null;
  const isAdmin = active && (active.role === "owner" || active.role === "admin");
  const seatsLeft = active ? Math.max(0, active.seats - active.members) : 0;

  return (
    <div className="anim-view mx-auto max-w-[820px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🏢 Teams</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Interview prep for your <span className="grad-text">whole team</span>.</h1>
        <p className="mx-auto mt-2 max-w-[540px] text-[14.5px] text-mut">
          Buy seats, invite engineers, and every member unlocks <span className="font-bold text-ink">Pro</span> — unlimited sessions, AI coaching and voice mode. One dashboard, one bill.
        </p>
      </div>

      {!signedIn ? (
        <div className="mt-8">
          <EmptyState icon="🔐" title="Sign in to manage your team">
            <p className="mx-auto max-w-[420px] text-[13.5px] text-mut">
              Teams work through your cloud account. Head to Settings and sign in with email, Google or GitHub — then come back here to create your team.
            </p>
            <button className={btnPrimary + " mt-4"} onClick={() => nav("settings")}>Go to Settings →</button>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-7 space-y-5">
          {/* seat entitlement banner */}
          <div className={`${cardCls} flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-acc1 p-5`}>
            <div>
              <div className="flex items-center gap-2 text-[14.5px] font-extrabold">
                {ts.proBySeat ? "💎 Pro is active through your team" : "Team plan"}
                {ts.proBySeat && <Chip tone="ok">PRO BY SEAT</Chip>}
              </div>
              <p className="mt-1 text-[12.5px] text-mut">
                {ts.proBySeat
                  ? "Every active member gets unlimited sessions, AI coaching and voice mode — no per-person licenses."
                  : "Join or create a team and every seat unlocks Pro automatically."}
              </p>
            </div>
            {ts.proBySeat && <Chip tone="co">Unlimited</Chip>}
          </div>

          {/* pending invites */}
          {ts.pending.length > 0 && (
            <section className={`${cardCls} p-5`}>
              <h2 className="text-[15px] font-extrabold">📨 You've been invited</h2>
              <div className="mt-3 space-y-2.5">
                {ts.pending.map(p => (
                  <div key={p.teamId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/10 bg-wht/5 px-4 py-3">
                    <div>
                      <div className="text-[14px] font-bold">{p.teamName}</div>
                      <div className="text-[12px] text-mut">Accept to claim your Pro seat</div>
                    </div>
                    <button
                      className={btnPrimary + btnSm}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await acceptInvite(p.teamId);
                          toast(r.ok ? "🎉 Welcome to the team — Pro unlocked" : "✗ " + (r.error ?? "Failed"));
                        } finally { setBusy(false); }
                      }}
                    >Accept invite</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* create team */}
          {ts.teams.length === 0 && (
            <section className={`${cardCls} p-5`}>
              <h2 className="text-[15px] font-extrabold">Create your first team</h2>
              <p className="mb-4 mt-1 text-[12.5px] text-mut">Start with a few seats — you can add more any time.</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[220px] flex-1">
                  <span className="mb-1 block text-[12px] font-bold text-mut">Team name</span>
                  <input
                    value={teamName} onChange={e => setTeamName(e.target.value)}
                    placeholder="Acme Engineering"
                    className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-[12px] font-bold text-mut">Seats</span>
                  <input
                    type="number" min={1} max={500} value={seats}
                    onChange={e => setSeats(Number(e.target.value) || 1)}
                    className="w-[110px] rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[13.5px] focus:border-acc1/80 focus:outline-none"
                  />
                </label>
                <button className={btnPrimary + btnSm} onClick={doCreate} disabled={busy}>
                  {busy ? <><span className="spinner" />…</> : "Create team"}
                </button>
              </div>
            </section>
          )}

          {/* teams + roster */}
          {ts.teams.length > 0 && (
            <section className={`${cardCls} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-extrabold">Your teams</h2>
                <div className="flex flex-wrap gap-2">
                  {ts.teams.map(t => (
                    <button
                      key={t.teamId}
                      onClick={() => selectTeam(t.teamId)}
                      className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-all ${t.teamId === ts.activeTeamId ? "grad-bg text-white" : "border border-line/15 bg-wht/10 hover:bg-wht/20"}`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {active && (
                <div className="mt-4 space-y-4">
                  {/* seats bar + upgrade */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                      <span className="font-bold text-mut">Seats</span>
                      <span className="font-bold">{active.members}/{active.seats} used{seatsLeft > 0 ? ` · ${seatsLeft} open` : " · full"}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-wht/10">
                      <div
                        className={`h-full rounded-full transition-all ${seatsLeft === 0 ? "grad-bg" : "grad-bg-soft"}`}
                        style={{ width: `${Math.min(100, (active.members / Math.max(1, active.seats)) * 100)}%` }}
                      />
                    </div>
                    {isAdmin && (
                      <div className="mt-3 flex flex-wrap items-end gap-2.5 rounded-xl border border-line/10 bg-wht/5 p-3">
                        <label>
                          <span className="mb-1 block text-[11.5px] font-bold text-mut">Add seats</span>
                          <input type="number" min={1} max={100} value={bumpSeats} onChange={e => setBumpSeats(Number(e.target.value) || 1)}
                            className="w-[100px] rounded-xl border border-line/15 bg-deep/80 px-3 py-2 text-[13px] focus:border-acc1/80 focus:outline-none" />
                        </label>
                        <button className={btnPrimary + btnSm} onClick={() => { openTeamUpgradeLink(bumpSeats); setBumpPending(String(bumpSeats)); }}>
                          💳 Buy seats
                        </button>
                        {bumpPending && (
                          <button className={btnOk + btnSm} onClick={async () => {
                            const r = await confirmBumpSeats(Number(bumpPending));
                            toast(r.ok ? `✅ ${bumpPending} seats added` : "✗ " + (r.error ?? "Failed"));
                            if (r.ok) { sessionStorage.removeItem("iq.teamUpgrade"); setBumpPending(null); }
                          }}>
                            ✅ I've paid — confirm
                          </button>
                        )}
                        {!CONFIG.teamProUrl && !CONFIG.proUrl && (
                          <p className="w-full text-[11.5px] text-fnt">
                            💡 Set <span className="font-mono">CONFIG.teamProUrl</span> to enable instant checkout — for now, your email app opens.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* invite (admin only) */}
                  {isAdmin && (
                    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line/10 bg-wht/5 p-4">
                      <label className="min-w-[220px] flex-1">
                        <span className="mb-1 block text-[12px] font-bold text-mut">Invite by email</span>
                        <input
                          value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                          placeholder="engineer@company.com"
                          disabled={seatsLeft === 0}
                          className="w-full rounded-xl border border-line/15 bg-deep/80 px-4 py-2.5 text-[13.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20 disabled:opacity-50"
                        />
                      </label>
                      <button className={btnPrimary + btnSm} onClick={doInvite} disabled={busy || seatsLeft === 0}>
                        {busy ? <><span className="spinner" />…</> : seatsLeft === 0 ? "No seats left" : "Send invite"}
                      </button>
                    </div>
                  )}

                  {/* roster */}
                  <div className="space-y-2">
                    {ts.roster.length === 0 && <p className="text-[13px] text-mut">Loading members…</p>}
                    {ts.roster.map(m => (
                      <div key={m.userId ?? m.invitedEmail ?? m.email} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/10 bg-wht/5 px-4 py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[13.5px] font-bold">
                            <span className="truncate">{m.email ?? m.invitedEmail ?? "—"}</span>
                            {m.role === "owner" && <Chip tone="co">OWNER</Chip>}
                            {m.role === "admin" && <Chip tone="co">ADMIN</Chip>}
                            {m.status === "invited" && <Chip>PENDING</Chip>}
                          </div>
                          <div className="text-[11.5px] text-mut">
                            {m.status === "invited" ? "Invited — joins on sign-in" : "Active member"}
                          </div>
                        </div>
                        {isAdmin && m.role !== "owner" && m.userId && (
                          <button
                            className={btnDanger + btnSm}
                            onClick={async () => {
                              const r = await removeMember(m.userId!);
                              toast(r.ok ? "Member removed" : "✗ " + (r.error ?? "Failed"));
                            }}
                          >Remove</button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* audit log */}
                  {ts.auditLog.length > 0 && (
                    <div className="border-t border-line/10 pt-4">
                      <h4 className="mb-2 text-[12.5px] font-bold uppercase tracking-wider text-mut">📋 Activity log</h4>
                      <div className="space-y-1.5">
                        {ts.auditLog.slice(0, 10).map(e => (
                          <div key={e.id} className="flex items-center gap-2 text-[12px] text-mut">
                            <span className="font-bold text-ink">
                              {e.kind === "seats_bumped" ? "💳" : "📝"}
                            </span>
                            <span className="flex-1">
                              {e.kind === "seats_bumped"
                                ? `Seats increased by ${String(e.meta.extra ?? "")} (${String(e.meta.old ?? "")} → ${String(e.meta.new ?? "")})`
                                : e.kind}
                            </span>
                            <span className="text-[11px]">{e.actor}</span>
                            <span className="text-[11px]">{e.createdAt.slice(0, 10)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* owner actions */}
                  {active.role === "owner" && (
                    <div className="flex flex-wrap gap-2.5 border-t border-line/10 pt-4">
                      <button className={btnDanger + btnSm} onClick={() => setConfirmDelete(true)}>🗑 Delete team</button>
                    </div>
                  )}
                  {active.role !== "owner" && (
                    <div className="flex flex-wrap gap-2.5 border-t border-line/10 pt-4">
                      <button
                        className={btnGhost + btnSm}
                        onClick={async () => {
                          const r = await leaveTeam(active.teamId);
                          toast(r.ok ? "You left the team" : "✗ " + (r.error ?? "Failed"));
                        }}
                      >Leave team</button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {ts.error && <p className="text-center text-[12.5px] text-bad">⚠️ {ts.error}</p>}
        </div>
      )}

      {confirmDelete && active && (
        <Modal
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${active.name}?`}
          desc="Removes the team and every member's Pro seat. This cannot be undone."
        >
          <div className="flex gap-3">
            <button className={btnGhost} onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button
              className={btnDanger}
              onClick={async () => {
                setConfirmDelete(false);
                const r = await deleteTeam(active.teamId);
                toast(r.ok ? "Team deleted" : "✗ " + (r.error ?? "Failed"));
              }}
            >Yes, delete team</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
