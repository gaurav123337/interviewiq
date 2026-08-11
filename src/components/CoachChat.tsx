/* AI Coach — an always-on assistant for solving quiz questions.
   Two modes, switchable mid-conversation:
   - 🤖 AI (API key): uses the user's configured OpenAI-compatible endpoint via
     the existing `chat()` — full generative discussion, hints, debate.
   - 📚 Knowledge (offline): no key, no network. Retrieves over the question's
     model answer + key points and related field-bank questions (keyword
     overlap), so learning never stops without an API key.
   Both are grounded in the current question so the discussion stays on-task. */

import { useEffect, useRef, useState } from "react";
import { aiAvailable, chat, type ChatMessage } from "../ai";
import { codingTopicsFromText, suggestNextProblem } from "../data/codingCompanies";
import { getCodingTrack } from "../services/codingTrack";
import { queueEvent } from "../services/events";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import { coachReply, type CoachContext, type CoachMsg } from "../coach/reply";
import { btnGhost, btnPrimary, btnSm, cardCls } from "./ui";
import { toast } from "../toast";

/* The offline coach's brain (concept-aware matching, intents, grading,
   dialogue memory) lives in ../coach/reply + ../coach/concepts. Re-exported
   here for compatibility with existing tests and host imports. */
export { localCoachReply } from "../coach/reply";
export type { CoachContext } from "../coach/reply";

/* ------------------------------------------------------------------ */
/* Saving discussions into the weakness profile + history              */
/* ------------------------------------------------------------------ */

export interface CoachDiscussion {
  at: number;
  prompt: string;
  mode: "api" | "local";
  text: string;
}

export interface CoachWeekStats {
  cur: number;
  longest: number;
  thisWeek: number;
  topics: number;
}

/** Coach usage stats — discussions per week (Monday-start), current + longest
    weekly streak, this week's count, and distinct coding topics debated. */
export function coachWeekStats(discussions: Pick<CoachDiscussion, "at" | "text">[]): CoachWeekStats {
  const WEEK = 7 * 86_400_000;
  const weekKey = (t: number) => {
    const d = new Date(t);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); /* Monday start */
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const nowWk = weekKey(Date.now());
  const weeks = [...new Set(discussions.map(d => weekKey(d.at)))].sort((a, b) => b - a);
  const thisWeek = discussions.filter(d => weekKey(d.at) === nowWk).length;
  let cur = 0;
  if (weeks.includes(nowWk) || weeks.includes(nowWk - WEEK)) {
    let anchor = weeks.includes(nowWk) ? nowWk : nowWk - WEEK;
    cur = 1;
    while (weeks.includes(anchor - WEEK)) { cur += 1; anchor -= WEEK; }
  }
  let longest = 0;
  for (const w of weeks) {
    let run = 1;
    while (weeks.includes(w - run * WEEK)) run += 1;
    longest = Math.max(longest, run);
  }
  const topics = new Set<string>();
  for (const d of discussions) codingTopicsFromText(d.text).forEach(t => topics.add(t));
  return { cur, longest, thisWeek, topics: topics.size };
}

/** Saved coach discussions — read by codingCompanies (focus) and History. */
export function getCoachDiscussions(): CoachDiscussion[] {
  return storageGet<CoachDiscussion[]>(STORAGE_KEYS.coachTopics, []);
}

/** Appends a discussion (deduped by content, capped at the latest 50) and
    queues a coach_discussion event so the admin can aggregate weak topics. */
