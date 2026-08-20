import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FIELDS, LEVELS, levelById } from "../data";
import type { LevelId } from "../types";
import { bankItems } from "../engine";
import { useApp } from "../store";
import { listBank, practiceDeck, removeFromBank, weakestBankEntries, type BankEntry } from "../services/questionBank";
import { getSrs, learnedCount, practiceForRound, rate, type DrillCard, type Rating } from "../services/drill";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSoft, btnSm, cardCls, Chip, KpNeutral } from "./ui";

/* per-card thinking time in the timed session */
const THINK_SECONDS = 45;

export function Bank() {
  const { state, practice } = useApp();
  const [q, setQ] = useState("");
  const [fieldSel, setFieldSel] = useState(state.ob.field ?? FIELDS[0].id);
  const [lvlSel, setLvlSel] = useState<LevelId | "all">("all");
  /* personal bank (Apply Kit) — questions collected from your interview rounds */
  const [bank, setBank] = useState<BankEntry[]>(() => listBank());
  const [weakOnly, setWeakOnly] = useState(false);
  /* timed practice session state */
  const [deck, setDeck] = useState<DrillCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(THINK_SECONDS);
  const [score, setScore] = useState(0);
  const [rated, setRated] = useState(0);
  const [learned, setLearned] = useState(learnedCount(getSrs()));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { field, items } = useMemo(() => bankItems(fieldSel, q), [fieldSel, q]);
  const shown = lvlSel === "all" ? items : items.filter(i => i.lvl === lvlSel);
  const bankShown = useMemo(() => (weakOnly ? weakestBankEntries() : listBank()), [weakOnly, bank]);
  const weakCount = useMemo(() => weakestBankEntries().length, [bank]);

  /* countdown: runs while a card is showing face-down; hits 0 → auto-reveal */
  useEffect(() => {
    if (!deck || deck.length === 0) return;
    if (flipped) { if (timer.current) { clearInterval(timer.current); timer.current = null; } return; }
    setSecondsLeft(THINK_SECONDS);
    timer.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          if (timer.current) { clearInterval(timer.current); timer.current = null; }
          setFlipped(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  }, [deck, idx, flipped]);

  const startDeck = (opts: { weakest?: boolean }) => {
    const cards = practiceDeck(fieldSel, lvlSel, { weakest: opts.weakest, count: 10 });
    if (!cards.length) { toast(opts.weakest ? "No weak-topic cards yet — mark a round failed or ⭐⭐ and it'll land here." : "Add questions to your bank first — save an interview round with notes."); return; }
    beginSession(cards);
  };

  const beginSession = (cards: DrillCard[]) => {
    setDeck(cards);
    setIdx(0);
    setFlipped(false);
    setScore(0);
    setRated(0);
    setSecondsLeft(THINK_SECONDS);
    setLearned(learnedCount(getSrs()));
  };

  /* SRS rating — same ladder as Drill mode; again keeps the card in-session */
  const rateCard = (r: Rating) => {
    if (!deck) return;
    const card = deck[idx];
    rate(card.q, r);
    const pts = r === "easy" ? 1 : r === "good" ? 0.8 : r === "hard" ? 0.5 : 0;
    setScore(s => s + pts);
    setRated(n => n + 1);
    if (r === "again") {
      setDeck(d => (d ? [...d.slice(1), d[0]] : d));
    } else {
      setDeck(d => (d ? d.slice(0, idx).concat(d.slice(idx + 1)) : d));
      setLearned(learnedCount(getSrs()));
    }
    setIdx(0);
    setFlipped(false);
  };

  const card = deck && deck.length > 0 ? deck[Math.min(idx, deck.length - 1)] : null;

  return (
    <div className="anim-view">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">📚 Question Bank</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Every question, <span className="grad-text">with solutions</span>.</h1>
        <p className="mx-auto mt-2 max-w-[600px] text-[14.5px] text-mut">Browse {FIELDS.length} fields × {LEVELS.length} levels of technical questions with model answers and key points.</p>
      </div>

      {/* toolbar */}
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]">🔍</span>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search questions, topics, keywords…"
            className="w-full rounded-xl border border-line/15 bg-deep/80 py-2.5 pl-10 pr-4 text-[14px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
          />
        </div>
        <select
          value={fieldSel}
          onChange={e => { setFieldSel(e.target.value); setLvlSel("all"); }}
          className="rounded-xl border border-line/15 bg-deep/80 px-3.5 py-2.5 text-[14px] font-semibold focus:border-acc1/80 focus:outline-none"
        >
          {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
        </select>
      </div>

      {/* level filter */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <FilterChip active={lvlSel === "all"} onClick={() => setLvlSel("all")}>All levels</FilterChip>
        {LEVELS.map(l => (
          <FilterChip key={l.id} active={lvlSel === l.id} onClick={() => setLvlSel(l.id)}>{l.icon} {l.name}</FilterChip>
        ))}
      </div>

      {shown.length > 0 && (
        <div className="mb-3 mt-4"><Chip>{shown.length} question{shown.length === 1 ? "" : "s"} · {field?.name ?? ""}</Chip></div>
      )}

      {/* personal bank — questions you recorded from real interview rounds */}
      <div className={`${cardCls} mt-6 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 p-5">
          <div>
            <h2 className="text-[16px] font-extrabold">📚 My question bank ({bank.length})</h2>
            <p className="mt-0.5 text-[12px] text-mut">Every question you record in an interview round (Jobs → Rounds) lands here — practice the ones you struggled with, or drill everything.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btnSoft + btnSm} disabled={!bank.length} onClick={() => startDeck({})}>🎯 Practice all</button>
            <button className={btnPrimary + btnSm} disabled={!weakCount} onClick={() => startDeck({ weakest: true })} title={`${weakCount} question${weakCount === 1 ? "" : "s"} from failed/⭐⭐ rounds`}>
              🎯 Practice weakest{weakCount > 0 ? ` (${weakCount})` : ""}
            </button>
          </div>
        </div>
        <div className="p-5">
          <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-bold">
            <input type="checkbox" className="h-4 w-4 accent-[#6366f1]" checked={weakOnly} onChange={e => setWeakOnly(e.target.checked)} />
            Weakest only — from rounds marked failed or ⭐⭐ or lower
          </label>

          {/* timed session */}
          {deck && card && (
            <div className="mb-4 rounded-xl border border-ok/25 bg-ok/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-extrabold text-ok">⚡ Timed session{weakOnly ? " — weakest topics" : " — from your bank"}</p>
                <div className="flex items-center gap-3 text-[11.5px] font-bold text-mut">
                  <span>Card {Math.min(idx + 1, deck.length)} of {deck.length}</span>
                  <span>{rated} rated · score {deck.length ? Math.round((score / deck.length) * 100) : 0}%</span>
                  <span>{learned} learned</span>
                  <button className="font-bold text-mut hover:text-ink" onClick={() => setDeck(null)}>✕ End</button>
                </div>
              </div>
              <p className="mt-0.5 text-[11.5px] text-fnt">Matched against the {field?.name ?? fieldSel} bank by the keywords in your recorded questions. Think it through before the timer hits zero — answers feed the same spaced-repetition schedule as Drill mode.</p>

              {/* flashcard + countdown */}
              <button
                type="button"
                onClick={() => { setFlipped(f => !f); if (timer.current) { clearInterval(timer.current); timer.current = null; } }}
                className="mt-3 block w-full min-h-[200px] rounded-xl border border-line/15 bg-deep/40 p-5 text-left transition-transform hover:-translate-y-0.5"
              >
                {!flipped ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Chip tone="lvl">{levelById(card.lvl).icon} {levelById(card.lvl).name}</Chip>
                      <Chip tone={secondsLeft <= 10 ? "bad" : "default"}>{secondsLeft}s to answer</Chip>
                      <Chip>Tap to reveal</Chip>
                    </div>
                    <p className="text-[16px] font-bold leading-[1.5] tracking-tight">{card.q}</p>
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-[12px] font-semibold text-fnt">{card.q}</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <Chip tone="cat">Model answer</Chip>
                      <Chip tone="ok">Key points</Chip>
                    </div>
                    <p className="whitespace-pre-wrap text-[13.5px] leading-[1.7] text-ink">{card.a}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(card.kp || []).map(k => <KpNeutral key={k}>{k}</KpNeutral>)}
                    </div>
                  </>
                )}
              </button>

              <div className="mt-3 flex flex-wrap justify-center gap-3">
                {!flipped ? (
                  <button className={btnGhost + " px-5 py-2.5 text-[14px]"} onClick={() => { setFlipped(true); if (timer.current) { clearInterval(timer.current); timer.current = null; } }}>👁 Reveal answer</button>
                ) : (
                  <>
                    <button className={btnGhost + " px-4 py-2 text-[13px]"} onClick={() => rateCard("again")} title="Review again soon">🔄 Again</button>
                    <button className={btnGhost + " px-4 py-2 text-[13px]"} onClick={() => rateCard("hard")} title="Review again tomorrow">😓 Hard</button>
                    <button className={btnSoft + " px-4 py-2 text-[13px]"} onClick={() => rateCard("good")} title="Review again in 3 days">🙂 Good</button>
                    <button className={btnPrimary + " px-4 py-2 text-[13px]"} onClick={() => rateCard("easy")} title="Review again in a week">✅ Easy</button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* session complete */}
          {deck && !card && (
            <div className="mb-4 rounded-xl border border-ok/25 bg-ok/5 p-6 text-center">
              <div className="text-[32px]">🎉</div>
              <p className="mt-1 text-[15px] font-extrabold text-ok">Session complete!</p>
              <p className="mt-1 text-[12.5px] text-mut">
                {rated} cards rated · score <span className="font-extrabold text-ink">{rated ? Math.round((score / rated) * 100) : 0}%</span> · {learned} total learned
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <button className={btnPrimary + btnSm} onClick={() => startDeck({ weakest: weakOnly })}>🔁 New session</button>
                <button className={btnGhost + btnSm} onClick={() => setDeck(null)}>Done</button>
              </div>
            </div>
          )}

          {bankShown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line/20 p-6 text-center">
              <div className="text-[26px]">🗒️</div>
              <p className="mt-1 text-[13px] font-bold">{weakOnly ? "No weak-topic questions yet" : "No questions recorded yet"}</p>
              <p className="mx-auto mt-1 max-w-[400px] text-[12px] text-mut">
                {weakOnly
                  ? "Mark an interview round as failed or ⭐⭐ and its questions get flagged here automatically."
                  : "Open a job → 🎤 Rounds → add a round with the questions that were asked — they land here, deduped across applications."}
              </p>
            </div>
          ) : (
            <ul className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {bankShown.map(b => (
                <li key={b.id} className="rounded-xl border border-line/15 bg-deep/30 p-3">
                  <p className="text-[13px] font-bold text-ink">{b.question}</p>
                  <p className="mt-0.5 text-[11px] text-mut">{b.company} · {b.jobTitle} · {b.roundLabel} · {new Date(b.at).toLocaleDateString()}</p>
                  <div className="mt-2 flex gap-3">
                    <button
                      className="text-[11.5px] font-bold text-ok hover:underline"
                      onClick={() => { const c = practiceForRound(b.question, fieldSel, 4).filter(x => lvlSel === "all" || x.lvl === lvlSel); if (!c.length) { toast("No cards matched that question — try another field"); return; } beginSession(c); }}
                    >
                      ⚡ Practice
                    </button>
                    <button className="text-[11.5px] font-bold text-bad hover:underline" onClick={() => { removeFromBank(b.id); setBank(listBank()); toast("🗑️ Removed from bank"); }}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {shown.length ? (
        <div className="space-y-3">
          {shown.map((i, idx2) => (
            <details key={idx2} className={`${cardCls} group px-5 py-4`}>
              <summary className="flex cursor-pointer list-none items-center gap-2.5">
                <Chip tone="lvl">{levelById(i.lvl).icon} {levelById(i.lvl).name}</Chip>
                <span className="min-w-[140px] flex-1 text-[14.5px] font-bold leading-snug">{i.q}</span>
                <span className="text-mut transition-transform group-open:rotate-90">▸</span>
              </summary>
              <div className="mt-4 space-y-3 border-t border-line/10 pt-4">
                <div className="rounded-xl border border-acc1/25 bg-acc1/10 p-4">
                  <div className="mb-1 text-[12.5px] font-bold uppercase tracking-wider text-acc3">Model answer</div>
                  <p className="whitespace-pre-wrap text-[14px] leading-[1.7] text-ink">{i.a}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(i.kp || []).map(k => <KpNeutral key={k}>{k}</KpNeutral>)}
                </div>
                <button className={btnSoft + btnSm} onClick={() => practice(fieldSel, i)}>🎯 Practice this question</button>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className={`${cardCls} mt-4 flex flex-col items-center px-5 py-16 text-center`}>
          <div className="mb-3 text-[42px]">🔎</div>
          <h3 className="mb-1 text-lg font-bold">No questions found</h3>
          <p className="text-sm text-mut">Try a different search term or level.</p>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12.5px] font-bold transition-all ${active ? "grad-bg border-transparent text-white shadow-[0_4px_12px_rgba(99,102,241,.4)]" : "border-line/15 bg-wht/5 text-mut hover:bg-wht/10 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
