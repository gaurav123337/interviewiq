/* Floating AI Coach — a global FAB button that opens a context-aware chat
   panel on every view. Two coach modes:
   - 🏗️ System Design Coach — context-aware, focused on system design topics
   - 💬 General Chat — like ChatGPT, can discuss any topic, AI + offline RAG
   
   Each mode has separate chat histories and quick actions.
   Both modes support 🤖 AI (API key) and 📚 Offline (RAG) modes. */

import { useCallback, useEffect, useRef, useState } from "react";
import { aiAvailable, chat, type ChatMessage } from "../ai";
import type { SystemDesignCase } from "../data/systemDesignBank";
import { getPrereqExplanation } from "../data/prerequisiteKnowledge";
import { lexicalSearch, documentTitles, ragTuningInfo } from "../services/rag";
import { storageGet, storageSet } from "../services/storage";
import { useCoachTopic } from "../contexts/CoachContext";

/* Lazy-load the heavy system design bank (~1 KB → 1,080 lines of data) */
let _casesCache: SystemDesignCase[] | null = null;
let _casesPromise: Promise<SystemDesignCase[]> | null = null;
function loadCases(): Promise<SystemDesignCase[]> {
  if (_casesCache) return Promise.resolve(_casesCache);
  if (!_casesPromise) _casesPromise = import("../data/systemDesignBank").then(m => { _casesCache = m.SYSTEM_DESIGN_CASES; return _casesCache; });
  return _casesPromise;
}
/** Sync accessor — returns cached data once loaded, empty array before. */
function getCases(): SystemDesignCase[] { return _casesCache ?? []; }
import { citationSourceLabel } from "./CoachChat";
import { CitationChip } from "./CitationChip";
import { GroundingNote } from "./GroundingNote";
import { cardCls } from "./ui";
import { toast } from "../toast";

/* ------------------------------------------------------------------ */
/* Types + persistence                                                 */
/* ------------------------------------------------------------------ */

interface FABMsg {
  role: "user" | "assistant";
  text: string;
  citations?: VerifiedCitation[];
  grounded?: boolean;
  citationsSource?: "vector" | "lexical";
}

interface VerifiedCitation {
  title: string;
  content: string;
  grounded: boolean;
  source: "case-study" | "deep-dive" | "knowledge-base";
}

type CoachType = "system-design" | "general";

const SD_KEY = "iq.floatingCoachChat";
const GEN_KEY = "iq.generalChatHistory";
const TYPE_KEY = "iq.coachType";
const MAX_MSGS = 100;
const RAG_REFRESH_KEY = "iq.ragLastRefresh";
const RAG_CACHE_KEY = "iq.ragCachedHits";
const RAG_INTERVAL = 2 * 60 * 60 * 1000;

function loadMsgs(k: string): FABMsg[] { return storageGet<FABMsg[]>(k, []); }
function saveMsgs(k: string, m: FABMsg[]) { storageSet(k, m.slice(-MAX_MSGS)); }
function loadTopicHistory(): string[] { return storageGet<string[]>("iq.coachTopicHistory", []); }
function getCaseById(id: string) { return getCases().find(c => c.id === id); }

/* ------------------------------------------------------------------ */
/* RAG refresh                                                         */
/* ------------------------------------------------------------------ */

interface CachedRagHit { query: string; title: string; content: string; at: number }

async function refreshRagCache(): Promise<void> {
  const last = storageGet<number>(RAG_REFRESH_KEY, 0);
  if (Date.now() - last < RAG_INTERVAL) return;
  const queries = [
    "system design architecture patterns", "load balancer caching database",
    "distributed systems consistency availability", "microservices API gateway rate limiting",
    "message queue pub sub event driven", "database sharding replication partitioning",
    "CDN cache invalidation strategies", "real-time WebSocket long polling SSE",
    "storage system blob object file", "search engine indexing ranking"
  ];
  const cached: CachedRagHit[] = [];
  for (const q of queries) {
    try {
      const hits = await lexicalSearch(q, 3);
      if (hits.length) {
        const titles = await documentTitles().catch(() => new Map<number, string>());
        for (const h of hits) cached.push({ query: q, title: titles.get(h.documentId) ?? "Knowledge base", content: h.content, at: Date.now() });
      }
    } catch { /* */ }
  }
  storageSet(RAG_CACHE_KEY, cached.slice(0, 100));
  storageSet(RAG_REFRESH_KEY, Date.now());
}

