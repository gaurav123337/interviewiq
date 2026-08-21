import { useState } from "react";
import type { InterviewRound } from "../../services/applyTrack";
import type { ApplyTrack } from "../../services/applyTrack";
import { toast } from "../../toast";
import { btnGhost, btnPrimary, btnSm, Chip, Modal } from "../ui";
import { saveRound, removeRound } from "../../services/applyTrack";
import { bankFromRound, listBank, removeFromBank, type BankEntry } from "../../services/questionBank";
import { practiceForRound, type DrillCard } from "../../services/drill";
import { getGoal } from "../../services/goal";

export function RoundModal({ track, jobTitle, company, onClose, onChanged }: {
  track: ApplyTrack;
  jobTitle: string;
  company: string;
  onClose: () => void;
  onChanged: (t: ApplyTrack) => void;
}) {
  const [rounds, setRounds] = useState<InterviewRound[]>(() => track.rounds);
  const [bank, setBank] = useState<BankEntry[]>(() => listBank());
  const [bankOpen, setBankOpen] = useState(false);
  const [practice, setPractice] = useState<{ round: InterviewRound; cards: DrillCard[] } | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<InterviewRound | null>(null);
  const [label, setLabel] = useState("");
  const [at, setAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [questions, setQuestions] = useState("");
  const [went, setWent] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<InterviewRound["outcome"]>("pending");

  const startEdit = (r: InterviewRound | null) => {
    /* null = create a new round; editing must hold a truthy stub so the form opens */
    setEditing(r ?? { id: "", label: "", at: Date.now(), questions: "", went: null, outcome: "pending" });
    setLabel(r?.label ?? `Round ${rounds.length + 1}`);
    setAt(r ? new Date(r.at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setQuestions(r?.questions ?? "");
    setWent(r?.went ?? null);
    setOutcome(r?.outcome ?? "pending");
  };

  const save = () => {
    if (!label.trim()) { toast("Name the round (e.g. Phone screen, System design)"); return; }
    const round: InterviewRound = {
      id: editing?.id ?? `r${Date.now()}`,
      label: label.trim(),
      at: new Date(at + "T12:00:00").getTime(),
      questions: questions.trim(),
      went,
      outcome
    };
    const next = saveRound(track.jobId, round);
    setRounds(next.rounds);
    onChanged(next);
    setEditing(null);
    /* auto-collect the round's questions into the personal bank */
    if (round.questions.trim()) {
      const added = bankFromRound(round.questions, company, jobTitle, round.label);
      setBank(listBank());
      toast(added > 0 ? `🎤 Round saved — ${added} question${added === 1 ? "" : "s"} added to your bank` : "🎤 Round saved");
    } else {
      toast("🎤 Round saved");
    }
  };

  const del = (id: string) => {
    const next = removeRound(track.jobId, id);
    if (!next) return;
    setRounds(next.rounds);
    onChanged(next);
    toast("🗑️ Round removed");
  };

  /* a failed/low-rated round → a targeted drill deck from its own notes */
  const startPractice = (r: InterviewRound) => {
    const field = getGoal()?.fieldId ?? "frontend";
    const cards = practiceForRound(r.questions || r.label, field);
    if (!cards.length) { toast("No practice cards found for those topics — try more specific round notes."); return; }
    setPractice({ round: r, cards });
    setFlipped({});
  };

  return (
    <Modal onClose={onClose} title="🎤 Interview rounds" desc={`What was asked, how it went, and what to review next — for ${jobTitle}${company ? ` at ${company}` : ""}.`}>
      {rounds.length === 0 && !editing && (
        <div className="rounded-xl border border-line/15 bg-deep/30 p-4 text-center">
          <p className="text-[12.5px] text-mut">No rounds yet. Add the first one — the prep checklist lives here so you walk into each round knowing what to review.</p>
          <button className={`${btnGhost} ${btnSm} mt-3`} onClick={() => startEdit(null)}>+ Add round</button>
        </div>
      )}

      <div className="space-y-2.5">
        {rounds.map(r => (
          <div key={r.id} className="rounded-xl border border-line/15 bg-deep/30 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-extrabold">{r.label}</span>
                <Chip tone={r.outcome === "passed" ? "ok" : r.outcome === "failed" ? "bad" : "default"}>
                  {r.outcome === "passed" ? "✅ Passed" : r.outcome === "failed" ? "❌ Failed" : "⏳ Pending"}
                </Chip>
                {r.went !== null && <Chip tone="co">{"⭐".repeat(Math.max(1, Math.min(5, r.went)))}</Chip>}
              </div>
              <span className="text-[11px] text-mut">{new Date(r.at).toLocaleDateString()}</span>
            </div>
            {r.questions && <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-fnt">{r.questions}</p>}
            <div className="mt-2 flex gap-3">
              <button className="text-[11.5px] font-bold text-acctxt hover:underline" onClick={() => startEdit(r)}>✏️ Edit</button>
              <button className="text-[11.5px] font-bold text-bad hover:underline" onClick={() => del(r.id)}>🗑️ Remove</button>
              {(r.outcome === "failed" || (r.went !== null && r.went <= 2)) && r.questions.trim() && (
                <button className="text-[11.5px] font-extrabold text-ok hover:underline" onClick={() => startPractice(r)}>🎯 Practice these</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {rounds.length > 0 && !editing && !practice && (
        <button className={`${btnGhost} ${btnSm} mt-3 w-full`} onClick={() => startEdit(null)}>+ Add round</button>
      )}

      {practice && (
        <div className="mt-3 rounded-xl border border-ok/25 bg-ok/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-extrabold text-ok">🎯 Practice deck — “{practice.round.label}”</p>
            <button className="text-[11.5px] font-bold text-mut hover:text-ink" onClick={() => setPractice(null)}>✕ Close</button>
          </div>
          <p className="mt-0.5 text-[11.5px] text-fnt">Rehearse exactly what this round covered — {practice.cards.length} cards pulled from the question bank by your round's notes.</p>
          <div className="mt-3 space-y-2">
            {practice.cards.map(c => {
              const show = flipped[c.q];
              return (
                <div key={c.q} className="rounded-xl border border-line/15 bg-deep/30 p-3">
                  <button className="w-full text-left" onClick={() => setFlipped(f => ({ ...f, [c.q]: !f[c.q] }))}>
                    <span className="text-[12.5px] font-bold text-ink">{c.q}</span>
                    {show && (
                      <span className="mt-1.5 block whitespace-pre-wrap text-[12px] leading-relaxed text-fnt">
                        <span className="font-bold text-ok">Answer:</span> {c.a}
                        {c.kp?.length ? <span className="mt-1 block text-[11px] text-mut">Key points: {c.kp.join(" · ")}</span> : null}
                      </span>
                    )}
                  </button>
                  <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-mut">{show ? "Tap question to hide" : "Tap to reveal the answer"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-3 rounded-xl border border-acc1/25 bg-acc1/5 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Round name</span>
              <input className="inp" value={label} onChange={e => setLabel(e.target.value)} placeholder="Phone screen" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">Date</span>
              <input type="date" className="inp" value={at} onChange={e => setAt(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-mut">What was asked / what to review</span>
            <textarea className="inp h-20 resize-y" value={questions} onChange={e => setQuestions(e.target.value)} placeholder="Questions asked, topics to review before the next round…" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-mut">How it went</span>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} className={`text-[16px] transition-all ${went === n ? "scale-125" : "opacity-40 hover:opacity-80"}`} onClick={() => setWent(went === n ? null : n)}>⭐</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["pending", "passed", "failed"] as const).map(o => (
              <button
                key={o}
                className={`rounded-full px-3 py-1 text-[12px] font-extrabold transition-all ${outcome === o ? "bg-acc1/20 text-acctxt" : "bg-deep/40 text-mut hover:text-ink"}`}
                onClick={() => setOutcome(o)}
              >
                {o === "pending" ? "⏳ Pending" : o === "passed" ? "✅ Passed" : "❌ Failed"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className={btnPrimary + btnSm} onClick={save}>💾 Save round</button>
            <button className={btnGhost + btnSm} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-line/15 bg-deep/30 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-extrabold">📚 My question bank ({bank.length})</p>
          <button className="text-[11px] font-bold text-acctxt hover:underline" onClick={() => setBankOpen(o => !o)}>
            {bankOpen ? "Hide" : "Browse"}
          </button>
        </div>
        <p className="mt-0.5 text-[11px] text-mut">Every question you record in a round lands here — reuse them across applications or practice the ones you struggled with.</p>
        {bankOpen && (
          <div className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto">
            {bank.length === 0 ? (
              <p className="text-[11.5px] text-mut">Nothing yet — save a round with notes and questions get collected automatically.</p>
            ) : (
              bank.map(b => (
                <div key={b.id} className="rounded-lg border border-line/15 bg-deep/40 p-2.5">
                  <p className="text-[12px] font-bold text-ink">{b.question}</p>
                  <p className="mt-0.5 text-[10.5px] text-mut">{b.company} · {b.jobTitle} · {b.roundLabel}</p>
                  <div className="mt-1.5 flex gap-2">
                    <button className="text-[11px] font-bold text-ok hover:underline" onClick={() => {
                      const cards = practiceForRound(b.question, getGoal()?.fieldId ?? "frontend");
                      if (!cards.length) { toast("No cards found for that question — try a more specific one"); return; }
                      setPractice({ round: { id: b.id, label: "Bank question", at: b.at, questions: b.question, went: null, outcome: "pending" }, cards });
                    }}>🎯 Practice</button>
                    <button className="text-[11px] font-bold text-bad hover:underline" onClick={() => { removeFromBank(b.id); setBank(listBank()); toast("🗑️ Removed from bank"); }}>Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-[11.5px] text-mut">Rounds sync to your account like the rest of the tracker — review this checklist before each round and you'll walk in knowing exactly what to brush up.</p>
      <button className="mt-4 w-full rounded-xl bg-deep/40 py-2.5 text-[13px] font-bold text-mut hover:text-ink" onClick={onClose}>
        Done — close
      </button>
    </Modal>
  );
}
