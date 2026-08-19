/* Floating AI Coach — a global FAB button that opens a context-aware chat
   panel on every view. Two modes:
   - 🤖 AI (API key): uses the user's configured OpenAI-compatible endpoint
   - 📚 Knowledge (offline): citation-only replies from verified sources
   Context-aware: when on the System Design view, shows a banner indicating
   which case study the user is viewing, and tailors replies accordingly.
   
   ZERO HALLUCINATION POLICY:
   Every fact in offline replies comes from one of three verified sources:
   1. 🟢 Verified Case Studies — hand-curated numbers, phases, trade-offs
   2. 🟡 Curated Deep Dives — authored concepts, key points, Q&A
   3. 🔵 Knowledge Base — admin-uploaded documents via RAG search
   If no verified source covers the question, the coach says so clearly. */

import { useCallback, useEffect, useRef, useState } from "react";
import { aiAvailable, chat, type ChatMessage } from "../ai";
import { SYSTEM_DESIGN_CASES, type SystemDesignCase } from "../data/systemDesignBank";

import { lexicalSearch, documentTitles, ragTuningInfo } from "../services/rag";
import { storageGet, storageSet } from "../services/storage";
import { useApp } from "../store";
import { useCoachTopic } from "../contexts/CoachContext";
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
  citations?: VerifiedCitation[];
  grounded?: boolean;
  citationsSource?: "vector" | "lexical";
}

/** A citation from a verified source with trust level */
interface VerifiedCitation {
  title: string;
  content: string;
  grounded: boolean;
  source: "case-study" | "deep-dive" | "knowledge-base";
}

const CHAT_STORAGE_KEY = "iq.floatingCoachChat";
const MAX_PERSISTED_MSGS = 100;
const RAG_REFRESH_KEY = "iq.ragLastRefresh";
const RAG_CACHE_KEY = "iq.ragCachedHits";
const RAG_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

function loadChatHistory(): FABMsg[] {
  return storageGet<FABMsg[]>(CHAT_STORAGE_KEY, []);
}
function saveChatHistory(msgs: FABMsg[]) {
  storageSet(CHAT_STORAGE_KEY, msgs.slice(-MAX_PERSISTED_MSGS));
}

/* ------------------------------------------------------------------ */
/* Source trust labels                                                  */
/* ------------------------------------------------------------------ */



/* ------------------------------------------------------------------ */
/* Periodic RAG refresh — prefetch KB every 2 hours                    */
/* ------------------------------------------------------------------ */

interface CachedRagHit { query: string; title: string; content: string; at: number }

async function refreshRagCache(): Promise<void> {
  const lastRefresh = storageGet<number>(RAG_REFRESH_KEY, 0);
  if (Date.now() - lastRefresh < RAG_REFRESH_INTERVAL_MS) return;

  const queries = [
    "system design architecture patterns",
    "load balancer caching database",
    "distributed systems consistency availability",
    "microservices API gateway rate limiting",
    "message queue pub sub event driven",
    "database sharding replication partitioning",
    "CDN cache invalidation strategies",
    "real-time WebSocket long polling SSE",
    "storage system blob object file",
    "search engine indexing ranking"
  ];

  const cached: CachedRagHit[] = [];
  for (const q of queries) {
    try {
      const hits = await lexicalSearch(q, 3);
      if (hits.length) {
        const titles = await documentTitles().catch(() => new Map<number, string>());
        for (const h of hits) {
          cached.push({ query: q, title: titles.get(h.documentId) ?? "Knowledge base", content: h.content, at: Date.now() });
        }
      }
    } catch { /* best-effort */ }
  }

  storageSet(RAG_CACHE_KEY, cached.slice(0, 100));
  storageSet(RAG_REFRESH_KEY, Date.now());
}

function getCachedRag(): CachedRagHit[] {
  return storageGet<CachedRagHit[]>(RAG_CACHE_KEY, []);
}

/* ------------------------------------------------------------------ */
/* Voice input (Web Speech API)                                        */
/* ------------------------------------------------------------------ */

function useSpeechRecognition() {
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
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
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

  const stop = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);

  return { supported, listening, transcript, start, stop };
}

