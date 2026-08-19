/* Floating AI Coach — a global FAB button that opens a context-aware chat
   panel on every view. Two modes:
   - 🤖 AI (API key): uses the user's configured OpenAI-compatible endpoint
   - 📚 Knowledge (offline): lexical RAG retrieval over the knowledge base
   Context-aware: when on the System Design view, the coach knows about the
   current topic and can discuss architecture patterns.
   Features: voice input (Web Speech API), chat history persistence,
   Ctrl+/ keyboard shortcut to toggle. */

import { useCallback, useEffect, useRef, useState } from "react";
import { aiAvailable, chat, type ChatMessage } from "../ai";
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
  reset: () => void;
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
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
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

  const reset = useCallback(() => {
    setTranscript("");
    setListening(false);
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  return { supported, listening, transcript, start, stop, reset };
}

/* ------------------------------------------------------------------ */
/* Offline RAG reply                                                   */
/* ------------------------------------------------------------------ */

function buildSystemContext(view: string): string {
  const base =
    "You are a friendly, senior technical interviewer and system design coach. " +
    "Keep replies focused, under 180 words. Use plain text diagrams (→ arrows) where helpful. " +
    "Be encouraging but precise — point out what the candidate is missing.";

  if (view === "systemDesign") {
    return base + "\n\nThe user is on the System Design view. Discuss architecture, trade-offs, and scale.";
  }
  return base;
}

async function offlineRagReply(
  query: string,
  systemContext: string
): Promise<{ text: string; citations: { title: string; content: string; grounded: boolean }[] }> {
  const hits = await lexicalSearch(query, 5).catch(() => []);
  let citations: { title: string; content: string; grounded: boolean }[] = [];
  if (hits.length) {
    const titles = await documentTitles().catch(() => new Map<number, string>());
    citations = hits.map(h => ({
      title: titles.get(h.documentId) ?? "Knowledge base",
      content: h.content,
      grounded: h.score >= 0.4
    }));
  }
  const kbBlock = citations.length
    ? "\n\nKnowledge base excerpts:\n" + citations.map(c => `[${c.title}] ${c.content}`).join("\n\n")
    : "";
  const messages: ChatMessage[] = [
    { role: "system", content: systemContext + kbBlock },
    { role: "user", content: query }
  ];
  const text = await chat(messages, { maxTokens: 450 });
  return { text, citations };
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
      setInput(prev => {
        const combined = prev ? prev + " " + speech.transcript : speech.transcript;
        return combined;
      });
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
          const next = !prev;
          if (next) {
            // Focus input when opening
            setTimeout(() => inputRef.current?.focus(), 100);
          }
          return next;
        });
      }
      // Escape to close
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        if (voiceActive) {
          speech.stop();
          setVoiceActive(false);
        }
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
      const sysCtx = buildSystemContext(view);
      if (mode === "api") {
        const history: ChatMessage[] = [
          { role: "system", content: sysCtx },
          ...msgs.map(m => ({ role: m.role, content: m.text })),
          { role: "user", content: text }
        ];
        const reply = await chat(history, { maxTokens: 450 });
        setMsgs(prev => [...prev, { role: "assistant", text: reply }]);
      } else {
        const { text: reply, citations } = await offlineRagReply(text, sysCtx);
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
    // If voice is active, finalize transcript first
    if (voiceActive) {
      speech.stop();
      setVoiceActive(false);
    }
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