function getCachedRag(): CachedRagHit[] { return storageGet<CachedRagHit[]>(RAG_CACHE_KEY, []); }

/* ------------------------------------------------------------------ */
/* Voice input                                                         */
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
    const rec: any = new Ctor();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (e: any) => { let f = ""; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) f += e.results[i][0].transcript; } if (f) setTranscript(p => (p + " " + f).trim()); };
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true); setTranscript("");
  }, [supported]);
  const stop = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  return { supported, listening, transcript, start, stop };
}

/* ------------------------------------------------------------------ */
/* Tokenization + matching                                             */
/* ------------------------------------------------------------------ */

const STOP = new Set(["this","that","with","from","have","will","about","would","could","should","what","when","where","which","there","their","them","then","than","some","more","most","very","also","just","only","other","into","over","such","your","does","tell","explain","design","system","make","give","want","need","like","help"]);
function tokenize(t: string) { return t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)); }

function matchCaseStudy(q: string): SystemDesignCase | null {
  const qt = new Set(tokenize(q)); let best: SystemDesignCase | null = null, bestS = 0;
  for (const c of getCases()) {
    const ht = new Set(tokenize([c.title, c.blurb, ...c.prerequisites, ...c.followUpTopics].join(" ").toLowerCase()));
    let s = 0; for (const t of qt) { if (c.title.toLowerCase().includes(t)) s += 3; if (ht.has(t)) s += 1; }
    if (s > bestS) { bestS = s; best = c; }
  }
  return bestS >= 2 ? best : null;
}

function detectIntent(q: string): "overview" | "tradeoffs" | "mistakes" | "scale" | "numbers" | "phase" | "qa" | "general" {
  const l = q.toLowerCase();
  if (/overview|explain|walkthrough|architecture|how.*work|what.*is/.test(l)) return "overview";
  if (/trade.?off|vs|versus|compare|pros.*cons/.test(l)) return "tradeoffs";
  if (/mistake|error|wrong|pitfall|avoid/.test(l)) return "mistakes";
  if (/scale|million|billion|throughput|latency|capacity/.test(l)) return "scale";
  if (/number|memorize|remember|stat|metric/.test(l)) return "numbers";
  if (/phase|step|stage|whiteboard|interview|minute/.test(l)) return "phase";
  if (/question|ask|quiz|test|practice/.test(l)) return "qa";
  return "general";
}

function findPrereqMatch(q: string): string | null {
  const l = q.toLowerCase();
  const concepts = ["http basics","websockets","web sockets","load balancing","caching","database design","hashing","message queues","social graphs","database sharding","rate limiting","event-driven architecture","long polling","pub-sub","rest api","microservices","consistent hashing"];
  for (const c of concepts) { if (l.includes(c) || l.includes(c.replace(" ", "-"))) return c; }
  return null;
}

/* ------------------------------------------------------------------ */
/* Verified facts from case studies                                    */
/* ------------------------------------------------------------------ */

interface VerifiedAnswer { lines: string[]; citations: VerifiedCitation[]; trustScore: number; }