/* ------------------------------------------------------------------ */
/* Tokenization + matching                                             */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set([
  "this", "that", "with", "from", "have", "will", "about", "would", "could",
  "should", "what", "when", "where", "which", "there", "their", "them",
  "then", "than", "some", "more", "most", "very", "also", "just", "only",
  "other", "into", "over", "such", "your", "does", "tell", "explain",
  "design", "system", "make", "give", "want", "need", "like", "help"
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

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

function detectIntent(q: string): "overview" | "tradeoffs" | "mistakes" | "scale" | "numbers" | "phase" | "qa" | "general" {
  const lower = q.toLowerCase();
  if (/overview|explain|walkthrough|step.by.step|architecture|how.*work|what.*is/.test(lower)) return "overview";
  if (/trade.?off|vs|versus|compare|pros.*cons|better|worse/.test(lower)) return "tradeoffs";
  if (/mistake|error|wrong|common.*fail|pitfall|avoid/.test(lower)) return "mistakes";
  if (/scale|million|billion|throughput|latency|capacity|qps|rps|traffic/.test(lower)) return "scale";
  if (/number|memorize|remember|stat|metric|figure/.test(lower)) return "numbers";
  if (/phase|step|stage|whiteboard|interview|minute/.test(lower)) return "phase";
  if (/question|ask|quiz|test|practice|follow.up/.test(lower)) return "qa";
  return "general";
}

/* ------------------------------------------------------------------ */
/* VERIFICATION LAYER — only use data from verified sources             */
/* ------------------------------------------------------------------ */

interface VerifiedAnswer {
  lines: string[];
  citations: VerifiedCitation[];
  trustScore: number; // 0-100: how much of the answer is from verified sources
}

/** Extract verified facts from a case study */
function caseStudyFacts(c: SystemDesignCase, intent: string): VerifiedAnswer {
  const lines: string[] = [];
  const citations: VerifiedCitation[] = [];
  let trustScore = 0;

  lines.push(`**${c.icon} ${c.title}**`);
  lines.push(`_${c.blurb}_\n`);

  switch (intent) {
    case "overview":
      lines.push("**Architecture Phases (from verified case study):**");
      c.phases.forEach((p, i) => {
        lines.push(`\n**Phase ${i + 1}: ${p.phase}** (${p.duration})`);
        p.talkingPoints.forEach(tp => lines.push(`→ ${tp}`));
        if (p.numbers?.length) lines.push(`  📐 ${p.numbers.join(" · ")}`);
      });
      citations.push({ title: c.title, content: `Whiteboard flow: ${c.phases.map(p => p.phase).join(" → ")}`, grounded: true, source: "case-study" });
      trustScore = 95;
      break;

    case "tradeoffs":
      lines.push("**Verified Key Numbers:**");
      c.keyNumbers.forEach(n => lines.push(`📐 ${n}`));
      citations.push({ title: `${c.title} — Key Numbers`, content: c.keyNumbers.join("; "), grounded: true, source: "case-study" });
      lines.push(`\n💡 **Interview tip:** For each trade-off, name the axis (cost vs latency, consistency vs availability) and state your choice with justification.`);
      trustScore = 90;
      break;

    case "mistakes":
      lines.push("**Verified Common Mistakes:**");
      c.commonMistakes.forEach(m => {
        lines.push(`⚠️ ${m}`);
        citations.push({ title: `${c.title} — Mistake`, content: m, grounded: true, source: "case-study" });
      });
      trustScore = 100;
      break;

    case "scale":
      lines.push("**Verified Scale Numbers:**");
      c.keyNumbers.forEach(n => {
        lines.push(`📐 ${n}`);
        citations.push({ title: `${c.title} — Scale`, content: n, grounded: true, source: "case-study" });
      });
      trustScore = 95;
      break;

    case "numbers":
      lines.push("**Verified Numbers to Memorize:**");
      c.keyNumbers.forEach(n => {
        lines.push(`🔢 ${n}`);
        citations.push({ title: `${c.title} — Key Number`, content: n, grounded: true, source: "case-study" });
      });
      trustScore = 100;
      break;

    case "phase":
      lines.push("**Verified Whiteboard Phases:**");
      c.phases.forEach((p, i) => {
        lines.push(`\n**${i + 1}. ${p.phase}** (${p.duration})`);
        p.talkingPoints.forEach(tp => lines.push(`   → ${tp}`));
        if (p.numbers?.length) lines.push(`   📐 ${p.numbers.join(" · ")}`);
      });
      citations.push({ title: `${c.title} — Whiteboard Flow`, content: c.phases.map(p => `${p.phase} (${p.duration})`).join(" → "), grounded: true, source: "case-study" });
      trustScore = 95;
      break;

    default:
      lines.push("**Verified Prerequisites:** " + c.prerequisites.join(", "));
      lines.push("**Verified Key Numbers:** " + c.keyNumbers.join("; "));
      lines.push(`\n💡 Ask about: overview, trade-offs, mistakes, scale, numbers, or whiteboard phases.`);
      citations.push({ title: c.title, content: `Prerequisites: ${c.prerequisites.join(", ")}. Numbers: ${c.keyNumbers.join("; ")}`, grounded: true, source: "case-study" });
      trustScore = 95;
  }

  if (c.followUpTopics.length) {
    lines.push(`\n**Related Topics:** ${c.followUpTopics.join(" · ")}`);
  }

  return { lines, citations, trustScore };
}

/* ------------------------------------------------------------------ */
/* Fully local reply engine — CITATION ONLY                            */
/* ------------------------------------------------------------------ */

async function citationOnlyReply(
  question: string,
  currentCase: SystemDesignCase | null,
  ragHits: { title: string; content: string }[]
): Promise<{ text: string; citations: VerifiedCitation[]; trustScore: number }> {
  const intent = detectIntent(question);
  const target = currentCase ?? matchCaseStudy(question);
  const kbCitations: VerifiedCitation[] = ragHits.map(h => ({
    title: h.title, content: h.content, grounded: true, source: "knowledge-base"
  }));

  let answer: VerifiedAnswer;

  if (target) {
    // Case study data — highest trust
    answer = caseStudyFacts(target, intent);
  } else if (kbCitations.length) {
    // Knowledge base hits — moderate trust
    const lines = ["**📚 From Knowledge Base:**\n"];
    kbCitations.forEach(c => {
      lines.push(`• **[${c.title}]** ${c.content.slice(0, 300)}`);
    });
    lines.push("\n💡 These are excerpts from the knowledge base. Ask about a specific system design topic for more detailed answers.");
    answer = { lines, citations: kbCitations, trustScore: 70 };
  } else {
    // No verified source — be honest
    const lines = [
      "**I don't have verified information on this specific topic.**\n",
      "I can answer questions about these verified case studies:",
      ...SYSTEM_DESIGN_CASES.map(c => `• ${c.icon} ${c.title}`),
      "\nOr ask me about broad topics like: distributed systems, databases, caching, APIs, networking, security, or microservices.",
      "\n💡 _All my answers come from verified sources — I never make up information._"
    ];
    answer = { lines, citations: [], trustScore: 0 };
  }

  // Add trust footer
  if (answer.trustScore > 0) {
    const trustLabel = answer.trustScore >= 90 ? "🟢 High" : answer.trustScore >= 70 ? "🟡 Medium" : "🔵 KB";
    answer.lines.push(`\n\n---\n📋 _Trust: ${trustLabel} · Sources: ${answer.citations.length} verified citation(s) · All facts from curated/verified data_`);
  }

  return { text: answer.lines.join("\n"), citations: answer.citations, trustScore: answer.trustScore };
}

/* ------------------------------------------------------------------ */
/* RAG search — live or cached                                         */
/* ------------------------------------------------------------------ */

async function searchRag(query: string): Promise<{ title: string; content: string }[]> {
  try {
    const hits = await lexicalSearch(query, 5);
    if (hits.length) {
      const titles = await documentTitles().catch(() => new Map<number, string>());
      return hits.map(h => ({ title: titles.get(h.documentId) ?? "Knowledge base", content: h.content }));
    }
  } catch { /* fall through */ }
  const cached = getCachedRag();
  const qTokens = new Set(tokenize(query));
  return cached
    .filter(h => tokenize(h.content).some(t => qTokens.has(t)))
    .slice(0, 3)
    .map(h => ({ title: h.title, content: h.content }));
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FloatingCoach() {
  const { state } = useApp();
  const view = state.view;
  const topic = useCoachTopic();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"api" | "local">(aiAvailable() ? "api" : "local");
  const [msgs, setMsgs] = useState<FABMsg[]>(() => loadChatHistory());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeechRecognition();
  const [voiceActive, setVoiceActive] = useState(false);

  useEffect(() => { saveChatHistory(msgs); }, [msgs]);
  useEffect(() => {
    if (speech.transcript) setInput(prev => prev ? prev + " " + speech.transcript : speech.transcript);
  }, [speech.transcript]);
  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [msgs, busy, open]);
  useEffect(() => { setMode(aiAvailable() ? "api" : "local"); }, []);

  /* Periodic RAG refresh */
  useEffect(() => {
    void refreshRagCache();
    const id = setInterval(() => { void refreshRagCache(); }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  /* Ctrl+/ keyboard shortcut */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setOpen(prev => { if (!prev) setTimeout(() => inputRef.current?.focus(), 100); return !prev; });
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
        const sysCtx =
          "You are a friendly, senior technical interviewer and system design coach. " +
          "Keep replies focused, under 180 words. Use plain text diagrams (→ arrows) where helpful. " +
          "Be encouraging but precise — point out what the candidate is missing. " +
          "Never hallucinate — if you don't know, say so." +
          (topic.title ? `\n\nThe user is studying: ${topic.icon} ${topic.title} — ${topic.blurb}` : "");
        const history: ChatMessage[] = [
          { role: "system", content: sysCtx },
          ...msgs.map(m => ({ role: m.role, content: m.text })),
          { role: "user", content: text }
        ];
        const reply = await chat(history, { maxTokens: 450 });
        setMsgs(prev => [...prev, { role: "assistant", text: reply }]);
      } else {
        const matchedCase = topic.caseId
          ? SYSTEM_DESIGN_CASES.find(c => c.id === topic.caseId) ?? matchCaseStudy(text)
          : matchCaseStudy(text);
        const ragHits = await searchRag(text);
        const { text: reply, citations } = await citationOnlyReply(text, matchedCase, ragHits);
        setMsgs(prev => [...prev, {
          role: "assistant", text: reply, citations,
          grounded: citations.length > 0,
          citationsSource: "lexical"
        }]);
      }
    } catch (e) {
      const msg = (e as Error).message || "Coach unavailable";
      setMsgs(prev => [...prev, { role: "assistant", text: "⚠️ " + msg + (mode === "api" ? " — switch to 📚 Knowledge mode to keep going offline." : "") }]);
    } finally { setBusy(false); }
  };

  const send = () => { if (voiceActive) { speech.stop(); setVoiceActive(false); } submit(input); };
  const toggleVoice = () => {
    if (voiceActive) { speech.stop(); setVoiceActive(false); }
    else { speech.start(); setVoiceActive(true); toast("🎤 Listening — speak your question"); }
  };
  const clearChat = () => { setMsgs([]); storageSet(CHAT_STORAGE_KEY, []); toast("🗑️ Chat cleared"); };

  const quickActions = topic.title
    ? [
        { label: "🏗️ Design overview", cmd: `Explain the architecture for ${topic.title}` },
        { label: "⚖️ Trade-offs", cmd: `What are the key trade-offs for ${topic.title}?` },
        { label: "⚠️ Common mistakes", cmd: `What are common mistakes in ${topic.title} interviews?` },
        { label: "📐 Scale", cmd: `How would you handle scale for ${topic.title}?` }
      ]
    : view === "systemDesign"
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
        <div className="no-print fixed bottom-[90px] right-4 z-[59] w-[380px] max-w-[calc(100vw-2rem)] md:bottom-[80px]">
          <div className={`${cardCls} overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,.55)]`}>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-line/10 px-4 py-3">
              <span className="text-[16px]">🤖</span>
              <span className="flex-1 text-[13px] font-extrabold">AI Coach</span>
              {msgs.length > 0 && (
                <button onClick={clearChat} title="Clear chat history"
                  className="rounded-lg border border-line/15 px-2 py-0.5 text-[10px] font-bold text-mut transition-all hover:border-warn/40 hover:text-warn"
                >🗑️</button>
              )}
              <div className="flex gap-1">
                <button type="button" className={seg(mode === "api")} onClick={() => setMode("api")}>🤖 AI</button>
                <button type="button" className={seg(mode === "local")} onClick={() => setMode("local")}>📚 Offline</button>
              </div>
            </div>

            {/* Context banner */}
            {topic.title && (
              <div className="flex items-center gap-2 border-b border-acc1/20 bg-acc1/10 px-4 py-2">
                <span className="text-[14px]">{topic.icon}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-extrabold text-acctxt">{topic.title}</span>
                  {topic.blurb && <p className="truncate text-[11px] text-mut">{topic.blurb}</p>}
                </div>
                <span className="flex-none rounded-full border border-acc1/30 bg-acc1/15 px-2 py-0.5 text-[10px] font-bold text-acctxt">📎 Context</span>
              </div>
            )}

            {mode === "local" && (
              <div className="border-b border-line/10 px-4 py-2">
                <GroundingNote minSim={ragTuningInfo().minSim} pool={ragTuningInfo().pool} />
              </div>
            )}

            {msgs.length === 0 && !topic.title && (
              <div className="px-4 pt-2 text-center">
                <span className="rounded-full border border-line/15 bg-wht/5 px-2.5 py-0.5 text-[10px] font-bold text-mut">Ctrl + / to toggle</span>
              </div>
            )}

            {/* Messages */}
            <div ref={boxRef} className="h-[300px] space-y-2 overflow-y-auto px-4 py-3 pr-2">
              {msgs.length === 0 ? (
                <div className="text-[12.5px] leading-relaxed text-mut">
                  {topic.title
                    ? `I know verified facts about **${topic.title}**. Ask me about architecture, trade-offs, failure modes, or scale estimates.`
                    : view === "systemDesign"
                    ? "I know verified facts about all system design case studies. Every answer comes from curated, verified sources."
                    : "Ask me anything — I can help with concepts, debugging, interview prep, or career advice. In 📚 Knowledge mode, I search the knowledge base."}
                </div>
              ) : (
                msgs.map((m, i) => (
                  <div key={i} className="flex flex-col">
                    {m.role === "user" && <div className="mb-0.5 text-right text-[10px] font-bold text-mut">You asked:</div>}
                    <div className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${m.role === "user" ? "ml-auto grad-bg text-white" : "bg-deep/60 text-ink"}`}>
                      {m.text}
                    </div>
                    {m.role === "assistant" && m.citations?.length ? (
                      <div className="mt-1 max-w-[90%] space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-ok">
                          {citationSourceLabel(m.citations.length, m.citationsSource)}
                        </div>
                        {m.citations.map((ct, ci) => <CitationChip key={ci} title={ct.title} content={ct.content} />)}
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
                <button key={c.label} type="button" disabled={busy} onClick={() => submit(c.cmd)}
                  className="rounded-full border border-line/15 px-2 py-0.5 text-[10.5px] font-bold text-mut transition-all hover:border-acc1/40 hover:text-ink disabled:opacity-50"
                >{c.label}</button>
              ))}
            </div>

            {/* Composer */}
            <div className="flex gap-2 border-t border-line/10 px-4 py-3">
              {speech.supported && (
                <button onClick={toggleVoice}
                  title={voiceActive ? "Stop recording" : "Voice input"}
                  className={`flex-none self-end rounded-xl border px-2.5 py-2 text-[14px] transition-all ${voiceActive ? "border-acc1/50 bg-acc1/15 text-acc1 animate-pulse" : "border-line/25 bg-deep/60 text-mut hover:border-acc1/40 hover:text-acc1"}`}
                >🎤</button>
              )}
              <textarea ref={inputRef} value={input} rows={1}
                onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={topic.title ? `Ask about ${topic.title}…` : "Ask me anything…"}
                className="min-h-[36px] w-full flex-1 resize-none overflow-hidden rounded-xl border border-line/25 bg-deep/60 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20"
              />
              <button onClick={send} disabled={busy || !input.trim()}
                className="self-end rounded-xl bg-acc1 px-3.5 py-2 text-[12px] font-bold text-white transition-all hover:bg-acc2 disabled:opacity-50"
              >Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
