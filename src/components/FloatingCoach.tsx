/* Floating AI Coach — a global FAB button that opens a context-aware chat
   panel on every view. Two modes:
   - 🤖 AI (API key): uses the user's configured OpenAI-compatible endpoint
   - 📚 Knowledge (offline): fully local reply from case study data + RAG hits
   Context-aware: when on the System Design view, the coach knows about the
   current topic and can discuss architecture patterns.
   Features: voice input (Web Speech API), chat history persistence,
   Ctrl+/ keyboard shortcut to toggle. */

import { useCallback, useEffect, useRef, useState } from "react";
import { aiAvailable, chat, type ChatMessage } from "../ai";
import { SYSTEM_DESIGN_CASES, type SystemDesignCase } from "../data/systemDesignBank";
import { lexicalSearch, documentTitles, ragTuningInfo } from "../services/rag";
import { storageGet, storageSet } from "../services/storage";
import { useApp } from "../store";
import { citationSourceLabel } from "./CoachChat";
import { CitationChip } from "./CitationChip";
import { GroundingNote } from "./GroundingNote";
import { cardCls } from "./ui";
import { toast } from "../toast";

/* ------------------------------------------------------------------ */
/* Chat message type + persistence                                      */
/* ------------------------------------------------------------------ */

interface FABMsg {
  role: "user" | "assistant";
  text: string;
  citations?: { title: string; content: string; grounded: boolean }[];
  grounded?: boolean;
  citationsSource?: "vector" | "lexical";
}

const CHAT_STORAGE_KEY = "iq.floatingCoachChat";
const MAX_PERSISTED_MSGS = 100;

function loadChatHistory(): FABMsg[] {
  return storageGet<FABMsg[]>(CHAT_STORAGE_KEY, []);
}
function saveChatHistory(msgs: FABMsg[]) {
  storageSet(CHAT_STORAGE_KEY, msgs.slice(-MAX_PERSISTED_MSGS));
}

/* ------------------------------------------------------------------ */
/* Voice input (Web Speech API)                                        */
/* ------------------------------------------------------------------ */

interface SpeechState {
  supported: boolean;
  listening: boolean;
  transcript: string;
}

function useSpeechRecognition(): SpeechState & {
  start: () => void;
  stop: () => void;
} {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        }
      }
      if (final) setTranscript(prev => (prev + " " + final).trim());
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recRef.current = recognition;
    recognition.start();
    setListening(true);
    setTranscript("");
  }, [supported]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, transcript, start, stop };
}

/* ------------------------------------------------------------------ */
/* Fully local offline reply — NO API calls                            */
/* ------------------------------------------------------------------ */

/** Tokenize and extract meaningful keywords */
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

const STOP_WORDS = new Set([
  "this", "that", "with", "from", "have", "will", "about", "would", "could",
  "should", "what", "when", "where", "which", "there", "their", "them",
  "then", "than", "some", "more", "most", "very", "also", "just", "only",
  "other", "into", "over", "such", "your", "does", "tell", "explain",
  "design", "system", "make", "give", "want", "need", "like", "help"
]);