function caseStudyFacts(c: SystemDesignCase, intent: string): VerifiedAnswer {
  const lines: string[] = []; const cites: VerifiedCitation[] = []; let ts = 0;
  lines.push(`${c.icon} **${c.title}**`, `_${c.blurb}_`, "");
  switch (intent) {
    case "overview":
      lines.push("**Architecture Phases:**");
      c.phases.forEach((p, i) => { lines.push("", `**Phase ${i + 1}: ${p.phase}** (${p.duration})`); p.talkingPoints.forEach(tp => lines.push(`→ ${tp}`)); if (p.numbers?.length) lines.push(`  📐 ${p.numbers.join(" · ")}`); });
      cites.push({ title: c.title, content: `Phases: ${c.phases.map(p => p.phase).join(" → ")}`, grounded: true, source: "case-study" }); ts = 95; break;
    case "tradeoffs":
      lines.push("**Key Numbers:**"); c.keyNumbers.forEach(n => { lines.push(`📐 ${n}`); cites.push({ title: `${c.title} — Scale`, content: n, grounded: true, source: "case-study" }); });
      lines.push("", "💡 **Interview tip:** Name the axis (cost vs latency) and state your choice."); ts = 90; break;
    case "mistakes":
      lines.push("**Common Mistakes:**"); c.commonMistakes.forEach(m => { lines.push(`⚠️ ${m}`); cites.push({ title: `${c.title} — Mistake`, content: m, grounded: true, source: "case-study" }); }); ts = 100; break;
    case "scale":
      lines.push("**Scale Numbers:**"); c.keyNumbers.forEach(n => { lines.push(`📐 ${n}`); cites.push({ title: `${c.title} — Scale`, content: n, grounded: true, source: "case-study" }); }); ts = 95; break;
    case "numbers":
      lines.push("**Numbers to Memorize:**"); c.keyNumbers.forEach(n => { lines.push(`🔢 ${n}`); cites.push({ title: `${c.title} — Number`, content: n, grounded: true, source: "case-study" }); }); ts = 100; break;
    case "phase":
      lines.push("**Whiteboard Phases:**"); c.phases.forEach((p, i) => { lines.push("", `**${i + 1}. ${p.phase}** (${p.duration})`); p.talkingPoints.forEach(tp => lines.push(`   → ${tp}`)); }); ts = 95; break;
    default:
      lines.push(`**Prerequisites:** ${c.prerequisites.join(", ")}`, `**Key Numbers:** ${c.keyNumbers.join("; ")}`, "", "💡 Ask about: overview, trade-offs, mistakes, scale, or phases.");
      cites.push({ title: c.title, content: `Prereqs: ${c.prerequisites.join(", ")}. Numbers: ${c.keyNumbers.join("; ")}`, grounded: true, source: "case-study" }); ts = 95;
  }
  if (c.followUpTopics.length) lines.push("", `**Related:** ${c.followUpTopics.join(" · ")}`);
  return { lines, citations: cites, trustScore: ts };
}

/* ------------------------------------------------------------------ */
/* Offline reply engines                                               */
/* ------------------------------------------------------------------ */

async function sdOfflineReply(q: string, cur: SystemDesignCase | null, rag: { title: string; content: string }[]): Promise<{ text: string; citations: VerifiedCitation[]; trustScore: number }> {
  const intent = detectIntent(q);
  const target = cur ?? matchCaseStudy(q);
  const kb: VerifiedCitation[] = rag.map(h => ({ title: h.title, content: h.content, grounded: true, source: "knowledge-base" as const }));

  // Prereq knowledge base
  const pm = findPrereqMatch(q);
  if (pm) {
    const pr = getPrereqExplanation(pm, target?.id);
    if (pr) {
      const lines = [`📘 **${pm}**`, "", `🟢 **Beginner:** ${pr.beginner}`, "", `🟡 **Intermediate:** ${pr.intermediate}`, "", `🔴 **Advanced:** ${pr.advanced}`];
      if (pr.context) lines.push("", `📌 **In ${target?.title ?? "this system"}:** ${pr.context}`);
      return { text: lines.join("\n"), citations: [{ title: `${pm} — Knowledge Base`, content: pr.context ?? pr.beginner, grounded: true, source: "deep-dive" }], trustScore: 90 };
    }
  }

  let a: VerifiedAnswer;
  if (target) { a = caseStudyFacts(target, intent); }
  else if (kb.length) {
    const lines = ["**📚 From Knowledge Base:**", ""];
    kb.forEach(c => lines.push(`• **[${c.title}]** ${c.content.slice(0, 300)}`));
    lines.push("", "💡 Ask about a specific system design topic for more detail.");
    a = { lines, citations: kb, trustScore: 70 };
  } else {
    a = { lines: [
      "**I don't have verified info on this topic yet.**", "",
      "I can answer about these case studies:",
      ...getCases().map(c => `• ${c.icon} ${c.title}`), "",
      "---", "🌐 **Need more details?** For topics I don't cover:",
      "• Google it — search the concept + 'system design interview'",
      "• Check official docs (Redis, Kafka, etc.)",
      "• Switch to 🤖 AI mode for generative answers", "",
      "💡 _All answers come from verified sources._"
    ], citations: [], trustScore: 0 };
  }

  if (a.trustScore > 0) {
    const tl = a.trustScore >= 90 ? "🟢 High" : a.trustScore >= 70 ? "🟡 Medium" : "🔵 KB";
    a.lines.push("", "---", `_Trust: ${tl} · ${a.citations.length} citation(s) · All facts from verified data_`);
  }
  return { text: a.lines.join("\n"), citations: a.citations, trustScore: a.trustScore };
}