export function saveCoachDiscussion(d: { prompt: string; mode: "api" | "local"; text: string }): boolean {
  const t = d.text.trim();
  if (!t) return false;
  const key = t.slice(0, 200);
  const list = getCoachDiscussions().filter(x => !x.text.startsWith(key));
  list.unshift({ at: Date.now(), prompt: d.prompt, mode: d.mode, text: t.slice(0, 1200) });
  storageSet(STORAGE_KEYS.coachTopics, list.slice(0, 50));
  const topics = codingTopicsFromText(t);
  queueEvent("coach_discussion", { topics, prompt: d.prompt.slice(0, 300), mode: d.mode });
  return true;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CoachChat(ctx: CoachContext) {
  const { prompt, answer, kp } = ctx;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"api" | "local">(aiAvailable() ? "api" : "local");
  const [msgs, setMsgs] = useState<CoachMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<{ id: string; title: string; kind: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [msgs, busy, open]);

  /* auto-grow the composer so long answers aren't cramped in a single line */
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(160, el.scrollHeight) + "px";
  };

  const saveDiscussion = () => {
    const text = msgs.filter(m => m.role === "assistant" || m.role === "user").map(m => m.text).join("\n");
    if (saveCoachDiscussion({ prompt, mode, text })) {
      toast("💾 Discussion saved — topics debated here now influence your focus plan");
    } else {
      toast("Nothing to save yet — have a chat first");
    }
  };

  const suggest = () => {
    checkCompletion();
    const text = msgs.map(m => m.text).join(" ");
    const p = suggestNextProblem(ctx.companyId ?? null, text);
    if (!p) {
      toast("I couldn't pin a topic from this chat — keep discussing, or ask me about complexity, edge cases, or a specific area.");
      return;
    }
    setSuggestion({ id: p.id, title: p.title, kind: p.kind });
  };

  /* practice loop — once the suggested problem is solved (codingTrack), the
     coach notices on the next interaction and prompts to keep the loop going */
  const checkCompletion = () => {
    if (!pending) return;
    const t = getCodingTrack()[pending];
    if (t?.solved) {
      setPending(null);
      setSuggestion(null);
      setMsgs(m => [...m, {
        role: "assistant",
        text: "🎉 Looks like you solved that one! Keep the loop going: save this discussion, then hit “Suggest next problem” to chain into the next challenge."
      }]);
    }
  };

  const practice = (id: string) => {
    ctx.onPractice?.(id);
    setPending(id);
    setSuggestion(null);
    const sug = suggestion;
    setMsgs(m => [...m, {
      role: "assistant",
      text: `👋 Go solve ${sug?.title ?? "it"} — when you're done (or stuck), come back and we'll keep the loop going.`
    }]);
  };

  /* one send path shared by the composer and the quick-action chips */
  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    checkCompletion();
    setInput("");
    const next: CoachMsg[] = [...msgs, { role: "user", text }];
    setMsgs(next);
    setBusy(true);
    try {
      if (mode === "api") {
        const system: ChatMessage = {
          role: "system",
          content:
            "You are a friendly senior technical interviewer coaching a candidate through a live quiz question. " +
            `Question: ${prompt}\nModel answer outline: ${answer}\nKey points graded: ${kp.join("; ")}\n\n` +
            "The candidate can ask for hints, share their approach, or debate your/model answers. Be encouraging, " +
            "probe with follow-up questions, point out what their approach misses relative to the key points, and " +
            "only reveal the full model answer when they explicitly ask. Keep replies focused, under ~180 words."
        };
        const history: ChatMessage[] = [
          system,
          ...msgs.map(m => ({ role: m.role, content: m.text }) as ChatMessage),
          { role: "user", content: text }
        ];
        const reply = await chat(history, { maxTokens: 450 });
        setMsgs(m => [...m, { role: "assistant", text: reply }]);
      } else {
        /* full history incl. the new message → the coach grades the latest
           real answer and remembers what's already covered across turns */
        setMsgs(m => [...m, { role: "assistant", text: coachReply(text, ctx, next) }]);
      }
    } catch (e) {
      const msg = (e as Error).message || "Coach unavailable";
      toast("✗ " + msg);
      setMsgs(m => [...m, { role: "assistant", text: "I hit an error: " + msg + " — switch to 📚 Knowledge mode to keep going offline." }]);
    } finally {
      setBusy(false);
    }
  };

  const send = () => submit(input);

  const seg = (active: boolean) =>
    `rounded-full px-3 py-1 text-[11px] font-bold transition-all ${active ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`;

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <button type="button" onClick={() => setOpen(o => { const n = !o; if (n) checkCompletion(); return n; })} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-[13px] font-extrabold">🤖 AI Coach — discuss your approach</span>
        <span className="text-[11px] font-bold text-mut">{open ? "Hide ▾" : "Ask anytime ▴"}</span>
      </button>
      {open && (
        <div className="border-t border-line/10 px-4 pb-4 pt-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-mut">Mode</span>
            <button type="button" className={seg(mode === "api")} onClick={() => setMode("api")}>🤖 AI · API key</button>
            <button type="button" className={seg(mode === "local")} onClick={() => setMode("local")}>📚 Knowledge · offline</button>
            {mode === "local" && <span className="text-[10.5px] text-mut">no key needed — grounded in the question bank</span>}
          </div>
          <div ref={boxRef} className="h-[240px] space-y-2 overflow-y-auto pr-1">
            {msgs.length === 0 ? (
              <div className="text-[12.5px] leading-relaxed text-mut">
                Share your approach, ask for a hint, or debate the model answer. In 📚 Knowledge mode I answer from the
                question bank — learning never stops, even without an API key.
              </div>
            ) : (
              msgs.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${m.role === "user" ? "ml-auto grad-bg text-white" : "bg-deep/60 text-ink"}`}
                >
                  {m.text}
                </div>
              ))
            )}
            {busy && <div className="text-[12px] text-mut">…thinking</div>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "💡 Hint", cmd: "Give me a hint" },
              { label: "📝 Grade my answer", cmd: "Grade my answer" },
              { label: "🤔 Debate", cmd: "I disagree with the model answer" },
              { label: "🎯 Next", cmd: "What should I study next?" }
            ].map(c => (
              <button
                key={c.label}
                type="button"
                disabled={busy}
                onClick={() => submit(c.cmd)}
                className="rounded-full border border-line/15 px-2.5 py-1 text-[11px] font-bold text-mut transition-all hover:border-acc1/40 hover:text-ink disabled:opacity-50"
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2">
            <textarea
              value={input}
              rows={1}
              onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Ask about this question… (Shift+Enter for a new line)"
              className="inp w-full flex-1 resize-none overflow-y-auto leading-relaxed"
            />
            <button className={`${btnPrimary} ${btnSm} flex-none self-end`} onClick={send} disabled={busy || !input.trim()}>Send</button>
          </div>
          {msgs.length >= 2 && (
            <button type="button" className={`${btnGhost} ${btnSm} mt-2 w-full`} onClick={saveDiscussion}>
              💾 Save this discussion into my weak-topic profile
            </button>
          )}
          {msgs.length >= 3 && (
            <button type="button" className={`${btnGhost} ${btnSm} mt-1.5 w-full`} onClick={suggest}>
              🎯 Suggest next problem from this discussion
            </button>
          )}
          {suggestion && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-acc1/30 bg-acc1/10 px-3 py-2 text-[12.5px]">
              <span className="font-bold text-acctxt">🎯 Next: {suggestion.kind === "fn" ? "🧩" : suggestion.kind === "ui" ? "🎨" : "⚙️"} {suggestion.title}</span>
              {ctx.onPractice && (
                <button className={`${btnPrimary} ${btnSm} ml-auto`} onClick={() => practice(suggestion.id)}>
                  ▶ Practice this
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
