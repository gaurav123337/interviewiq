import { useState } from "react";
import type { LevelId } from "../types";
import { FIELDS, LEVELS, levelById } from "../data";
import { getSrs, learnedCount, makeDeck, rate, resetSrs, type DrillCard, type Rating } from "../services/drill";
import { toast } from "../toast";
import { btnGhost, btnPrimary, btnSoft, btnSm, cardCls, Chip, KpNeutral } from "./ui";

export function Drill() {
  const [fieldSel, setFieldSel] = useState(FIELDS[0].id);
  const [lvlSel, setLvlSel] = useState<LevelId | "all">("all");
  const [deck, setDeck] = useState<DrillCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [learned, setLearned] = useState(learnedCount(getSrs()));

  const build = () => {
    const d = makeDeck(fieldSel, lvlSel, 10);
    if (!d.length) {
      toast("Nothing due right now — all questions are scheduled for later. Reset to start over.");
      return;
    }
    setDeck(d);
    setIdx(0);
    setFlipped(false);
    setDoneCount(0);
    setLearned(learnedCount(getSrs()));
  };

  const rateCard = (r: Rating) => {
    if (!deck) return;
    const card = deck[idx];
    rate(card.q, r);
    if (r === "again") {
      /* keep in this session: move to the back */
      setDeck(d => {
        const rest = d ?? [];
        return [...rest.slice(1), rest[0]];
      });
    } else {
      setDeck(d => {
        const rest = d ?? [];
        return rest.slice(0, idx).concat(rest.slice(idx + 1));
      });
      setLearned(learnedCount(getSrs()));
    }
    setIdx(0);
    setFlipped(false);
    setDoneCount(c => c + 1);
  };

  const card = deck?.[idx];

  return (
    <div className="anim-view mx-auto max-w-[720px]">
      <div className="pt-4 text-center">
        <span className="eyebrow text-[12.5px] font-bold uppercase tracking-[.14em] text-acc3">🎴 Drill Mode</span>
        <h1 className="mt-1 text-[clamp(26px,4vw,38px)] font-extrabold tracking-tight">Flashcard <span className="grad-text">reps</span>.</h1>
        <p className="mx-auto mt-2 max-w-[520px] text-[14.5px] text-mut">
          Flip through questions and rate your recall. Spaced repetition reschedules cards so you review what you're about to forget.
        </p>
      </div>

      {/* setup bar */}
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <select
          value={fieldSel}
          onChange={e => setFieldSel(e.target.value)}
          className="rounded-xl border border-white/15 bg-[#0b1120]/80 px-3 py-2 text-[13.5px] font-semibold focus:border-acc1/80 focus:outline-none"
        >
          {FIELDS.map(f => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
        </select>
        <select
          value={lvlSel}
          onChange={e => setLvlSel(e.target.value as LevelId | "all")}
          className="rounded-xl border border-white/15 bg-[#0b1120]/80 px-3 py-2 text-[13.5px] font-semibold focus:border-acc1/80 focus:outline-none"
        >
          <option value="all">All levels</option>
          {LEVELS.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
        </select>
        <button className={btnPrimary + btnSm} onClick={build}>Build deck</button>
        {learned > 0 && (
          <button className={btnGhost + btnSm} onClick={() => { resetSrs(); setLearned(0); toast("Spaced-repetition schedule reset"); }}>
            Reset ({learned} learned)
          </button>
        )}
      </div>

      {!card && !deck && (
        <div className={`${cardCls} mt-6 flex flex-col items-center px-5 py-14 text-center`}>
          <div className="mb-3 text-[42px]">🎴</div>
          <h3 className="mb-1 text-lg font-bold">Pick a field and hit “Build deck”</h3>
          <p className="text-sm text-mut">{learned} question{learned === 1 ? "" : "s"} learned.</p>
        </div>
      )}

      {card && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between text-[13px] font-semibold text-mut">
            <span>Card {Math.min(idx + 1, deck!.length)} of {deck!.length}</span>
            <span>{doneCount} rated · {learned} learned</span>
          </div>

          {/* flashcard */}
          <button
            type="button"
            onClick={() => setFlipped(f => !f)}
            className={`${cardCls} block w-full min-h-[260px] p-7 text-left transition-transform ${flipped ? "" : "hover:-translate-y-0.5"}`}
          >
            {!flipped ? (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Chip tone="lvl">{levelById(card.lvl).icon} {levelById(card.lvl).name}</Chip>
                  <Chip>Tap to reveal</Chip>
                </div>
                <p className="text-[19px] font-bold leading-[1.5] tracking-tight">{card.q}</p>
              </>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Chip tone="cat">Model answer</Chip>
                  <Chip tone="ok">Key points</Chip>
                </div>
                <p className="whitespace-pre-wrap text-[14.5px] leading-[1.7] text-[#d7ddf0]">{card.a}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(card.kp || []).map(k => <KpNeutral key={k}>{k}</KpNeutral>)}
                </div>
              </>
            )}
          </button>

          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            {!flipped ? (
              <button className={btnGhost} onClick={() => setFlipped(true)}>👁 Reveal answer</button>
            ) : (
              <>
                <button className={btnGhost + btnSm} onClick={() => rateCard("again")} title="Review again soon">🔄 Again</button>
                <button className={btnGhost + btnSm} onClick={() => rateCard("hard")} title="Review again tomorrow">😓 Hard</button>
                <button className={btnSoft + btnSm} onClick={() => rateCard("good")} title="Review again in 3 days">🙂 Good</button>
                <button className={btnPrimary + btnSm} onClick={() => rateCard("easy")} autoFocus title="Review again in a week">✅ Easy</button>
              </>
            )}
          </div>
        </div>
      )}

      {deck && !card && (
        <div className={`${cardCls} mt-6 flex flex-col items-center px-5 py-14 text-center`}>
          <div className="mb-3 text-[42px]">🎉</div>
          <h3 className="mb-1 text-lg font-bold">Deck complete!</h3>
          <p className="mb-4 text-sm text-mut">You rated {doneCount} cards this round.</p>
          <div className="flex gap-3">
            <button className={btnPrimary + btnSm} onClick={build}>New deck</button>
            <button className={btnGhost + btnSm} onClick={() => setDeck(null)}>Change settings</button>
          </div>
        </div>
      )}
    </div>
  );
}
