import { useMemo, useState } from "react";
import { SYSTEM_DESIGN_CASES } from "../../data/systemDesignBank";
import { STORAGE_KEYS, storageGet, storageSet } from "../../services/storage";
import { toast } from "../../toast";
import { btnGhost, btnPrimary, btnSm, cardCls, Chip, Drawer } from "../ui";
import { loadCompleted, markCompleted, loadQuiz, saveQuiz, loadHistory, saveHistoryEntry, loadBookmarks, loadTimerPreset, saveTimerPreset, loadFlashcards, calculateStreak, exportProgress, CATEGORY_META } from "./utils";

export function FlashcardDrawer({ onClose }: { onClose: () => void }) {
  const [cards, setCards] = useState<FlashcardMap>(() => loadFlashcards());
  const [showAnswer, setShowAnswer] = useState(false);
  const [flipped, setFlipped] = useState(false);

  // Build deck: gather all key numbers from all cases, create cards as needed
  const deck = useMemo(() => {
    const allCards: { caseId: string; caseTitle: string; caseIcon: string; number: string; key: string; data: FlashcardData | null }[] = [];
    for (const c of SYSTEM_DESIGN_CASES) {
      for (const n of c.keyNumbers) {
        const key = `${c.id}|${n}`;
        allCards.push({ caseId: c.id, caseTitle: c.title, caseIcon: c.icon, number: n, key, data: cards[key] ?? null });
      }
    }
    return allCards;
  }, [cards]);

  // Due cards (nextReview <= now)
  const now = Date.now();
  const dueCards = useMemo(() => deck.filter(c => !c.data || c.data.nextReview <= now), [deck, now]);
  const newCards = useMemo(() => deck.filter(c => !c.data), [deck]);
  const reviewedCards = useMemo(() => deck.filter(c => c.data && c.data.nextReview > now), [deck, now]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const current = dueCards[currentIdx];

  const handleRating = (quality: number) => {
    if (!current) return;
    const key = current.key;
    const existing = cards[key] ?? { caseId: current.caseId, number: current.number, ease: 2.5, interval: 0, nextReview: 0, streak: 0 };

    // SM-2 algorithm
    let { ease, interval, streak } = existing;
    if (quality >= 3) {
      // Correct
      streak += 1;
      if (streak === 1) interval = 1;
      else if (streak === 2) interval = 3;
      else interval = Math.round(interval * ease);
      ease = Math.min(2.5, ease + 0.1);
    } else {
      // Incorrect — reset
      streak = 0;
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
    }

    const updated: FlashcardData = {
      ...existing, ease, interval, streak,
      nextReview: Date.now() + interval * 24 * 60 * 60 * 1000
    };

    const newCards = { ...cards, [key]: updated };
    setCards(newCards);
    storageSet("iq.sysDesignFlashcards", newCards);
    setShowAnswer(false);
    setFlipped(false);

    // Move to next
    if (currentIdx + 1 < dueCards.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setCurrentIdx(0);
      toast("🎉 All due cards reviewed!");
    }
  };

  return (
    <Drawer onClose={onClose} title="🃏 Flashcards — Key Numbers" desc="Spaced repetition for memorizing system design numbers">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="rounded-xl border border-warn/25 bg-warn/10 px-4 py-2 text-center">
          <div className="text-[18px] font-extrabold text-warn">{dueCards.length}</div>
          <div className="text-[11px] font-bold text-mut">Due</div>
        </div>
        <div className="rounded-xl border border-acc1/25 bg-acc1/10 px-4 py-2 text-center">
          <div className="text-[18px] font-extrabold text-acctxt">{newCards.length}</div>
          <div className="text-[11px] font-bold text-mut">New</div>
        </div>
        <div className="rounded-xl border border-ok/25 bg-ok/10 px-4 py-2 text-center">
          <div className="text-[18px] font-extrabold text-ok">{reviewedCards.length}</div>
          <div className="text-[11px] font-bold text-mut">Reviewed</div>
        </div>
        <div className="rounded-xl border border-line/15 bg-wht/5 px-4 py-2 text-center">
          <div className="text-[18px] font-extrabold text-fnt">{deck.length}</div>
          <div className="text-[11px] font-bold text-mut">Total</div>
        </div>
      </div>

      {dueCards.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-[32px] mb-2">🎉</div>
          <p className="text-[14px] font-bold text-ink">All caught up!</p>
          <p className="text-[13px] text-mut mt-1">No cards are due for review right now. Come back later or reset your progress.</p>
        </div>
      ) : current ? (
        <div>
          {/* Card */}
          <button
            onClick={() => { setFlipped(!flipped); setShowAnswer(!showAnswer); }}
            className={`w-full rounded-2xl border p-6 text-center transition-all ${
              flipped ? "border-ok/40 bg-ok/10" : "border-acc1/40 bg-acc1/10 hover:shadow-[0_8px_24px_rgba(99,102,241,.15)]"
            }`}
          >
            <div className="text-[12px] font-bold text-mut mb-2">
              {current.caseIcon} {current.caseTitle}
            </div>
            {flipped ? (
              <div className="text-[16px] font-extrabold text-ink leading-relaxed">{current.number}</div>
            ) : (
              <div className="text-[14px] text-mut">Tap to reveal the key number</div>
            )}
          </button>

          {/* Rating buttons */}
          {flipped && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              <button onClick={() => handleRating(1)} className="rounded-xl border border-warn/50 bg-warn/15 px-3 py-3 text-[12px] font-bold text-warn transition-all hover:bg-warn/25">
                😣 Again
              </button>
              <button onClick={() => handleRating(3)} className="rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-3 text-[12px] font-bold text-amber-400 transition-all hover:bg-amber-500/25">
                🤔 Hard
              </button>
              <button onClick={() => handleRating(4)} className="rounded-xl border border-ok/50 bg-ok/15 px-3 py-3 text-[12px] font-bold text-ok transition-all hover:bg-ok/25">
                👍 Good
              </button>
              <button onClick={() => handleRating(5)} className="rounded-xl border border-acc1/50 bg-acc1/15 px-3 py-3 text-[12px] font-bold text-acctxt transition-all hover:bg-acc1/25">
                🔥 Easy
              </button>
            </div>
          )}

          <div className="mt-3 text-center text-[11px] text-mut">
            Card {currentIdx + 1} of {dueCards.length} due • {current.data ? `Streak: ${current.data.streak}` : "New card"}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}