/** Match a question against a case study by keyword overlap */
function matchCaseStudy(question: string): SystemDesignCase | null {
  const qTokens = new Set(tokenize(question));
  let best: SystemDesignCase | null = null;
  let bestScore = 0;
  for (const c of SYSTEM_DESIGN_CASES) {
    const haystack = [c.title, c.blurb, ...c.prerequisites, ...c.followUpTopics].join(" ").toLowerCase();
    const cTokens = new Set(tokenize(haystack));
    let score = 0;
    for (const t of qTokens) {
      if (c.title.toLowerCase().includes(t)) score += 3;
      if (cTokens.has(t)) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= 2 ? best : null;
}

/** Detect the user's intent from their question */
function detectIntent(q: string): "overview" | "tradeoffs" | "mistakes" | "scale" | "numbers" | "phase" | "general" {
  const lower = q.toLowerCase();
  if (/overview|explain|walkthrough|step.by.step|architecture|how.*work|what.*is/.test(lower)) return "overview";
  if (/trade.?off|vs|versus|compare|pros.*cons|better|worse/.test(lower)) return "tradeoffs";
  if (/mistake|error|wrong|common.*fail|pitfall|avoid/.test(lower)) return "mistakes";
  if (/scale|million|billion|throughput|latency|capacity|qps|rps|traffic/.test(lower)) return "scale";
  if (/number|memorize|remember|stat|metric|figure/.test(lower)) return "numbers";
  if (/phase|step|stage|whiteboard|interview|minute/.test(lower)) return "phase";
  return "general";
}

/** Build a fully local reply from case study data + RAG hits — no API needed */
async function localReply(
  question: string,
  currentCase: SystemDesignCase | null,
  ragHits: { title: string; content: string }[]
): Promise<{ text: string; citations: { title: string; content: string; grounded: boolean }[] }> {
  const intent = detectIntent(question);
  const target = currentCase ?? matchCaseStudy(question);
  const citations = ragHits.map(h => ({ ...h, grounded: true }));
  const lines: string[] = [];

  if (target) {
    lines.push(`**${target.icon} ${target.title}** — ${target.blurb}\n`);

    switch (intent) {
      case "overview":
        lines.push("**Architecture Overview:**");
        target.phases.forEach((p, i) => {
          lines.push(`\n**Phase ${i + 1}: ${p.phase}** (${p.duration})`);
          p.talkingPoints.forEach(tp => lines.push(`→ ${tp}`));
          if (p.numbers?.length) lines.push(`  📐 ${p.numbers.join(" · ")}`);
        });
        break;

      case "tradeoffs":
        lines.push("**Key Trade-offs:**");
        if (target.phases.length >= 3) {
          lines.push(`→ During the design phase, consider: ${target.phases[1]?.talkingPoints.slice(0, 2).join(" vs ")}`);
        }
        lines.push(`→ Common tension: performance vs consistency vs cost`);
        lines.push(`→ Start with the simplest design that works, add complexity only when scale demands it`);
        break;

      case "mistakes":
        lines.push("**Common Mistakes:**");
        target.commonMistakes.forEach(m => lines.push(`⚠️ ${m}`));
        if (!target.commonMistakes.length) {
          lines.push("⚠️ Not jumping into the design before clarifying requirements");
          lines.push("⚠️ Not discussing trade-offs for each design decision");
          lines.push("⚠️ Ignoring failure modes and edge cases");
        }
        break;

      case "scale":
        lines.push("**Scale & Numbers:**");
        target.keyNumbers.forEach(n => lines.push(`📐 ${n}`));
        lines.push(`\n💡 Tip: Always start with back-of-envelope estimates in the interview.`);
        break;

      case "numbers":
        lines.push("**Numbers to Memorize:**");
        target.keyNumbers.forEach(n => lines.push(`🔢 ${n}`));
        break;

      case "phase":
        lines.push("**Whiteboard Interview Phases:**");
        target.phases.forEach((p, i) => {
          lines.push(`\n**${i + 1}. ${p.phase}** (${p.duration})`);
          p.talkingPoints.forEach(tp => lines.push(`   → ${tp}`));
        });
        break;

      default:
        lines.push(`**About ${target.title}:**`);
        lines.push(target.blurb);
        lines.push(`\n**Prerequisites:** ${target.prerequisites.join(", ")}`);
        lines.push(`**Key numbers:** ${target.keyNumbers.join("; ")}`);
        lines.push(`\n💡 Click the case study card to see the full whiteboard flow.`);
    }

    if (target.followUpTopics.length) {
      lines.push(`\n**Related:** ${target.followUpTopics.join(" · ")}`);
    }
  } else {
    // No case study match — give a general answer
    lines.push("I can help with system design topics! Here's what I know:\n");
    lines.push("**Available case studies:**");
    for (const c of SYSTEM_DESIGN_CASES.slice(0, 8)) {
      lines.push(`• ${c.icon} ${c.title} — ${c.blurb}`);
    }
    lines.push(`\nAsk about any of these, or try the quick-action buttons above.`);
  }

  // Append RAG context if available
  if (citations.length) {
    lines.push(`\n\n---\n📚 **From knowledge base:**`);
    citations.forEach(c => {
      lines.push(`• [${c.title}] ${c.content.slice(0, 200)}…`);
    });
  }

  return { text: lines.join("\n"), citations };
}

/* ------------------------------------------------------------------ */
/* Offline search (RAG) — best-effort, never throws                    */
/* ------------------------------------------------------------------ */

async function searchRag(query: string): Promise<{ title: string; content: string }[]> {
  try {
    const hits = await lexicalSearch(query, 5);
    if (!hits.length) return [];
    const titles = await documentTitles().catch(() => new Map<number, string>());
    return hits.map(h => ({
      title: titles.get(h.documentId) ?? "Knowledge base",
      content: h.content
    }));
  } catch { return []; }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FloatingCoach() {
  const { state } = useApp();
  const view = state.view;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"api" | "local">(aiAvailable() ? "api" : "local");
  const [msgs, setMsgs] = useState<FABMsg[]>(() => loadChatHistory());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Voice input */
  const speech = useSpeechRecognition();
  const [voiceActive, setVoiceActive] = useState(false);

  /* Persist chat history on every update */
  useEffect(() => {
    saveChatHistory(msgs);
  }, [msgs]);

  /* Populate input from voice transcript */
  useEffect(() => {
    if (speech.transcript) {
      setInput(prev => prev ? prev + " " + speech.transcript : speech.transcript);
    }
  }, [speech.transcript]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [msgs, busy, open]);

  /* Auto-switch mode when API key status changes */
  useEffect(() => {
    setMode(aiAvailable() ? "api" : "local");
  }, []);

  /* Ctrl+/ keyboard shortcut */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setOpen(prev => {
          if (!prev) setTimeout(() => inputRef.current?.focus(), 100);
          return !prev;
        });
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        if (voiceActive) { speech.stop(); setVoiceActive(false); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, voiceActive, speech]);

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(120, el.scrollHeight) + "px";
  };

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs(prev => [...prev, { role: "user", text }]);
    setBusy(true);
    try {
      if (mode === "api") {
        // API mode — use the configured OpenAI endpoint
        const sysCtx =
          "You are a friendly, senior technical interviewer and system design coach. " +
          "Keep replies focused, under 180 words. Use plain text diagrams (→ arrows) where helpful. " +
          "Be encouraging but precise — point out what the candidate is missing.";
        const history: ChatMessage[] = [
          { role: "system", content: sysCtx },
          ...msgs.map(m => ({ role: m.role, content: m.text })),
          { role: "user", content: text }
        ];
        const reply = await chat(history, { maxTokens: 450 });
        setMsgs(prev => [...prev, { role: "assistant", text: reply }]);
      } else {
        // Offline mode — fully local, NO API calls
        const matchedCase = view === "systemDesign" ? matchCaseStudy(text) : null;
        const ragHits = await searchRag(text);
        const { text: reply, citations } = await localReply(text, matchedCase, ragHits);
        setMsgs(prev => [...prev, {
          role: "assistant",
          text: reply,
          citations,
          grounded: citations.length > 0,
          citationsSource: "lexical"
        }]);
      }
    } catch (e) {
      const msg = (e as Error).message || "Coach unavailable";
      setMsgs(prev => [...prev, {
        role: "assistant",
        text: "⚠️ " + msg + (mode === "api" ? " — switch to 📚 Knowledge mode to keep going offline." : "")
      }]);
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    if (voiceActive) { speech.stop(); setVoiceActive(false); }
    submit(input);
  };

  const toggleVoice = () => {
    if (voiceActive) {
      speech.stop();
      setVoiceActive(false);
    } else {
      speech.start();
      setVoiceActive(true);
      toast("🎤 Listening — speak your question");
    }
  };

  const clearChat = () => {
    setMsgs([]);
    storageSet(CHAT_STORAGE_KEY, []);
    toast("🗑️ Chat cleared");
  };

  /* Quick-action chips */
  const quickActions = view === "systemDesign"
    ? [
        { label: "🏗️ Design overview", cmd: "Give me a quick architecture overview for this system" },
        { label: "⚖️ Trade-offs", cmd: "What are the key trade-offs I should know?" },
        { label: "⚠️ Common mistakes", cmd: "What are the most common mistakes candidates make?" },
        { label: "📐 Scale", cmd: "How would you handle scale for this system?" }
      ]
    : [
        { label: "💡 Hint", cmd: "Give me a hint" },
        { label: "📝 Explain", cmd: "Explain this concept" },
        { label: "🎯 Focus", cmd: "What should I focus on next?" },
        { label: "🤔 Debate", cmd: "I disagree — can you explain why?" }
      ];

  const seg = (active: boolean) =>
    `rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all ${active ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`;

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`no-print fixed bottom-20 right-4 z-[60] grid h-14 w-14 place-items-center rounded-full shadow-[0_8px_30px_rgba(99,102,241,.45)] transition-all hover:scale-110 md:bottom-8 ${open ? "bg-deep border-2 border-acc1/50" : "grad-bg"}`}
        title="AI Coach — ask me anything (Ctrl+/)"
        aria-label="Open AI Coach"
      >
        <span className="text-[22px]">{open ? "✕" : "🤖"}</span>
      </button>

      {/* Chat panel */}
      {open && (
        <div className="no-print fixed bottom-[90px] right-4 z-[59] w-[360px] max-w-[calc(100vw-2rem)] md:bottom-[80px]">
          <div className={`${cardCls} overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,.55)]`}>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-line/10 px-4 py-3">
              <span className="text-[16px]">🤖</span>
              <span className="flex-1 text-[13px] font-extrabold">AI Coach</span>
              {msgs.length > 0 && (
                <button
                  onClick={clearChat}
                  title="Clear chat history"
                  className="rounded-lg border border-line/15 px-2 py-0.5 text-[10px] font-bold text-mut transition-all hover:border-warn/40 hover:text-warn"
                >🗑️</button>
              )}
              <div className="flex gap-1">
                <button type="button" className={seg(mode === "api")} onClick={() => setMode("api")}>🤖 AI</button>
                <button type="button" className={seg(mode === "local")} onClick={() => setMode("local")}>📚 Offline</button>
              </div>
            </div>

            {mode === "local" && (
              <div className="border-b border-line/10 px-4 py-2">
                <GroundingNote minSim={ragTuningInfo().minSim} pool={ragTuningInfo().pool} />
              </div>
            )}

            {/* Keyboard shortcut hint */}
            {msgs.length === 0 && (
              <div className="px-4 pt-2 text-center">
                <span className="rounded-full border border-line/15 bg-wht/5 px-2.5 py-0.5 text-[10px] font-bold text-mut">Ctrl + / to toggle</span>
              </div>
            )}

            {/* Messages */}
            <div ref={boxRef} className="h-[300px] space-y-2 overflow-y-auto px-4 py-3 pr-2">
              {msgs.length === 0 ? (
                <div className="text-[12.5px] leading-relaxed text-mut">
                  {view === "systemDesign"
                    ? "I know about the system design case studies. Ask me about architecture, trade-offs, failure modes, or scale estimates."
                    : "Ask me anything — I can help with concepts, debugging, interview prep, or career advice. In 📚 Knowledge mode, I search the knowledge base."}
                </div>
              ) : (
                msgs.map((m, i) => (
                  <div key={i} className="flex flex-col">
                    {m.role === "user" && (
                      <div className="mb-0.5 text-right text-[10px] font-bold text-mut">You asked:</div>
                    )}
                    <div
                      className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${
                        m.role === "user" ? "ml-auto grad-bg text-white" : "bg-deep/60 text-ink"
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.role === "assistant" && m.citations?.length ? (
                      <div className="mt-1 max-w-[90%] space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-ok">
                          {citationSourceLabel(m.citations.length, m.citationsSource)}
                        </div>
                        {m.citations.map((ct, ci) => (
                          <CitationChip key={ci} title={ct.title} content={ct.content} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              {busy && <div className="text-[12px] text-mut">…thinking</div>}
              {voiceActive && (
                <div className="flex items-center gap-2 text-[12px] text-acc1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-acc1" />
                  <span className="font-bold">Listening…</span>
                  <span className="text-mut">speak now</span>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-1 border-t border-line/10 px-4 py-2">
              {quickActions.map(c => (
                <button
                  key={c.label}
                  type="button"
                  disabled={busy}
                  onClick={() => submit(c.cmd)}
                  className="rounded-full border border-line/15 px-2 py-0.5 text-[10.5px] font-bold text-mut transition-all hover:border-acc1/40 hover:text-ink disabled:opacity-50"
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Composer */}
            <div className="flex gap-2 border-t border-line/10 px-4 py-3">
              {speech.supported && (
                <button
                  onClick={toggleVoice}
                  title={voiceActive ? "Stop recording" : "Voice input — speak your question"}
                  className={`flex-none self-end rounded-xl border px-2.5 py-2 text-[14px] transition-all ${
                    voiceActive
                      ? "border-acc1/50 bg-acc1/15 text-acc1 animate-pulse"
                      : "border-line/25 bg-deep/60 text-mut hover:border-acc1/40 hover:text-acc1"
                  }`}
                >
                  🎤
                </button>
              )}
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder={view === "systemDesign" ? "Ask about this design…" : "Ask me anything…"}
                className="min-h-[36px] w-full flex-1 resize-none overflow-hidden rounded-xl border border-line/25 bg-deep/60 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className="self-end rounded-xl bg-acc1 px-3.5 py-2 text-[12px] font-bold text-white transition-all hover:bg-acc2 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
