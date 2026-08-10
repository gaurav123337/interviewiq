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
import { fieldById } from "../data";
import { deepDiveCards } from "../data/deepDive";
import { codingTopicsFromText, suggestNextProblem } from "../data/codingCompanies";
import { publishedFor } from "../services/remoteConfig";
import { queueEvent } from "../services/events";
import { STORAGE_KEYS, storageGet, storageSet } from "../services/storage";
import type { LevelId } from "../types";
import { btnGhost, btnPrimary, btnSm, cardCls } from "./ui";
import { toast } from "../toast";

interface CoachMsg { role: "user" | "assistant"; text: string }

export interface CoachContext {
  prompt: string;
  answer: string;
  kp: string[];
  fieldId?: string | null;
  levelId?: LevelId | null;
  /** Goal company id — used to rank the next-problem suggestion. */
  companyId?: string | null;
  /** Called with a problem id when the candidate accepts a suggestion. */
  onPractice?: (problemId: string) => void;
}

/* ------------------------------------------------------------------ */
/* Retrieval + response for the offline knowledge mode                 */
/* ------------------------------------------------------------------ */

const tokens = (s: string): Set<string> =>
  new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3));

/** Number of shared meaningful tokens between two strings. */
function overlap(a: string, b: string): number {
  const wa = tokens(a);
  const wb = tokens(b);
  let n = 0;
  for (const w of wa) if (wb.has(w)) n++;
  return n;
}

/** Retrieval pool for the offline tutor — the current field's questions, the
    curated deep-dive knowledge base, and admin-published bank updates. */
function retrievalPool(ctx: CoachContext): { q: string; a: string }[] {
  const pool: { q: string; a: string }[] = [];
  const seen = new Set<string>();
  const push = (qa: { q: string; a: string }) => {
    if (qa.q && !seen.has(qa.q)) { seen.add(qa.q); pool.push(qa); }
  };
  if (ctx.fieldId) {
    const field = fieldById(ctx.fieldId);
    const levels = ctx.levelId ? [ctx.levelId] : field ? (Object.keys(field.questions) as LevelId[]) : [];
    for (const lv of levels) {
      for (const qa of field?.questions[lv] ?? []) push({ q: qa.q, a: qa.a });
      if (ctx.levelId) for (const qa of publishedFor(ctx.fieldId, ctx.levelId)) push({ q: qa.q, a: qa.a });
    }
  }
  for (const c of deepDiveCards()) push({ q: c.q, a: c.a });
  return pool;
}

function relatedQuestions(ctx: CoachContext, text: string, limit: number): { q: string; a: string }[] {
  return retrievalPool(ctx)
    .map(qa => ({ qa, s: overlap(qa.q, text) + overlap(qa.a, text) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.qa);
}

/* ------------------------------------------------------------------ */
/* Saving discussions into the weakness profile + history              */
/* ------------------------------------------------------------------ */

export interface CoachDiscussion {
  at: number;
  prompt: string;
  mode: "api" | "local";
  text: string;
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

/** Deterministic, grounded answer — retrieval over the bank, no network. */
export function localCoachReply(text: string, ctx: CoachContext): string {
  const t = text.toLowerCase();
  const kp = ctx.kp ?? [];
  const answer = (ctx.answer ?? "").trim();
  const hitKp = kp.filter(k => overlap(k, text) > 0);
  const missing = kp.filter(k => overlap(k, text) === 0);
  const wantHint = /hint|stuck|help|how (do|should|can) i|approach/.test(t);
  const sharing = /i would|my approach|my solution|i think|i did|my answer|what about|this is how/.test(t);
  const debating = /disagree|but |not sure|isn't|wrong|debate|different|however/.test(t);

  const lines: string[] = [];

  if (wantHint) {
    lines.push("🧭 Hint — break the question into parts before you answer. A strong reply covers:");
    lines.push("• " + (kp.length ? kp.join("\n• ") : "the core idea, a concrete example, and the tradeoffs"));
    if (answer) lines.push("Work toward the outline: " + answer.slice(0, 220) + (answer.length > 220 ? "…" : ""));
  }

  if (sharing) {
    lines.push("✅ That's a real approach — let's stress-test it against what this question is graded on.");
    if (hitKp.length) lines.push("You're covering: " + hitKp.join(" · "));
    if (missing.length) lines.push("Don't miss: " + missing.join(" · "));
    if (answer) lines.push("The model answer reasons through: " + answer.slice(0, 240) + (answer.length > 240 ? "…" : ""));
  } else if (debating) {
    lines.push("🤔 Fair challenge. Here's the model answer's position:");
    lines.push(answer.slice(0, 300) || "See the key points below — that's the position interviewers expect.");
    if (kp.length) lines.push("Interviewers at this level are listening for: " + kp.join(" · "));
    lines.push("If you can hit those points with your own structure, that's a stronger debate than the wording — what's your version?");
  } else if (!wantHint) {
    lines.push("Tell me your approach and I'll compare it with the model answer — or ask for a hint if you're stuck.");
    if (answer) lines.push("Reference outline: " + answer.slice(0, 200) + (answer.length > 200 ? "…" : ""));
  }

  const related = relatedQuestions(ctx, text, 2);
  if (related.length) {
    lines.push("📚 Related practice from this field: " + related.map(r => "“" + r.q + "”").join(" · "));
  }

  return lines.join("\n\n");
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
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [msgs, busy, open]);

  const saveDiscussion = () => {
    const text = msgs.filter(m => m.role === "assistant" || m.role === "user").map(m => m.text).join("\n");
    if (saveCoachDiscussion({ prompt, mode, text })) {
      toast("💾 Discussion saved — topics debated here now influence your focus plan");
    } else {
      toast("Nothing to save yet — have a chat first");
    }
  };

  const suggest = () => {
    const text = msgs.map(m => m.text).join(" ");
    const p = suggestNextProblem(ctx.companyId ?? null, text);
    if (!p) {
      toast("I couldn't pin a topic from this chat — keep discussing, or ask me about complexity, edge cases, or a specific area.");
      return;
    }
    setSuggestion({ id: p.id, title: p.title, kind: p.kind });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs(m => [...m, { role: "user", text }]);
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
        setMsgs(m => [...m, { role: "assistant", text: localCoachReply(text, ctx) }]);
      }
    } catch (e) {
      const msg = (e as Error).message || "Coach unavailable";
      toast("✗ " + msg);
      setMsgs(m => [...m, { role: "assistant", text: "I hit an error: " + msg + " — switch to 📚 Knowledge mode to keep going offline." }]);
    } finally {
      setBusy(false);
    }
  };

  const seg = (active: boolean) =>
    `rounded-full px-3 py-1 text-[11px] font-bold transition-all ${active ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`;

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
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
          <div className="mt-2 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              placeholder="Ask about this question…"
              className="inp w-full flex-1"
            />
            <button className={`${btnPrimary} ${btnSm} flex-none`} onClick={send} disabled={busy || !input.trim()}>Send</button>
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
                <button className={`${btnPrimary} ${btnSm} ml-auto`} onClick={() => { ctx.onPractice?.(suggestion.id); setSuggestion(null); }}>
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