async function genOfflineReply(_q: string, rag: { title: string; content: string }[]): Promise<{ text: string; citations: VerifiedCitation[] }> {
  const kb: VerifiedCitation[] = rag.map(h => ({ title: h.title, content: h.content, grounded: true, source: "knowledge-base" as const }));
  if (kb.length) {
    const lines = ["**📚 From Knowledge Base:**", ""];
    kb.forEach(c => lines.push(`• **[${c.title}]** ${c.content.slice(0, 400)}`));
    lines.push("", "_These are knowledge base excerpts. For a more detailed answer, try 🤖 AI mode._");
    return { text: lines.join("\n"), citations: kb };
  }
  return {
    text: [
      "**I don't have info on this topic in my knowledge base yet.**", "",
      "🌐 **To get a better answer:**",
      "• Try 🤖 AI mode — switch for a generative answer (needs API key)",
      "• Google it — search for this topic online",
      "• Check official documentation", "",
      "_My offline mode searches a curated knowledge base. For broader topics, AI mode or the internet works better._"
    ].join("\n"),
    citations: []
  };
}

async function searchRag(q: string): Promise<{ title: string; content: string }[]> {
  try {
    const hits = await lexicalSearch(q, 5);
    if (hits.length) { const titles = await documentTitles().catch(() => new Map<number, string>()); return hits.map(h => ({ title: titles.get(h.documentId) ?? "Knowledge base", content: h.content })); }
  } catch { /* */ }
  const cached = getCachedRag(); const qt = new Set(tokenize(q));
  return cached.filter(h => tokenize(h.content).some(t => qt.has(t))).slice(0, 3).map(h => ({ title: h.title, content: h.content }));
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FloatingCoach() {
  const topic = useCoachTopic();
  const [open, setOpen] = useState(false);
  const [coachType, setCoachType] = useState<CoachType>(() => storageGet<CoachType>(TYPE_KEY, "system-design"));
  const [mode, setMode] = useState<"api" | "local">(aiAvailable() ? "api" : "local");
  const [sdMsgs, setSdMsgs] = useState<FABMsg[]>(() => loadMsgs(SD_KEY));
  const [genMsgs, setGenMsgs] = useState<FABMsg[]>(() => loadMsgs(GEN_KEY));
  const msgs = coachType === "system-design" ? sdMsgs : genMsgs;
  const setMsgs = coachType === "system-design" ? setSdMsgs : setGenMsgs;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [topicHistory, setTopicHistory] = useState<string[]>(() => loadTopicHistory());
  const speech = useSpeechRecognition();
  const [voiceActive, setVoiceActive] = useState(false);

  useEffect(() => { saveMsgs(SD_KEY, sdMsgs); }, [sdMsgs]);
  useEffect(() => { saveMsgs(GEN_KEY, genMsgs); }, [genMsgs]);
  useEffect(() => { storageSet(TYPE_KEY, coachType); }, [coachType]);
  useEffect(() => { if (speech.transcript) setInput(p => p ? p + " " + speech.transcript : speech.transcript); }, [speech.transcript]);
  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }); }, [msgs, busy, open]);
  useEffect(() => { setMode(aiAvailable() ? "api" : "local"); }, []);
  useEffect(() => { const id = setInterval(() => setTopicHistory(loadTopicHistory()), 2000); return () => clearInterval(id); }, []);
  useEffect(() => { void refreshRagCache(); const id = setInterval(() => void refreshRagCache(), 30 * 60 * 1000); return () => clearInterval(id); }, []);

  /* Pre-load the system design cases so matchCaseStudy is ready on first use */
  useEffect(() => { void loadCases(); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") { e.preventDefault(); setOpen(p => { if (!p) setTimeout(() => inputRef.current?.focus(), 100); return !p; }); }
      if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); if (voiceActive) { speech.stop(); setVoiceActive(false); } }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, voiceActive, speech]);

  const autoGrow = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = Math.min(120, el.scrollHeight) + "px"; };

  const submit = async (raw: string) => {
    const text = raw.trim(); if (!text || busy) return;
    setInput(""); setMsgs(p => [...p, { role: "user", text }]); setBusy(true);
    try {
      if (mode === "api") {
        const sys = coachType === "system-design"
          ? "You are a friendly, senior technical interviewer and system design coach. Keep replies under 180 words. Use → arrows for diagrams. Be encouraging but precise. Never hallucinate." + (topic.title ? `\nThe user is studying: ${topic.icon} ${topic.title} — ${topic.blurb}` : "")
          : "You are a helpful, knowledgeable AI assistant — like ChatGPT. Be friendly, clear, and thorough. Use markdown for readability. Keep replies under 200 words unless asked for more. Discuss any topic: tech, career, life, hobbies, etc.";
        const history: ChatMessage[] = [{ role: "system", content: sys }, ...msgs.map(m => ({ role: m.role, content: m.text })), { role: "user", content: text }];
        const reply = await chat(history, { maxTokens: coachType === "system-design" ? 450 : 600 });
        setMsgs(p => [...p, { role: "assistant", text: reply }]);
      } else {
        const rag = await searchRag(text);
        if (coachType === "system-design") {
          const mc = topic.caseId ? getCases().find(c => c.id === topic.caseId) ?? matchCaseStudy(text) : matchCaseStudy(text);
          const { text: reply, citations } = await sdOfflineReply(text, mc, rag);
          setMsgs(p => [...p, { role: "assistant", text: reply, citations, grounded: citations.length > 0, citationsSource: "lexical" }]);
        } else {
          const { text: reply, citations } = await genOfflineReply(text, rag);
          setMsgs(p => [...p, { role: "assistant", text: reply, citations, grounded: citations.length > 0, citationsSource: "lexical" }]);
        }
      }
    } catch (e) {
      setMsgs(p => [...p, { role: "assistant", text: "⚠️ " + ((e as Error).message || "Coach unavailable") + (mode === "api" ? " — switch to 📚 Offline to keep going." : "") }]);
    } finally { setBusy(false); }
  };

  const send = () => { if (voiceActive) { speech.stop(); setVoiceActive(false); } submit(input); };
  const toggleVoice = () => { if (voiceActive) { speech.stop(); setVoiceActive(false); } else { speech.start(); setVoiceActive(true); toast("🎤 Listening — speak your question"); } };
  const clearChat = () => { if (coachType === "system-design") { setSdMsgs([]); storageSet(SD_KEY, []); } else { setGenMsgs([]); storageSet(GEN_KEY, []); } toast("🗑️ Chat cleared"); };

  const quickActions = coachType === "system-design"
    ? topic.title
      ? [{ label: "🏗️ Overview", cmd: `Explain the architecture for ${topic.title}` }, { label: "⚖️ Trade-offs", cmd: `Key trade-offs for ${topic.title}?` }, { label: "⚠️ Mistakes", cmd: `Common mistakes in ${topic.title}?` }, { label: "📐 Scale", cmd: `How to handle scale for ${topic.title}?` }]
      : [{ label: "🏗️ Overview", cmd: "Architecture overview" }, { label: "⚖️ Trade-offs", cmd: "Key trade-offs" }, { label: "⚠️ Mistakes", cmd: "Common mistakes" }, { label: "📐 Scale", cmd: "Scale considerations" }]
    : [{ label: "💡 Explain", cmd: "Explain this to me simply" }, { label: "📝 Summarize", cmd: "Summarize key points" }, { label: "🔄 Compare", cmd: "Pros and cons?" }, { label: "🎯 Next", cmd: "What should I do next?" }];

  const seg = (a: boolean) => `rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-all ${a ? "grad-bg text-white" : "border border-line/15 text-mut hover:border-acc1/40"}`;

  return (
    <>
      <button onClick={() => setOpen(o => !o)}
        className={`no-print fixed bottom-20 right-4 z-[110] grid h-14 w-14 place-items-center rounded-full shadow-[0_8px_30px_rgba(99,102,241,.45)] transition-all hover:scale-110 md:bottom-8 ${open ? "bg-deep border-2 border-acc1/50" : "grad-bg"}`}
        title="AI Coach (Ctrl+/)" aria-label="Open AI Coach">
        <span className="text-[22px]">{open ? "✕" : "🤖"}</span>
      </button>

      {open && (
        <div className={`no-print fixed bottom-[90px] z-[109] w-[380px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-[cubic-bezier(.4,0,.2,1)] md:bottom-[80px] ${topic.drawerOpen ? "left-4" : "right-4"}`}>
          <div className={`${cardCls} overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,.55)]`}>

            {/* Coach type tabs */}
            <div className="flex border-b border-line/10">
              <button onClick={() => setCoachType("system-design")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-bold transition-all border-b-2 ${coachType === "system-design" ? "border-acctxt text-acctxt bg-acc1/10" : "border-transparent text-mut hover:text-ink hover:bg-wht/5"}`}>
                <span>🏗️</span><span>System Design</span>{topic.title && <span className="text-[9px]">📎</span>}
              </button>
              <button onClick={() => setCoachType("general")} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-bold transition-all border-b-2 ${coachType === "general" ? "border-acctxt text-acctxt bg-acc1/10" : "border-transparent text-mut hover:text-ink hover:bg-wht/5"}`}>
                <span>💬</span><span>General Chat</span>
              </button>
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 border-b border-line/10 px-4 py-2.5">
              <span className="text-[14px]">{coachType === "system-design" ? "🏗️" : "💬"}</span>
              <span className="flex-1 text-[12px] font-extrabold">{coachType === "system-design" ? "System Design Coach" : "General Chat"}</span>
              {topic.drawerOpen && coachType === "system-design" && <span className="text-[9px] font-bold text-acctxt animate-pulse">← moved</span>}
              {msgs.length > 0 && <button onClick={clearChat} title="Clear chat" className="rounded-lg border border-line/15 px-2 py-0.5 text-[10px] font-bold text-mut hover:border-warn/40 hover:text-warn">🗑️</button>}
              <div className="flex gap-1">
                <button type="button" className={seg(mode === "api")} onClick={() => setMode("api")}>🤖 AI</button>
                <button type="button" className={seg(mode === "local")} onClick={() => setMode("local")}>📚 Offline</button>
              </div>
            </div>

            {/* Context banner (SD only) */}
            {coachType === "system-design" && topic.title && (
              <div className="flex items-center gap-2 border-b border-acc1/20 bg-acc1/10 px-4 py-2">
                <span className="text-[14px]">{topic.icon}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-extrabold text-acctxt">{topic.title}</span>
                  {topic.blurb && <p className="truncate text-[11px] text-mut">{topic.blurb}</p>}
                </div>
                <span className="flex-none rounded-full border border-acc1/30 bg-acc1/15 px-2 py-0.5 text-[10px] font-bold text-acctxt">📎 Context</span>
              </div>
            )}

            {/* Topic history (SD only) */}
            {coachType === "system-design" && !topic.title && topicHistory.length > 0 && (
              <div className="border-b border-line/10 px-4 py-2">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-mut">Recently studied</div>
                <div className="flex flex-wrap gap-1.5">
                  {topicHistory.slice(0, 5).map(id => { const c = getCaseById(id); if (!c) return null; return (
                    <button key={id} onClick={() => { const s = (window as any).__setCoachTopic; if (s) s({ caseId: c.id, title: c.title, icon: c.icon, blurb: c.blurb, drawerOpen: false }); }} className="flex items-center gap-1 rounded-full border border-line/15 bg-wht/5 px-2 py-0.5 text-[10.5px] font-bold text-mut hover:border-acc1/40 hover:text-ink">
                      <span>{c.icon}</span><span className="truncate max-w-[120px]">{c.title}</span>
                    </button>); })}
                </div>
              </div>
            )}

            {mode === "local" && <div className="border-b border-line/10 px-4 py-2"><GroundingNote minSim={ragTuningInfo().minSim} pool={ragTuningInfo().pool} /></div>}

            {/* Empty state */}
            {msgs.length === 0 && (
              <div className="px-4 pt-3 pb-2 text-center">
                {coachType === "system-design"
                  ? topic.title
                    ? <div className="text-[12.5px] leading-relaxed text-mut">I know verified facts about <strong>{topic.title}</strong>. Ask about architecture, trade-offs, failure modes, or scale.</div>
                    : <div className="text-[12.5px] leading-relaxed text-mut">I know verified facts about all system design case studies. Every answer comes from curated, verified sources.</div>
                  : <div><div className="text-[14px] mb-1">💬</div><div className="text-[12.5px] font-bold text-ink">Ask me anything!</div><div className="text-[11.5px] text-mut mt-0.5">Coding, math, writing, career advice, current events — you name it.</div><div className="mt-2"><span className="rounded-full border border-line/15 bg-wht/5 px-2.5 py-0.5 text-[10px] font-bold text-mut">Ctrl + / to toggle</span></div></div>}
              </div>
            )}

            {/* Messages */}
            <div ref={boxRef} className="h-[300px] space-y-2 overflow-y-auto px-4 py-3 pr-2">
              {msgs.map((m, i) => (
                <div key={i} className="flex flex-col">
                  {m.role === "user" && <div className="mb-0.5 text-right text-[10px] font-bold text-mut">You asked:</div>}
                  <div className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-relaxed ${m.role === "user" ? "ml-auto grad-bg text-white" : "bg-deep/60 text-ink"}`}>{m.text}</div>
                  {m.role === "assistant" && m.citations?.length ? (
                    <div className="mt-1 max-w-[90%] space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ok">{citationSourceLabel(m.citations.length, m.citationsSource)}</div>
                      {m.citations.map((ct, ci) => <CitationChip key={ci} title={ct.title} content={ct.content} source={ct.source} />)}
                    </div>) : null}
                </div>
              ))}
              {busy && <div className="text-[12px] text-mut">…thinking</div>}
              {voiceActive && <div className="flex items-center gap-2 text-[12px] text-acc1"><span className="h-2 w-2 animate-pulse rounded-full bg-acc1" /><span className="font-bold">Listening…</span></div>}
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-1 border-t border-line/10 px-4 py-2">
              {quickActions.map(c => <button key={c.label} disabled={busy} onClick={() => submit(c.cmd)} className="rounded-full border border-line/15 px-2 py-0.5 text-[10.5px] font-bold text-mut hover:border-acc1/40 hover:text-ink disabled:opacity-50">{c.label}</button>)}
            </div>

            {/* Composer */}
            <div className="flex gap-2 border-t border-line/10 px-4 py-3">
              {speech.supported && <button onClick={toggleVoice} title={voiceActive ? "Stop" : "Voice"} className={`flex-none self-end rounded-xl border px-2.5 py-2 text-[14px] ${voiceActive ? "border-acc1/50 bg-acc1/15 text-acc1 animate-pulse" : "border-line/25 bg-deep/60 text-mut hover:border-acc1/40 hover:text-acc1"}`}>🎤</button>}
              <textarea ref={inputRef} value={input} rows={1} onChange={e => { setInput(e.target.value); autoGrow(e.target); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={coachType === "system-design" && topic.title ? `Ask about ${topic.title}…` : coachType === "system-design" ? "Ask about system design…" : "Ask me anything…"}
                className="min-h-[36px] w-full flex-1 resize-none overflow-hidden rounded-xl border border-line/25 bg-deep/60 px-3 py-2 text-[12.5px] placeholder:text-fnt focus:border-acc1/80 focus:outline-none focus:ring-[3px] focus:ring-acc1/20" />
              <button onClick={send} disabled={busy || !input.trim()} className="self-end rounded-xl bg-acc1 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-acc2 disabled:opacity-50">Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
